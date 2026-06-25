/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.03
 * Версия: v04
 * Дата: 17 июня 2026 г.
 */

const fs = require('fs');
const path = require('path');

/**
 * Менеджер секретов проекта.
 * Отвечает за генерацию паролей, сохранение в файлы (CREDENTIALS.md, generated_secrets.json)
 * и архивирование в dbVMPass.csv.
 */
class SecretManager {
    /**
     * Возвращает конфигурацию внешних сервисов хаба.
     * @param {object} hubConfig - объект конфигурации конкретного хаба.
     * @returns {object} { nodeRedPort }
     */
    getExternalServicesConfig(hubConfig) {
        const nodeRedPort = hubConfig?.externalServices?.settingsServices?.nodeRed?.startPort || null;
        return { nodeRedPort };
    }

    constructor() {
        this.configPath = path.join(__dirname, '../../../res/01__config');
        this.dbPassPath = path.join(this.configPath, 'dbVMPass.csv');
        this.credentialsPath = path.join(this.configPath, 'CREDENTIALS.md');
        this.secretsPath = path.join(this.configPath, 'generated_secrets.json');
        this.timestamp = new Date().toLocaleString('ru-RU');
    }

    generatePassword(length = 8) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let retVal = '';
        for (let i = 0; i < length; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return retVal;
    }

    /**
     * Генерирует данные для одного инстанса хаба.
     */
    generateInstanceData(projectId, machineName, hubName, instanceIndex, baseConfig) {
        return {
            projectId,
            machineName,
            hub: hubName,
            user: `operator${instanceIndex}`,
            password: this.generatePassword(),
            port: baseConfig.startPort + instanceIndex - 1,
            dbName: `${machineName}_${baseConfig.dbPrefix}${instanceIndex}`,
            timestamp: this.timestamp,
            isService: false
        };
    }

    /**
     * Генерирует данные для внешнего сервиса.
     */
    generateServiceData(projectId, machineName, hubName, serviceConfig) {
        return {
            projectId,
            machineName,
            hub: hubName,
            user: serviceConfig.username,
            password: this.generatePassword(),
            port: '-',
            dbName: serviceConfig.dbName,
            timestamp: this.timestamp,
            isService: true
        };
    }

    ensureCsvHeader() {
        if (!fs.existsSync(this.dbPassPath)) {
            const header = 'ID,ID_PROJECT,ID_MAСHINE,HUB,USER,PASSWORD,PORT,DBMS,TIMESTAMP\n';
            fs.writeFileSync(this.dbPassPath, header);
        }
    }

    getNextId() {
        const data = fs.readFileSync(this.dbPassPath, 'utf8');
        const lines = data.trim().split('\n');
        if (lines.length <= 1) return 1;
        const lastLine = lines[lines.length - 1];
        const lastId = parseInt(lastLine.split(',')[0]);
        return lastId + 1;
    }

    /**
     * Финализирует сохранение всех сгенерированных секретов.
     */
    persistAllSecrets(allNewData, fullConfig) {
        this.ensureCsvHeader();
        
        // 1. Формируем структуру данных для ВСЕХ хабов и сервисов
        const allStructuredData = this.prepareFullDataStructure(allNewData, fullConfig);

        // 2. Обновляем JSON
        this.saveSecrets(allStructuredData);

        // 3. Формируем новый CREDENTIALS.md
        this.saveCredentials(allStructuredData);

        // 4. Добавляем в архив dbVMPass.csv ТОЛЬКО новые данные
        allNewData.forEach(data => {
            const id = this.getNextId();
            const csvLine = `${id},${data.projectId},${data.machineName},${data.hub},${data.user},${data.password},${data.port},${data.dbName},${data.timestamp}\n`;
            fs.appendFileSync(this.dbPassPath, csvLine);
        });
    }

    /**
     * Подготавливает полную структуру данных.
     */
    prepareFullDataStructure(allNewData, fullConfig) {
        const hubs = ['hubLow', 'hubMid', 'hubHi'];
        const result = [];

        hubs.forEach(hubName => {
            if (!fullConfig[hubName]) return;

            const hubData = allNewData.filter(d => d.hub === hubName);
            
            if (hubData.length > 0) {
                result.push(...hubData);
            } else {
                // Добавляем пустую строку для хаба
                result.push({
                    projectId: fullConfig.projectID,
                    machineName: fullConfig.machineNAME,
                    hub: hubName,
                    user: '-',
                    password: '-',
                    port: '-',
                    dbName: '-',
                    timestamp: '-',
                    isService: false
                });
            }
        });
        return result;
    }

    saveSecrets(secrets) {
        fs.writeFileSync(this.secretsPath, JSON.stringify(secrets, null, 2));
    }

    saveCredentials(allData) {
        let md = '# Учетные данные проекта\n\n';
        const hubs = ['hubLow', 'hubMid', 'hubHi'];

        hubs.forEach(hubName => {
            const hubData = allData.filter(d => d.hub === hubName);
            
            md += `## Хаб: ${hubName}\n\n`;
            md += '| ID | ID_PROJECT | ID_MAСHINE | HUB | USER | PASSWORD | PORT | DBMS | TIMESTAMP |\n';
            md += '|:---|:---|:---|:---|:---|:---|:---|:---|:---|\n';
            
            if (hubData.length > 0) {
                hubData.forEach((d, index) => {
                    md += `| ${index + 1} | ${d.projectId} | ${d.machineName} | ${d.hub} | ${d.user} | ${d.password} | ${d.port} | ${d.dbName} | ${d.timestamp} |\n`;
                });
            } else {
                md += '| - | - | - | - | - | - | - | - | - |\n';
            }
            md += '\n';
        });
        
        fs.writeFileSync(this.credentialsPath, md);
    }

    async resetGenerationFlags(config, hubsToReset) {
        const settingsPath = path.join(this.configPath, 'settings_ha.json');
        
        const currentConfig = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

        hubsToReset.forEach(hub => {
            if (currentConfig[hub]) {
                currentConfig[hub].sessionGeneration = false;
            }
        });
        
        fs.writeFileSync(settingsPath, JSON.stringify(currentConfig, null, 2));
    }

    async checkAndConfirmGeneration(config) {
        const hubsToGenerate = ['hubLow', 'hubMid', 'hubHi'].filter(
            hub => config[hub] && config[hub].sessionGeneration === true
        );

        if (hubsToGenerate.length === 0) {
            throw new Error('Ошибка конфигурации: ни один хаб не настроен на генерацию (sessionGeneration: true).');
        }

        return hubsToGenerate;
    }
}

module.exports = new SecretManager();
