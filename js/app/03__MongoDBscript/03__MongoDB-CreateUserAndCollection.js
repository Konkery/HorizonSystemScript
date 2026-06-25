/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.04
 * Версия: v01
 * Дата: 23 июня 2026 г.
 *
 * Модуль: 03__MongoDB-CreateUserAndCollection
 *
 * Назначение:
 * Динамическая инициализация прикладной структуры СУБД MongoDB.
 * Скрипт обрабатывает конкретный хаб (передается через --hub), динамически создает БД,
 * коллекции и пользователей на основе settings_ha.json и secret-manager.
 * 
 * Адаптировано под структуру settings_ha.json (ревизия v03+).
 */

const { MongoClient } = require('mongodb');
const configLoader = require('../Common/config-loader');
const secretManager = require('../Common/secret-manager');

// Парсинг аргументов командной строки
const args = process.argv.slice(2);
const hubArg = args.find(arg => arg.startsWith('--hub='));
const hubKeyInput = hubArg ? hubArg.split('=')[1] : null;

async function run() {
    if (!hubKeyInput) {
        console.error('Ошибка: Необходимо указать хаб через аргумент --hub=hubLOW/hubMID/hubHI');
        process.exit(1);
    }

    console.log(`=== Шаг 3: Динамическая инициализация БД MongoDB для ${hubKeyInput} ===`);

    try {
        // Получаем конфигурацию через новый метод
        const { config, hubConfig, hubKey } = configLoader.getHubConfig(hubKeyInput);

        // Подтверждение генерации для данного хаба
        await secretManager.checkAndConfirmGeneration({ [hubKey]: hubConfig });

        // Доступ к настройкам MongoDB (админские данные теперь должны быть в структуре)
        // ВАЖНО: Предполагаем, что admin находится в структуре, нужно адаптировать доступ
        const { mongoUri, admin } = config.system; // Адаптировать при необходимости
        const hostPort = mongoUri.split('//')[1];
        const authUri = `mongodb://${admin.user}:${admin.password}@${hostPort}/?authSource=admin`;
        const client = new MongoClient(authUri);

        const allGeneratedData = [];
        const generatedSecrets = {};

        await client.connect();
        
        const { countUsers, userTemplate } = hubConfig.system;
        const dbPostfix = hubConfig.internalServices.generalDatabase.horizonAutomation.dbPostfix;
        const collectionTemplates = hubConfig.internalServices.generalDatabase.horizonAutomation.collectionGeneral_HA.list;

        for (let i = 1; i <= countUsers; i++) {
            const dbName = `${config.machineNAME}${dbPostfix}${i}`;
            const username = `${userTemplate}${i}`;
            const password = secretManager.generatePassword();

            const db = client.db(dbName);

            // Создание коллекций
            for (const col of collectionTemplates) {
                const options = {};
                if (col.type === 'TimeSeries') {
                    options.timeseries = col.params.timeseries;
                    options.expireAfterSeconds = col.params.expireAfterSeconds;
                } else if (col.type === 'Capped') {
                    options.capped = true;
                    options.size = col.params.size;
                }
                await db.createCollection(col.name, options);
            }

            // Создание пользователя
            await db.command({
                createUser: username,
                pwd: password,
                roles: [{ role: 'dbOwner', db: dbName }]
            });

            const data = {
                projectId: config.projectID,
                machineName: config.machineNAME,
                hub: hubKey,
                user: username,
                password: password,
                port: hubConfig.externalServices.settingsServices.nodeRed.startPort + (i - 1),
                dbName: dbName,
                timestamp: secretManager.timestamp
            };

            allGeneratedData.push(data);
            if (!generatedSecrets[hubKey]) generatedSecrets[hubKey] = {};
            generatedSecrets[hubKey][username] = password;

            secretManager.archivePassword(data);
        }

        secretManager.saveCredentials(allGeneratedData);
        secretManager.saveSecrets(generatedSecrets);
        await secretManager.resetGenerationFlags(config, [hubKey]);

        console.log(`Инициализация для ${hubKey} завершена успешно.`);
        await client.close();
    } catch (err) {
        console.error('Ошибка:', err.message);
        process.exit(1);
    }
}

run();
