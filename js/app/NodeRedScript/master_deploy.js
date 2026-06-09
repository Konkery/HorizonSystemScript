/**
 * Horizon Hub: Master Deployer (v4.5 - Robust Hash Substitution)
 * 
 * ЗАПУСКАТЬ НА ПК ИНЖЕНЕРА.
 * Настраивает рабочие инстансы Node-RED (operator1, operator2, operator3).
 * В КАЖДОМ инстансе настраивается ПОЛНЫЙ список из 5 операторов + system.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- КОНФИГУРАЦИЯ ---
const HUB_IP = '10.130.1.11';
const MASTER_USER = 'operator3'; 
const MONGO_SCRIPT_PATH = path.resolve(__dirname, '..', 'MongoDBscript', '03__MongoDB-CreateUserAndCollection-rev.01-v05.js');

const targetInstances = [
    { name: 'operator1', port: 2001, service: 'nodered1' },
    { name: 'operator2', port: 2002, service: 'nodered2' },
    { name: 'operator3', port: 2003, service: 'nodered3' }
];

async function runDeploy() {
    console.log('=== [Horizon Master Deployer] Глобальная настройка Хаба (v4.5) ===\n');

    try {
        // 1. Считываем ВСЕ пароли из MongoDB
        console.log(`[1/3] Извлечение паролей из скрипта MongoDB...`);
        const mongoContent = fs.readFileSync(MONGO_SCRIPT_PATH, 'utf8');
        const dbUserMatch = mongoContent.match(/const dbUser\s*=\s*(\[[\s\S]*?\])\s*;/);
        if (!dbUserMatch) throw new Error('Массив dbUser не найден.');
        
        const dbUser = new Function(`return ${dbUserMatch[1]}`)();
        
        const allUsersData = [
            { name: 'operator1', pwd: dbUser.find(u => u.user === 'operator1').pwd },
            { name: 'operator2', pwd: dbUser.find(u => u.user === 'operator2').pwd },
            { name: 'operator3', pwd: dbUser.find(u => u.user === 'operator3').pwd },
            { name: 'operator4', pwd: dbUser.find(u => u.user === 'operator4').pwd },
            { name: 'operator5', pwd: dbUser.find(u => u.user === 'operator5').pwd },
            { name: 'system',    pwd: dbUser.find(u => u.user === 'system').pwd }
        ];

        // 2. Обновление конфигураций
        console.log(`[2/3] Обновление settings.js для инстансов...`);

        for (const instance of targetInstances) {
            process.stdout.write(`   > Настройка ${instance.name.toUpperCase()} (порт ${instance.port})... `);
            
            const localTmpFile = path.join(__dirname, `tmp_${instance.name}.sh`);
            const remoteTmpFile = `/tmp/setup_${instance.name}.sh`;

            // Формируем блок пользователей. Переменные $HASH_будут подставлены самим Bash.
            let usersArrayJson = '[\n';
            allUsersData.forEach((u, i) => {
                usersArrayJson += `            { username: '${u.name}', password: "$HASH_${u.name}", permissions: '*' }${i < allUsersData.length - 1 ? ',' : ''}\n`;
            });
            usersArrayJson += '        ]';

            // Команды генерации хешей
            let hashCommands = '';
            allUsersData.forEach(u => {
                hashCommands += `HASH_${u.name}=$(echo "${u.pwd}" | node-red admin hash-pw | grep Password | awk '{print $2}')\n`;
            });

            const bashScript = `#!/bin/bash
# 1. Генерируем все хеши в переменные окружения
${hashCommands}

# 2. Создаем settings.js. Bash автоматически подставит значения переменных $HASH_
cat <<EOF > ~/.node-red/settings.js
module.exports = {
    adminAuth: {
        type: 'credentials',
        users: ${usersArrayJson}
    },
    uiPort: ${instance.port},
    ui: { path: 'ui' },
    functionExternalModules: true,
    logging: { console: { level: 'info', metrics: false, audit: false } },
    editorTheme: {
        projects: { enabled: false },
        codeEditor: { lib: 'monaco' }
    }
}
EOF
`;

            try {
                fs.writeFileSync(localTmpFile, bashScript.replace(/\r\n/g, '\n'));
                execSync(`scp -o BatchMode=yes "${localTmpFile}" ${instance.name}@${HUB_IP}:${remoteTmpFile}`, { stdio: 'pipe' });
                execSync(`ssh -o BatchMode=yes ${instance.name}@${HUB_IP} "bash ${remoteTmpFile} && rm ${remoteTmpFile}"`, { stdio: 'pipe' });
                fs.unlinkSync(localTmpFile);
                console.log(`OK`);
            } catch (e) {
                console.log(`ОШИБКА: ${e.message}`);
                if (fs.existsSync(localTmpFile)) fs.unlinkSync(localTmpFile);
            }
        }

        // 3. Перезапуск служб через Мастер-аккаунт
        console.log(`\n[3/3] Перезапуск всех служб через ${MASTER_USER}...`);
        const masterPass = dbUser.find(u => u.user === MASTER_USER).pwd;

        for (const instance of targetInstances) {
            process.stdout.write(`   > Перезапуск ${instance.service}... `);
            try {
                const restartCmd = `echo "${masterPass}" | sudo -S systemctl restart ${instance.service}`;
                execSync(`ssh -o BatchMode=yes ${MASTER_USER}@${HUB_IP} "${restartCmd}"`, { stdio: 'pipe' });
                console.log(`OK`);
            } catch (e) {
                console.log(`ОШИБКА: ${e.message}`);
            }
        }

        console.log(`\n==================================================`);
        console.log(`СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА УСПЕШНО.`);
        console.log(`==================================================`);

    } catch (err) {
        console.error(`\n[КРИТИЧЕСКАЯ ОШИБКА]: ${err.message}`);
    }
}

runDeploy();
