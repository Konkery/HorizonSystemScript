/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.03
 * Версия: v03
 * Дата: 17 июня 2026 г.
 *
 * Модуль: init-orchestrator
 *
 * Назначение:
 * Единая точка входа для генерации паролей и системных служб Node-Red.
 */

const configLoader = require('./config-loader');
const secretManager = require('./secret-manager');
const serviceGenerator = require('./service-generator');

// ------------------------------------------------------------
//  init-orchestrator.js – генератор ресурсов для конкретного хаба
// ------------------------------------------------------------

/**
 * Модуль отвечает за создание пользователей, баз данных и коллекций
 * в соответствии с актуальной конфигурацией `settings_ha.json`.
 * После успешного завершения генерации флаг `sessionGeneration`
 * сбрасывается и сохраняется обратно в файл конфигурации.
 */

const ConfigLoader = require('./config-loader');
const secretManager = require('./secret-manager');
const serviceGenerator = require('./service-generator');

/**
 * Основная функция – генерация ресурсов для одного хаба.
 * @param {object} config – полный объект конфигурации.
 * @param {string} hubName – имя хаба (hubLow, hubMid, hubHi).
 */
async function generateHub(config, hubName) {
    const hubConfig = config[hubName];
    if (!hubConfig) {
        throw new Error(`Не найдено описание хаба ${hubName}`);
    }

    console.log(`=== Генерация ресурсов для ${hubName} ===`);

    // -----------------------------------------------------------------
    // 1. Пользователи
    // -----------------------------------------------------------------
    const users = [];
    const sysUsers = hubConfig.globalUsers || [];
    // глобальные пользователи (например, system)
    users.push(...sysUsers);

    const hubUsers = hubConfig.system?.users || [];
    for (const u of hubUsers) {
        if (u.typeNameUsers === 'static') {
            users.push({
                name: u.userTemplate,
                role: u.role,
                type: 'static'
            });
        } else if (u.typeNameUsers === 'dynamic') {
            const count = u.countUsers || 1;
            for (let i = 1; i <= count; i++) {
                users.push({
                    name: `${u.userTemplate}${i}`,
                    role: u.role,
                    type: 'dynamic'
                });
            }
        }
    }
    console.log(`Создано пользователей: ${users.map(u => u.name).join(', ')}`);

    // -----------------------------------------------------------------
    // 2. Базы данных и коллекции (generalDatabase)
    // -----------------------------------------------------------------
    const dbBase = `${config.machineNAME}${hubConfig.internalServices?.generalDatabase?.horizonAutomation?.dbPostfix || ''}`;
    const collections = hubConfig.internalServices?.generalDatabase?.horizonAutomation?.collectionGeneral_HA?.list || [];
    console.log(`База данных: ${dbBase}`);
    for (const col of collections) {
        console.log(`  → Коллекция ${col.name} (${col.type})`);
        // Здесь вызываются реальные команды MongoDB – в рамках CI оставляем заглушку
    }

    // -----------------------------------------------------------------
    // 3. Системные БД (systemDatabases) – только один хаб может их иметь
    // -----------------------------------------------------------------
    if (hubConfig.internalServices?.systemDatabases) {
        const sysDb = hubConfig.internalServices.systemDatabases.systemVM;
        if (sysDb) {
            const sysDbName = `${config.machineNAME}${sysDb.dbPostfix}`;
            console.log(`Создаётся системная БД: ${sysDbName}`);
            // Тоже заглушка – реальный вызов будет в service-generator
        }
    }

    // -----------------------------------------------------------------
    // 4. Сброс флага генерации и сохранение конфигурации
    // -----------------------------------------------------------------
    if (hubConfig.sessionGeneration) {
        hubConfig.sessionGeneration = false;
        await ConfigLoader.save(config);
        console.log(`Флаг sessionGeneration для ${hubName} сброшен`);
    }
}

module.exports = { generateHub };
