/**
 * ООО "МАС"
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 10 июня 2026 г.
 *
 * Модуль генерации системных служб Node-RED.
 * Создает файлы .service для каждого инстанса, описанного в settings.json.
 * Перед генерацией удаляет старые файлы служб в текущей директории.
 */

const fs = require('fs');
const path = require('path');
const { loadConfig, clearSecrets } = require('../Common/config-loader-rev.03-v01');

/**
 * Основная функция генерации служб.
 */
function generateServices() {
    console.log('=== Запуск генерации системных служб Node-RED ===');

    try {
        // 1. Сброс старых секретов (паролей) для новой итерации развертывания
        clearSecrets();

        const config = loadConfig();
        const instances = config.instances;
        const targetDir = __dirname;

        // 2. Очистка директории от результатов старой генерации
        // Удаляем все файлы, кроме самих .js скриптов
        const files = fs.readdirSync(targetDir);
        files.forEach(file => {
            const filePath = path.join(targetDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isFile() && !file.endsWith('.js')) {
                fs.unlinkSync(filePath);
                console.log(`Удален старый файл: ${file}`);
            }
        });

        // 3. Генерация новых файлов .service
        instances.forEach(instance => {
            const serviceFileName = `nodered${instance.id}.service`;
            const servicePath = path.join(targetDir, serviceFileName);

            const serviceContent = `# systemd service file to start Node-RED

[Unit]
Description=Node-RED graphical event wiring tool, Instance ${instance.id}
Wants=network.target
Documentation=http://nodered.org/docs/hardware/raspberrypi.html

[Service]
Type=simple
User=${instance.username}
Group=${instance.username}
WorkingDirectory=/home/${instance.username}

Environment="NODE_OPTIONS=--max_old_space_size=2048"
EnvironmentFile=-/home/${instance.username}/.node-red/environment

ExecStart=/usr/bin/env node-red-pi $NODE_OPTIONS $NODE_RED_OPTIONS --port ${instance.port}
KillSignal=SIGINT
Restart=on-failure
RestartSec=20
SyslogIdentifier=Node-RED-${instance.id}

[Install]
WantedBy=multi-user.target
`;

            fs.writeFileSync(servicePath, serviceContent);
            console.log(`Создан файл службы: ${serviceFileName} (пользователь: ${instance.username}, порт: ${instance.port})`);
        });

        console.log('=== Генерация завершена успешно ===');
    } catch (error) {
        console.error(`Ошибка при генерации служб: ${error.message}`);
        process.exit(1);
    }
}

generateServices();
