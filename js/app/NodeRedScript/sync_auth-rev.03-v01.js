/**
 * ООО "МАС"
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 10 июня 2026 г.
 *
 * Horizon Server: Auth Sync Utility (v1.0)
 * Скрипт для работы на Хабе. Синхронизирует пароли Node-RED с MongoDB.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Конфигурация путей (адаптировано под Хаб)
const MONGO_SCRIPT_PATH = '/home/operator3/work/js/app/MongoDBscript/03__MongoDB-CreateUserAndCollection-rev.03-v01.js';
const SETTINGS_PATH = path.join(os.homedir(), '.node-red', 'settings.js');

async function sync() {
    console.log('\n--- [Horizon Server] Настройка аутентификации Node-RED ---');

    try {
        // 1. Извлечение паролей из скрипта MongoDB
        if (!fs.existsSync(MONGO_SCRIPT_PATH)) {
            throw new Error(`Не найден файл MongoDB: ${MONGO_SCRIPT_PATH}`);
        }

        console.log(`[1/4] Чтение паролей из скрипта MongoDB...`);
        const mongoContent = fs.readFileSync(MONGO_SCRIPT_PATH, 'utf8');
        const dbUserMatch = mongoContent.match(/const dbUser\s*=\s*(\[[\s\S]*?\])\s*;/);
        
        if (!dbUserMatch) throw new Error('Не удалось найти массив dbUser в файле MongoDB.');
        const dbUser = new Function(`return ${dbUserMatch[1]}`)();

        // 2. Генерация хешей системной утилитой
        console.log(`[2/4] Генерация системных хешей через node-red admin...`);
        const targetUsers = ['operator1', 'operator2', 'operator3', 'operator4', 'operator5', 'system'];
        const hashedUsers = [];

        for (const userEntry of dbUser) {
            if (targetUsers.includes(userEntry.user)) {
                process.stdout.write(`   > ${userEntry.user}... `);
                // Генерируем хеш через родную утилиту
                const hashOutput = execSync(`echo "${userEntry.pwd}" | node-red admin hash-pw`).toString();
                const hash = hashOutput.split('Password:')[1].trim();
                
                hashedUsers.push({
                    username: userEntry.user,
                    password: hash,
                    permissions: "*"
                });
                console.log('OK');
            }
        }

        // 3. Обновление settings.js
        console.log(`[3/4] Обновление файла настроек: ${SETTINGS_PATH}...`);
        if (!fs.existsSync(SETTINGS_PATH)) throw new Error('Файл settings.js не найден.');

        let settingsContent = fs.readFileSync(SETTINGS_PATH, 'utf8');
        const adminAuthRegex = /adminAuth:\s*{[\s\S]*?},/;
        
        // Формируем новый блок adminAuth
        const usersJson = JSON.stringify(hashedUsers, null, 12)
            .replace(/"([^"]+)":/g, '$1:')
            .replace(/"/g, "'");

        const adminAuthBlock = `adminAuth: {
        type: 'credentials',
        users: ${usersJson}
    },`;

        if (adminAuthRegex.test(settingsContent)) {
            settingsContent = settingsContent.replace(adminAuthRegex, adminAuthBlock);
        } else {
            // Если блока нет, вставляем после module.exports
            settingsContent = settingsContent.replace('module.exports = {', 'module.exports = {\n    ' + adminAuthBlock);
        }

        fs.writeFileSync(SETTINGS_PATH, settingsContent, 'utf8');
        console.log(`[4/4] Успешно! Конфигурация обновлена.`);

        // 4. Перезапуск службы
        console.log('--- Перезапуск службы Node-RED ---');
        execSync('sudo systemctl restart nodered3');
        console.log('Служба nodered3 перезапущена. Используйте порт 2003.');

    } catch (err) {
        console.error(`\n[ОШИБКА]: ${err.message}`);
        process.exit(1);
    }
}

sync();
