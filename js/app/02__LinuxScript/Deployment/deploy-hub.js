/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.03
 * Версия: v11
 * Дата: 17 июня 2026 г.
 *
 * Модуль автоматизированного развертывания проекта Horizon Automation на удаленные хабы.
 * 
 * НАЗНАЧЕНИЕ:
 * Обеспечивает дистанционное обновление ПО на промышленных хабах (Raspberry Pi CM4/CM5)
 * через SSH-подключение с использованием архивного метода передачи данных.
 * 
 * ОСНОВНЫЕ ВОЗМОЖНОСТИ:
 * - Автоматическое чтение SSH-конфигураций из ~/.ssh/config
 * - Создание оптимизированного tar.gz архива проекта
 * - Параллельная загрузка на несколько хабов
 * - Автоматическая распаковка и развертывание на целевых системах
 * - Детальное логирование всех операций
 * 
 * ТРЕБОВАНИЯ:
 * - Node.js с модулями ssh2
 * - Git Bash (для tar-архивации в Windows)
 * - Настроенные SSH-ключи для доступа к хабам
 * - Корректный файл ~/.ssh/config с алиасами hub*
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('ssh2');

// --- НАСТРОЙКИ ---
const SSH_CONFIG_PATH = path.join(process.env.USERPROFILE, '.ssh', 'config');
// Путь к файлу конфигурации для проекта
const SETTINGS_PATH = path.resolve(__dirname, '../../../../res/01__config/settings_ha.json');
const CONNECT_TIMEOUT = 10000;
const DEBUG = true;
const ARCHIVE_NAME = 'horizon-system-script.tar.gz';

// Загрузка настроек
let settings;
try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    console.log(`[INFO] Настройки загружены из settings_ha.json. Hub IP: ${settings.system.hubIp}`);
} catch (err) {
    console.error(`[ERROR] Ошибка загрузки настроек: ${err.message}`);
    process.exit(1);
}

// Проверяем, что в каждом хабе присутствует флаг sessionGeneration
const hubs = ['hubLow', 'hubMid', 'hubHi'];
hubs.forEach(h => {
  if (settings[h] && typeof settings[h].sessionGeneration === 'undefined') {
    console.warn(`[WARN] В хабе ${h} отсутствует поле sessionGeneration`);
  }
});
const { vending } = settings.system;
const instancesCount = vending ? vending.instancesCount : 1;

/**
 * Парсер SSH-конфигурации для извлечения параметров подключения к хабам.
 * 
 * НАЗНАЧЕНИЕ:
 * Автоматически читает файл ~/.ssh/config и извлекает все записи Host,
 * начинающиеся с префикса "hub". Для каждого найденного хаба собирает
 * полную информацию о подключении.
 * 
 * ПРОЦЕСС РАБОТЫ:
 * 1. Читает SSH-конфиг построчно
 * 2. Идентифицирует блоки Host с префиксом "hub"
 * 3. Извлекает параметры: HostName, User, IdentityFile
 * 4. Преобразует относительные пути ключей (~/) в абсолютные
 * 5. Загружает содержимое приватных ключей в память
 * 6. Возвращает массив готовых конфигураций для ssh2.Client
 * 
 * ФОРМАТ SSH CONFIG:
 * Host hub-low-stend-op5
 *     HostName 192.168.1.100
 *     User operator5
 *     IdentityFile ~/.ssh/id_rsa_hub
 * 
 * ВОЗВРАЩАЕМЫЙ ФОРМАТ:
 * [
 *   {
 *     host: 'hub-low-stend-op5',        // Алиас хаба
 *     hostName: '192.168.1.100',         // IP-адрес или доменное имя
 *     username: 'operator5',             // Имя пользователя для SSH
 *     privateKey: Buffer                 // Содержимое приватного ключа
 *   },
 *   ...
 * ]
 * 
 * ОБРАБОТКА ОШИБОК:
 * - Если ключ не найден - выводит ERROR и пропускает эту конфигурацию
 * - Если файл config недоступен - возвращает пустой массив
 * 
 * @returns {Array<Object>} Массив конфигураций хабов для SSH-подключения
 */
