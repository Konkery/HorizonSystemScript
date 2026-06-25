/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.03
 * Версия: v02
 * Дата: 23 июня 2026 г.
 *
 * Модуль: generate-services
 *
 * Назначение:
 * Библиотека для динамической генерации конфигурационных файлов systemd (.service) для инстансов Node-Red.
 * Адаптировано под структуру settings_ha.json (ревизия v03+).
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../01__Common/config-loader');

const SERVICES_ROOT = path.join(__dirname, 'NodeRedServices');

/**
 * Очищает директории служб перед генерацией.
 */
function cleanup(hubs) {
    hubs.forEach(hub => {
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
async function generate() {
    const config = loadConfig();
    const hubs = ['hubLOW', 'hubMID', 'hubHI'].filter(hub => config[hub] && config[hub].system);
    
    cleanup(hubs);

    hubs.forEach(hubKey => {
        const hubConfig = config[hubKey];
        // Адаптация под новую структуру: используем countUsers и userTemplate
        const { countUsers, userTemplate } = hubConfig.system;
        const hubDir = path.join(SERVICES_ROOT, hubKey);

        for (let i = 1; i <= countUsers; i++) {
            const username = `${userTemplate}${i}`;
            const serviceName = `nodered${i}.service`;
            
            const serviceContent = `# systemd service file to start Node-RED

[Unit]
Description=Node-RED Instance ${i} on ${hubKey}
Wants=network.target
Documentation=http://nodered.org/docs/hardware/raspberrypi.html

[Service]
Type=simple
User=${username}
Group=${username}
WorkingDirectory=/home/${username}
EnvironmentFile=-/home/${username}/.node-red/environment
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
            console.log(`Создана служба: ${hubKey}/${serviceName} для пользователя ${username}`);
        }
    });
}

module.exports = { generate };
