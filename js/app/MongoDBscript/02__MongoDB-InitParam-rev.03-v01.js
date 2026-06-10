/**
 * ООО "МАС"
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 10 июня 2026 г.
 *
 * Модуль: 02__MongoDB-InitParam
 * Назначение: Первоначальная инициализация параметров СУБД MongoDB.
 * Скрипт выполняет:
 *  - Разрешение удаленных подключений (биндинг на 0.0.0.0);
 *  - Включение механизма аутентификации (authorization: enabled);
 *  - Создание резервной копии и обновление файла конфигурации /etc/mongod.conf.
 */

const fs = require('fs').promises;
const { exec } = require('child_process');
const { loadConfig } = require('../Common/config-loader-rev.03-v01');

const configFilePath = '/etc/mongod.conf'; // Стандартный путь к конфигурации в Linux

/**
 * Создает резервную копию конфигурационного файла.
 */
async function createBackup() {
    const backupFilePath = `${configFilePath}.backup`;
    try {
        await fs.copyFile(configFilePath, backupFilePath);
        console.log(`Создана резервная копия: ${backupFilePath}`);
    } catch (e) {
        console.warn('Предупреждение: Не удалось создать резервную копию (возможно, недостаточно прав).');
    }
}

/**
 * Обновляет содержимое конфигурационного файла.
 */
async function updateConfig() {
    let configContent = await fs.readFile(configFilePath, 'utf8');

    // 1. Настройка сетевого интерфейса (разрешение всех IP)
    const newBindIpLine = '  bindIp: 0.0.0.0';
    const bindIpRegex = /^(  bindIp:\s*).*$/m;

    if (bindIpRegex.test(configContent)) {
        configContent = configContent.replace(bindIpRegex, newBindIpLine);
        console.log('Параметр bindIp обновлен на 0.0.0.0.');
    } else {
        console.log('Секция net.bindIp не найдена, требуется ручная проверка конфигурации.');
    }

    // 2. Настройка безопасности (включение авторизации)
    const securityRegex = /^\s*#*security:\s*.*$/m;
    const securityBlock = '\nsecurity:\n  authorization: enabled\n';

    if (securityRegex.test(configContent)) {
        configContent = configContent.replace(securityRegex, securityBlock);
        console.log('Секция security активирована, авторизация включена.');
    } else if (!configContent.includes('authorization: enabled')) {
        configContent += securityBlock;
        console.log('Секция security добавлена в конец файла.');
    } else {
        console.log('Авторизация уже была настроена ранее.');
    }

    await fs.writeFile(configFilePath, configContent);
}

/**
 * Перезапускает службу MongoDB для применения изменений.
 */
async function restartMongoDB() {
    console.log('Перезапуск службы MongoDB...');
    return new Promise((resolve, reject) => {
        exec('sudo systemctl restart mongod', (error, stdout, stderr) => {
            if (error) {
                reject(`Ошибка перезапуска: ${stderr || error.message}`);
            } else {
                console.log('Служба MongoDB успешно перезапущена.');
                resolve(stdout);
            }
        });
    });
}

/**
 * Основной процесс инициализации.
 */
(async () => {
    console.log('=== Шаг 2: Инициализация системных параметров MongoDB ===');
    try {
        // Проверка наличия конфигурации (для валидации структуры перед правкой системных файлов)
        loadConfig();

        await createBackup();
        await updateConfig();
        await restartMongoDB();
        console.log('Инициализация системных параметров завершена успешно.');
    } catch (error) {
        console.error('Произошла критическая ошибка:', error.message);
        process.exit(1);
    }
})();