function getHubConfigs() {
    try {
        // Читаем содержимое SSH-конфига
        const configContent = fs.readFileSync(SSH_CONFIG_PATH, 'utf8');
        const lines = configContent.split('\n');
        
        const configs = [];           // Результирующий массив конфигураций
        let currentConfig = null;     // Текущая обрабатываемая конфигурация
        let inHubConfig = false;      // Флаг: находимся ли мы внутри блока hub-конфигурации

        lines.forEach(line => {
            const trimmed = line.trim();
            
            // Обработка строки "Host <alias>"
            if (trimmed.startsWith('Host ')) {
                const alias = trimmed.replace('Host ', '').trim();
                
                // Проверяем, начинается ли алиас с "hub"
                if (alias.startsWith('hub')) {
                    // Создаем новую конфигурацию и добавляем в массив
                    currentConfig = { host: alias };
                    configs.push(currentConfig);
                    inHubConfig = true;
                } else {
                    // Это не hub-конфигурация, пропускаем
                    inHubConfig = false;
                    currentConfig = null;
                }
            } 
            // Обработка параметров внутри hub-блока
            else if (inHubConfig && currentConfig && trimmed) {
                
                // Извлечение IP-адреса или доменного имени
                if (trimmed.startsWith('HostName ')) {
                    currentConfig.hostName = trimmed.replace('HostName ', '').trim();
                }
                
                // Извлечение имени пользователя
                if (trimmed.startsWith('User ')) {
                    currentConfig.username = trimmed.replace('User ', '').trim();
                }
                
                // Извлечение пути к приватному ключу
                if (trimmed.startsWith('IdentityFile ')) {
                    let keyPath = trimmed.replace('IdentityFile ', '').trim();
                    
                    // Преобразование относительного пути (~/) в абсолютный
                    if (keyPath.startsWith('~')) {
                        keyPath = path.join(process.env.USERPROFILE, keyPath.slice(1));
                    }
                    
                    // Чтение содержимого приватного ключа
                    try {
                        if (fs.existsSync(keyPath)) {
                            currentConfig.privateKey = fs.readFileSync(keyPath);
                        } else {
                            console.error(`[ERROR] Ключ не найден: ${keyPath}`);
                        }
                    } catch (err) {
                        console.error(`[ERROR] Ошибка чтения ключа: ${err.message}`);
                    }
                }
            }
        });

        return configs;
    } catch (err) {
        console.error(`[ERROR] Ошибка при парсинге SSH конфига: ${err.message}`);
        return [];
    }
}

/**
 * Создает оптимизированный tar.gz архив проекта для передачи на хабы.
 * 
 * НАЗНАЧЕНИЕ:
 * Формирует сжатый архив только с необходимыми файлами проекта,
 * исключая временные файлы, node_modules и другой балласт.
 * 
 * ПРОЦЕСС АРХИВАЦИИ:
 * 1. Удаляет старый архив (если существует)
 * 2. Формирует список включаемых директорий/файлов
 * 3. Вызывает Git Bash tar для создания .tar.gz архива
 * 4. Проверяет результат и выводит размер архива
 * 
 * ВКЛЮЧАЕМЫЕ ЭЛЕМЕНТЫ:
 * - js/           - Исполняемые модули проекта
 * - res/          - Ресурсы и конфигурации
 * - sh/           - Shell-скрипты
 * - package.json  - Зависимости Node.js
 * - README.md     - Документация
 * 
 * ОСОБЕННОСТИ:
 * - Использует Git Bash tar (для Windows-совместимости)
 * - Таймаут операции: 30 секунд
 * - Автоматическая проверка существования файлов
 * 
 * ТРЕБОВАНИЯ:
 * - Установленный Git for Windows (tar в составе Git Bash)
 * - Права на запись в корневой директории проекта
 * 
 * @returns {string} Абсолютный путь к созданному архиву
 * @throws {Error} При ошибке создания архива или таймауте
 */
