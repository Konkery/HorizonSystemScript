/**
 * ООО "МАС"
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 10 июня 2026 г.
 *
 * Модуль: 03__MongoDB-CreateUserAndCollection
 * 
 * Назначение:
 * Глобальная инициализация прикладной структуры СУБД MongoDB для платформы Horizon Automation.
 * 
 * Особенности работы:
 * 1. ДИНАМИКА: Скрипт не содержит жестко прописанных имен БД или портов. Все данные 
 *    формируются «на лету» модулем config-loader-rev.03-v01 на основе файла settings.json.
 * 2. ДЕСТРУКТИВНОСТЬ: Скрипт предназначен для «чистой» установки или полного сброса.
 *    Если целевая база данных уже существует, скрипт УДАЛЯЕТ все коллекции и пользователей 
 *    в ней перед созданием новых.
 * 3. КОМПЛЕКСНОСТЬ: Обрабатывает как рабочие инстансы (dbHA1, dbHA2...), так и 
 *    внешние сервисы (Graylog, System).
 */

const { MongoClient } = require('mongodb');
const { loadConfig } = require('../Common/config-loader-rev.03-v01');

/**
 * Вспомогательная функция для формирования итогового отчета в консоли.
 * @param {Array} msgTable - Массив данных для вывода в console.table
 * @param {string} stage - Название этапа (Очистка, Создание, Доступ)
 * @param {string} target - Имя объекта (БД, Коллекция, Пользователь)
 * @param {string} status - Описание результата
 */
function logStage(msgTable, stage, target, status) {
    msgTable.push({
        'Этап': stage,
        'Объект': target,
        'Статус': status
    });
}

/**
 * Основная функция инициализации баз данных.
 */
async function updateDatabase() {
    console.log('=== Шаг 3: Глобальная инициализация прикладной структуры БД ===');

    // 1. Загрузка конфигурации через единый лоадер
    // На этом этапе происходит магия: генерируются пароли и формируются имена БД с префиксами
    let config;
    try {
        config = loadConfig();
    } catch (e) {
        console.error(`Критическая ошибка конфигурации: ${e.message}`);
        return;
    }

    const { mongoUri, admin } = config.system;
    
    // Формируем строку подключения с правами администратора (root)
    // Используем базу 'admin' для авторизации, но управлять будем прикладными БД
    const authUri = `mongodb://${admin.user}:${admin.password}@${mongoUri.split('//')[1]}`;
    const client = new MongoClient(authUri);

    const msgTable = []; // Сюда собираем данные для финальной красивой таблицы

    try {
        await client.connect();
        const adminDb = client.db().admin();
        
        // Получаем список всех существующих баз данных на сервере
        const existingDbs = (await adminDb.listDatabases()).databases.map(d => d.name);

        // Объединяем рабочие инстансы (с динамическими именами) и статические внешние сервисы в один цикл
        const allTargets = [
            ...config.instances.map(inst => ({ ...inst, isInstance: true })),
            ...config.externalServices.map(ext => ({ ...ext, isInstance: false }))
        ];

        for (const target of allTargets) {
            const dbName = target.dbName;
            const db = client.db(dbName);

            // --- ЭТАП 1: ОЧИСТКА ---
            // Если база данных уже существует, мы должны привести её к девственному состоянию
            if (existingDbs.includes(dbName)) {
                
                // Удаляем все коллекции
                const collections = await db.listCollections().toArray();
                for (const col of collections) {
                    await db.collection(col.name).drop();
                }
                logStage(msgTable, 'Очистка', dbName, 'Все коллекции удалены');

                // Удаляем всех пользователей, привязанных к этой конкретной базе
                try {
                    const users = await db.command({ usersInfo: 1 });
                    for (const user of users.users) {
                        await db.command({ dropUser: user.user });
                    }
                    logStage(msgTable, 'Очистка', dbName, 'Все пользователи удалены');
                } catch (e) {
                    logStage(msgTable, 'Очистка', dbName, `Ошибка удаления пользователей: ${e.message}`);
                }
            }

            // --- ЭТАП 2: СОЗДАНИЕ СТРУКТУРЫ (КОЛЛЕКЦИЙ) ---
            // Для инстансов берем общий шаблон из settings.json, для сервисов - их собственные списки
            const collectionsToCreate = target.isInstance ? config.collections : target.collections;

            for (const colDef of collectionsToCreate) {
                const options = {};
                
                // Настройка параметров в зависимости от ТИПА коллекции
                if (colDef.type === 'TimeSeries') {
                    // Оптимизированные коллекции для временных рядов (датчики)
                    options.timeseries = colDef.params.timeseries;
                    options.expireAfterSeconds = colDef.params.expireAfterSeconds; // Срок жизни данных (TTL)
                } else if (colDef.type === 'Capped') {
                    // Кольцевые коллекции фиксированного размера (логи, архивы)
                    options.capped = true;
                    options.size = colDef.params.size;
                }
                // Для типа 'Standart' дополнительные опции не требуются

                await db.createCollection(colDef.name, options);
                logStage(msgTable, 'Создание', `${dbName}.${colDef.name} (${colDef.type})`, 'Успешно');
            }

            // --- ЭТАП 3: НАСТРОЙКА ПРАВ ДОСТУПА ---
            
            // 3.1. Создание основного владельца базы (оператора или сервисного аккаунта)
            // Пароль берется из динамически сгенерированного CREDENTIALS.md / secrets.json
            await db.command({
                createUser: target.username,
                pwd: target.password,
                roles: [{ role: 'dbOwner', db: dbName }]
            });
            logStage(msgTable, 'Доступ', `${dbName}: ${target.username}`, 'Создан владелец (dbOwner)');

            // 3.2. Дополнительный системный доступ
            // Если это рабочий инстанс Horizon, даем права 'system' пользователю для кросс-аналитики
            if (target.isInstance) {
                const systemUser = config.externalServices.find(s => s.username === 'system');
                if (systemUser) {
                    await db.command({
                        createUser: systemUser.username,
                        pwd: systemUser.password,
                        roles: [{ role: 'dbOwner', db: dbName }]
                    });
                    logStage(msgTable, 'Доступ', `${dbName}: system`, 'Добавлен системный доступ');
                }
            }
        }

        // --- ФИНАЛ ---
        // Вывод той самой красивой таблицы, о которой вы просили
        console.table(msgTable);
        console.log('Инициализация структуры БД завершена успешно.');
        console.log('Учетные данные для подключения сохранены в res/CREDENTIALS.md');

    } catch (error) {
        console.error('Критическая ошибка при инициализации БД:', error.message);
    } finally {
        // Обязательное закрытие соединения с сервером
        await client.close();
    }
}

// Точка входа
updateDatabase().catch(err => {
    console.error('Непредвиденная ошибка исполнения:', err);
});
