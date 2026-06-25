/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.04
 * Версия: v02
 * Дата: 23 июня 2026 г.
 *
 * Модуль: 02__NodeRed-CreateUsers
 * Назначение: Настройка изотропной аутентификации для активных инстансов.
 * 
 * Адаптировано под структуру settings_ha.json (ревизия v03+) 
 * и использование актуальных секретов из generated_secrets.json.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const configLoader = require('../Common/config-loader');

function getActualHomeDir() {
    const sudoUser = process.env.SUDO_USER;
    if (sudoUser && sudoUser !== 'root') {
        return `/home/${sudoUser}`;
    }
    return os.homedir();
}

const HOME_DIR = getActualHomeDir();
const SETTINGS_PATH = path.join(HOME_DIR, '.node-red', 'settings.js');
const SECRETS_PATH = path.join(__dirname, '../../res/01__config/generated_secrets.json');

// Парсинг аргументов
const args = process.argv.slice(2);
const hubArg = args.find(arg => arg.startsWith('--hub='));
const hubKeyInput = hubArg ? hubArg.split('=')[1] : null;

async function configureUsers() {
    if (!hubKeyInput) {
        console.error('Ошибка: Необходимо указать хаб через аргумент --hub=hubLOW/hubMID/hubHI');
        process.exit(1);
    }

    console.log(`=== Шаг 2: Настройка пользователей и аутентификации Node-RED для ${hubKeyInput} ===`);

    try {
        const { hubConfig } = configLoader.getHubConfig(hubKeyInput);
        const { countUsers, userTemplate } = hubConfig.system;
        
        // Чтение актуальных секретов
        if (!fs.existsSync(SECRETS_PATH)) {
            throw new Error(`Файл секретов не найден: ${SECRETS_PATH}. Запустите оркестратор для генерации.`);
        }
        const allSecrets = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8'));
        
        const hashedUsers = [];
        const sudoUser = process.env.SUDO_USER || os.userInfo().username;

        for (let i = 1; i <= countUsers; i++) {
            const username = `${userTemplate}${i}`;
            
            // Поиск пароля в актуальном хранилище секретов
            const secretEntry = allSecrets.find(s => s.hub === hubKeyInput && s.user === username);
            if (!secretEntry) {
                throw new Error(`Пароль для пользователя ${username} на хабе ${hubKeyInput} не найден в generated_secrets.json`);
            }
            const password = secretEntry.password;

            process.stdout.write(`   > Хеширование пароля для: ${username}... `);
            try {
                const hashOutput = execSync(`node-red admin hash-pw`, {
                    input: password + '\n',
                    stdio: ['pipe', 'pipe', 'ignore'],
                    encoding: 'utf8'
                }).trim();
                
                const hashMatch = hashOutput.match(/(\$2[aby]\$.*|scrypt\$.*)/);
                const finalHash = hashMatch ? hashMatch[0] : null;

                if (!finalHash) {
                    throw new Error(`Не удалось извлечь хеш из вывода: ${hashOutput}`);
                }
                
                hashedUsers.push({
                    username: username,
                    password: finalHash,
                    permissions: "*"
                });
                console.log('OK');
            } catch (e) {
                console.log(`ОШИБКА: ${e.message}`);
            }
        }

        console.log(`Создание чистой конфигурации для ${SETTINGS_PATH}...`);
        
        const settingsContent = `module.exports = {
    adminAuth: {
        type: 'credentials',
        users: ${JSON.stringify(hashedUsers, null, 4).replace(/"/g, "'")}
    },
    uiHost: "0.0.0.0",
    ui: { path: "ui" },
    functionExternalModules: true,
    functionGlobalContext: require('./dependencies.js'),
    logging: { console: { level: 'info', metrics: false, audit: false } },
    editorTheme: {
        projects: { enabled: false },
        codeEditor: { lib: 'monaco' }
    }
};`;

        fs.writeFileSync(SETTINGS_PATH, settingsContent, 'utf8');
        console.log('✅ Настройка аутентификации завершена.');

        // Перезапуск службы
        if (sudoUser.startsWith(userTemplate)) {
            const userIndex = parseInt(sudoUser.replace(userTemplate, ''), 10);
            const serviceName = `nodered${userIndex}`;
            console.log(`Попытка перезапуска службы: ${serviceName}`);
            try {
                execSync(`systemctl restart ${serviceName}`, { stdio: 'ignore' });
                console.log(`✅ Служба ${serviceName} перезапущена.`);
            } catch (e) {
                console.warn(`! Не удалось перезапустить ${serviceName} напрямую.`);
            }
        }

    } catch (error) {
        console.error('Критическая ошибка:', error.message);
        process.exit(1);
    }
}

configureUsers();