function createProjectArchive() {
    const projectRoot = process.cwd();
    const archivePath = path.join(projectRoot, ARCHIVE_NAME);
    
    console.log(`[INFO] Создание архива проекта...`);
    console.log(`       Директория: ${projectRoot}`);
    console.log(`       Архив: ${archivePath}`);
    
    // Удаляем старый архив
    if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
        console.log(`[INFO] Старый архив удален.`);
    }
    
    try {
        // Создаем список ТОЛЬКО нужных директорий и файлов
        const includeItems = [
            'js',
            'res',
            'sh',
            'package.json',
            'package-lock.json',
            'README.md',
            '.gitignore',
            '.prettierrc'
        ];
        
        // Проверяем какие из них существуют
        const existingItems = includeItems.filter(item => {
            const itemPath = path.join(projectRoot, item);
            return fs.existsSync(itemPath);
        });
        
        console.log(`[INFO] Будет архивировано элементов: ${existingItems.length}`);
        existingItems.forEach(item => console.log(`       - ${item}`));
        
        // Используем Git Bash tar
        const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
        const projectUnix = projectRoot.replace(/\\/g, '/');
        const itemsList = existingItems.join(' ');
        
        // Команда tar с указанием конкретных файлов/директорий
        const command = `"${gitBashPath}" -c "cd '${projectUnix}' && tar -czf ${ARCHIVE_NAME} ${itemsList}"`;
        
        console.log(`[INFO] Создаю архив с помощью Git Bash tar...`);
        if (DEBUG) console.log(`[DEBUG] Команда: ${command}`);
        
        const startTime = Date.now();
        const output = execSync(command, { 
            cwd: projectRoot, 
            encoding: 'utf8',
            timeout: 30000, // 30 секунд должно хватить
            windowsHide: true
        });
        const elapsed = Date.now() - startTime;
        
        console.log(`[INFO] Архивация завершена за ${(elapsed/1000).toFixed(1)}с`);
        
        if (output.trim()) {
            console.log(`[DEBUG] Вывод tar: ${output}`);
        }
        
        if (fs.existsSync(archivePath)) {
            const stats = fs.statSync(archivePath);
            console.log(`[INFO] Архив создан успешно. Размер: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            return archivePath;
        } else {
            throw new Error('Архив не был создан');
        }
    } catch (err) {
        console.error(`[ERROR] Ошибка создания архива: ${err.message}`);
        
        if (err.killed) {
            console.error(`[ERROR] Процесс был убит по таймауту!`);
            console.error(`[ERROR] Возможно OneDrive блокирует файлы или проект слишком большой.`);
        }
        
        throw err;
    }
}

/**
 * Выполняет полный цикл развертывания архива на удаленном хабе.
 * 
 * НАЗНАЧЕНИЕ:
 * Устанавливает SSH-соединение, очищает старые файлы, загружает новый архив,
 * распаковывает его и выполняет финальную очистку на целевом хабе.
 * 
 * ПОСЛЕДОВАТЕЛЬНОСТЬ ОПЕРАЦИЙ:
 * 1. Установка SSH-соединения с хабом
 * 2. Открытие SFTP-сессии
 * 3. Очистка старых файлов (~/DEPLOY, старые архивы)
 * 4. Загрузка нового архива через SFTP
 * 5. Распаковка архива в ~/DEPLOY
 * 6. Удаление архива с хаба (экономия места)
 * 7. Закрытие соединения
 * 
 * ПАРАМЕТРЫ ПОДКЛЮЧЕНИЯ:
 * - Таймаут общей операции: CONNECT_TIMEOUT (10 сек)
 * - Таймаут готовности SSH: 20 сек
 * - Использует аутентификацию по приватному ключу
 * 
 * КОМАНДЫ НА ХАБЕ:
 * - Очистка: rm -rf ~/DEPLOY ~/archive.tar.gz
 * - Распаковка: mkdir -p ~/DEPLOY && cd ~/DEPLOY && tar -xzf ~/archive.tar.gz
 * - Проверка: ls -la (первые 15 строк)
 * 
 * ОБРАБОТКА ОШИБОК:
 * - Автоматический разрыв соединения при таймауте
 * - Детальное логирование всех этапов
 * - Проброс исключений для обработки на верхнем уровне
 * 
 * @param {Object} hubConfig - Конфигурация хаба из getHubConfigs()
 * @param {string} archivePath - Полный путь к локальному архиву
 * @returns {Promise<void>} Promise, разрешающийся при успешном развертывании
 * @throws {Error} При ошибках подключения, передачи или распаковки
 */
function deployArchiveToHub(hubConfig, archivePath) {
    return new Promise((resolve, reject) => {
        console.log(`[${hubConfig.host}] Подключение к ${hubConfig.hostName}...`);
        
        const conn = new Client();
        let sftpSession = null;

        const timer = setTimeout(() => {
            console.error(`[${hubConfig.host}] Таймаут операции (${CONNECT_TIMEOUT/1000}с).`);
            if (sftpSession) sftpSession.end();
            conn.end();
            reject(new Error('Таймаут выполнения'));
        }, CONNECT_TIMEOUT);

        conn.on('ready', () => {
            console.log(`[${hubConfig.host}] SSH подключение установлено.`);
            
            conn.sftp((err, sftp) => {
                if (err) {
                    console.error(`[${hubConfig.host}] Ошибка SFTP: ${err.message}`);
                    conn.end();
                    return reject(err);
                }

                sftpSession = sftp;
                console.log(`[${hubConfig.host}] SFTP сессия установлена.`);
                
                // 1. Очистка старых файлов
                const cleanupCommand = 'rm -rf ~/DEPLOY ~/' + ARCHIVE_NAME + ' 2>/dev/null; echo "OK"';
                console.log(`[${hubConfig.host}] Выполняю очистку...`);
                
                conn.exec(cleanupCommand, (err, stream) => {
                    if (err) {
                        console.error(`[${hubConfig.host}] Ошибка очистки: ${err.message}`);
                        sftp.end();
                        conn.end();
                        return reject(err);
                    }
                    
                    console.log(`[${hubConfig.host}] Команда очистки запущена...`);
                    
                    let cmdOutput = '';
                    stream.on('data', (data) => {
                        cmdOutput += data.toString();
                    });
                    
                    stream.on('close', () => {
                        console.log(`[${hubConfig.host}] Очистка завершена: ${cmdOutput.trim()}`);
                        
                        // 2. Загрузка архива
                        const remoteArchivePath = ARCHIVE_NAME;
                        console.log(`[${hubConfig.host}] Загрузка архива...`);
                        
                        const startTime = Date.now();
                        sftp.fastPut(archivePath, remoteArchivePath, (err) => {
                            if (err) {
                                console.error(`[${hubConfig.host}] Ошибка загрузки: ${err.message}`);
                                sftp.end();
                                conn.end();
                                return reject(err);
                            }
                            
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`[${hubConfig.host}] Архив загружен за ${elapsed}с.`);
                            
                            // 3. Распаковка архива
                            const extractCommand = `mkdir -p ~/DEPLOY && cd ~/DEPLOY && tar -xzf ~/${ARCHIVE_NAME} && echo "Распаковка завершена" && ls -la | head -15`;
                            console.log(`[${hubConfig.host}] Распаковываю...`);
                            
                            conn.exec(extractCommand, (err, stream) => {
                                if (err) {
                                    console.error(`[${hubConfig.host}] Ошибка распаковки: ${err.message}`);
                                    sftp.end();
                                    conn.end();
                                    return reject(err);
                                }
                                
                                let output = '';
                                stream.on('data', (data) => {
                                    output += data.toString();
                                });
                                
                                stream.on('close', (code) => {
                                    if (code !== 0) {
                                        console.error(`[${hubConfig.host}] Ошибка распаковки (код ${code}):\n${output}`);
                                        sftp.end();
                                        conn.end();
                                        return reject(new Error('Ошибка распаковки'));
                                    }
                                    
                                    console.log(`[${hubConfig.host}] Распаковка завершена успешно.`);
                                    if (DEBUG) {
                                        console.log(`[${hubConfig.host}] Содержимое DEPLOY:\n${output}`);
                                    }
                                    
                                    // 4. Удаление архива с хаба
                                    conn.exec(`rm -f ~/${ARCHIVE_NAME}`, () => {
                                        console.log(`[${hubConfig.host}] Архив удален с хаба.`);
                                        sftp.end();
                                        conn.end();
                                        clearTimeout(timer);
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }).on('error', (err) => {
            console.error(`[${hubConfig.host}] Ошибка подключения: ${err.message}`);
            clearTimeout(timer);
            conn.end();
            reject(err);
        }).connect({
            host: hubConfig.hostName || hubConfig.host,
            username: hubConfig.username,
            privateKey: hubConfig.privateKey,
            readyTimeout: 20000
        });
    });
}

/**
 * Главная функция оркестрации процесса развертывания.
 * 
 * НАЗНАЧЕНИЕ:
 * Управляет полным циклом развертывания проекта на все целевые хабы:
 * от создания архива до формирования итоговой сводки результатов.
 * 
 * ЭТАПЫ ВЫПОЛНЕНИЯ:
 * 1. Создание локального tar.gz архива проекта
 * 2. Последовательное развертывание на каждый хаб из списка
 * 3. Удаление локального архива после завершения
 * 4. Формирование и вывод сводки результатов
 * 
 * ЛОГИКА ОБРАБОТКИ ХАБОВ:
 * - Количество обрабатываемых хабов = min(hubConfigs.length, instancesCount)
 * - Последовательная обработка (не параллельная) для стабильности
 * - Ошибка на одном хабе не прерывает обработку остальных
 * 
 * ВЫВОД ИНФОРМАЦИИ:
 * - Прогресс обработки каждого хаба
 * - Детальные логи операций
 * - Финальная сводка: успешные/проваленные развертывания
 * 
 * ОБРАБОТКА КРИТИЧЕСКИХ ОШИБОК:
 * - Невозможность создать архив - прерывает выполнение (exit 1)
 * - Ошибки на отдельных хабах - логируются, процесс продолжается
 * 
 * @async
 * @returns {Promise<void>}
 */
async function deploy() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  РАЗВЕРТЫВАНИЕ HORIZON AUTOMATION (архивный метод)             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`Хабов для обработки: ${hubConfigs.length}`);
    console.log(`Количество инстансов: ${instancesCount}\n`);
    
    // 1. Создание архива
    let archivePath;
    try {
        archivePath = createProjectArchive();
    } catch (err) {
        console.error(`[FATAL] Не удалось создать архив: ${err.message}`);
        console.error(`Убедитесь что tar доступен: tar --version`);
        process.exit(1);
    }
    
    // 2. Развертывание на каждый хаб
    const results = [];
    for (let i = 0; i < Math.min(hubConfigs.length, instancesCount); i++) {
        const hubConfig = hubConfigs[i];
        try {
            console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
            console.log(`║  ХАБА ${i+1}/${Math.min(hubConfigs.length, instancesCount)}: ${hubConfig.host.padEnd(50)} ║`);
            console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
            
            await deployArchiveToHub(hubConfig, archivePath);
            
            results.push({ hub: hubConfig.host, status: 'SUCCESS' });
            console.log(`\n✓ ${hubConfig.host} - УСПЕШНО ЗАВЕРШЕНО\n`);
        } catch (err) {
            results.push({ hub: hubConfig.host, status: 'FAILED', error: err.message });
            console.error(`\n✗ ${hubConfig.host} - ОШИБКА: ${err.message}\n`);
        }
    }
    
    // 3. Очистка локального архива
    try {
        fs.unlinkSync(archivePath);
        console.log(`[INFO] Локальный архив удален.`);
    } catch (err) {
        console.warn(`[WARN] Не удалось удалить архив: ${err.message}`);
    }
    
    // 4. Сводка результатов
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  СВОДКА РЕЗУЛЬТАТОВ                                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    results.forEach((result, i) => {
        const status = result.status === 'SUCCESS' ? '✓ УСПЕШНО' : '✗ ОШИБКА';
        console.log(`${i+1}. ${result.hub}: ${status}`);
        if (result.error) {
            console.log(`   └─ ${result.error}`);
        }
    });
    
    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const failedCount = results.filter(r => r.status === 'FAILED').length;
    
    console.log(`\nУспешно: ${successCount}, Ошибок: ${failedCount}`);
    console.log('\n╚════════════════════════════════════════════════════════════════╝\n');
}

// Получаем конфигурации хабов
const hubConfigs = getHubConfigs();
if (hubConfigs.length === 0) {
    console.error('[ERROR] Не найдено конфигураций SSH для хабов.');
    console.error('Проверьте файл ~/.ssh/config на наличие Host с префиксом "hub"');
    process.exit(1);
}

// Запуск
deploy().catch(err => {
    console.error(`[FATAL] Критическая ошибка: ${err.message}`);
    process.exit(1);
});