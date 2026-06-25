/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.03
 * Версия: v04
 * Дата: 17 июня 2026 г.
 *
 * Модуль: service-generator
 *
 * Назначение:
 * Библиотека для динамической генерации конфигурационных файлов systemd (.service) для инстансов Node-Red.
 */

const fs = require('fs');
const path = require('path');

const SERVICES_ROOT = path.join(__dirname, '../02__LinuxScript/NodeRedServices');
const HUBS = ['hubLow', 'hubMid', 'hubHi'];

/**
 * Очищает директории служб перед генерацией.
 */
function cleanup() {
    HUBS.forEach(hub => {
        const hubDir = path.join(SERVICES_ROOT, hub);
        if (fs.existsSync(hubDir)) {
            fs.rmSync(hubDir, { recursive: true, force: true });
        }
        fs.mkdirSync(hubDir, { recursive: true });
    });
}

/**
 * Генерирует файлы служб для сконфигурированных хабов.
 */
async function generate(config, hubsToGenerate) {
    cleanup();

    hubsToGenerate.forEach(hubKey => {
        const hubConfig = config[hubKey];
        const { instancesCount } = hubConfig.system;
        const hubDir = path.join(SERVICES_ROOT, hubKey);

        for (let i = 1; i <= instancesCount; i++) {
            const serviceName = `nodered${i}.service`;
            // Динамический шаблон на основе утвержденного паттерна
            const serviceContent = `# systemd service file to start Node-RED

[Unit]
Description=Node-RED Instance ${i} on ${hubKey}
Wants=network.target
Documentation=http://nodered.org/docs/hardware/raspberrypi.html

[Service]
Type=simple
User=operator${i}
Group=operator${i}
WorkingDirectory=/home/operator${i}
EnvironmentFile=-/home/operator${i}/.node-red/environment
# NODE_RED_OPTIONS можно задать в файле окружения для указания порта
ExecStart=/usr/bin/env node-red-pi $NODE_OPTIONS $NODE_RED_OPTIONS

# Use SIGINT to stop
KillSignal=SIGINT
# Auto restart on crash
Restart=on-failure
RestartSec=10
# Tag things in the log
SyslogIdentifier=nodered${i}

[Install]
WantedBy=multi-user.target
`;
            fs.writeFileSync(path.join(hubDir, serviceName), serviceContent);
            console.log(`Создана служба: ${hubKey}/${serviceName} для пользователя operator${i}`);
        }
    });
}

module.exports = { generate };
