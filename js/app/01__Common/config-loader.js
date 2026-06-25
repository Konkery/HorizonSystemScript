/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 16 июня 2026 г.
 */

const fs = require('fs');
const path = require('path');

/**
 * Загрузчик и валидатор конфигурации проекта.
 */
class ConfigLoader {
    constructor() {
        this.configPath = path.join(__dirname, '../../../res/01__config/settings_ha.json');
    }

    load() {
        if (!fs.existsSync(this.configPath)) {
            throw new Error(`Конфигурационный файл не найден: ${this.configPath}`);
        }
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.validate(config);
        return config;
    }

    /**
     * Возвращает конфигурацию конкретного хаба.
     */
    getHubConfig(hubKey) {
        const config = this.load();
        const normalizedKey = Object.keys(config).find(key => key.toLowerCase() === hubKey.toLowerCase());
        if (!normalizedKey) {
            throw new Error(`Хаб ${hubKey} не найден в конфигурации.`);
        }
        return {
            config,
            hubConfig: config[normalizedKey],
            hubKey: normalizedKey
        };
    }

    validate(config) {
        const required = ['projectID', 'machineNAME', 'description', 'hubLow', 'hubMid', 'hubHi'];
        
        for (const key of required) {
            if (!(key in config)) {
                throw new Error(`Отсутствует обязательный ключ конфигурации: ${key}`);
            }
        }

        const hubs = ['hubLOW', 'hubMID', 'hubHI'];
        const activeHubs = hubs.filter(hub => Object.keys(config[hub].system || {}).length > 0);

        if (activeHubs.length === 0) {
            throw new Error('Конфигурация должна содержать хотя бы один активный раздел хаба (hubLOW, hubMID или hubHI).');
        }
    }
}

module.exports = new ConfigLoader();
