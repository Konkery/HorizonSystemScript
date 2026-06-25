/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.04
 * Версия: v01
 * Дата: 23 июня 2026 г.
 *
 * Модуль: 01__MongoDB-CreateUserAdmin
 * Назначение: Создание суперпользователя (root) в базе данных 'admin' для конкретного хаба.
 * Идемпотентный скрипт: выполняется при первой настройке и при обновлениях.
 */

const { MongoClient } = require('mongodb');
const configLoader = require('../Common/config-loader');

// Парсинг аргументов
const args = process.argv.slice(2);
const hubArg = args.find(arg => arg.startsWith('--hub='));
const hubKeyInput = hubArg ? hubArg.split('=')[1] : null;

/**
 * Основная функция создания/обновления администратора.
 */
async function createAdminUser() {
    if (!hubKeyInput) {
        console.error('Ошибка: Необходимо указать хаб через аргумент --hub=hubLOW/hubMID/hubHI');
        process.exit(1);
    }

    console.log(`=== Шаг 1: Идемпотентная настройка системного администратора MongoDB для ${hubKeyInput} ===`);

    try {
        const { config } = configLoader.getHubConfig(hubKeyInput);

        // Для административных действий используем системный URI
        const { mongoUri, admin } = config.system;
        
        const client = new MongoClient(mongoUri, {
            auth: { username: admin.user, password: admin.password },
            authSource: 'admin'
        });

        await client.connect();
        const db = client.db('admin');

        try {
            await db.command({
                createUser: admin.user,
                pwd: admin.password,
                roles: [{ role: 'root', db: 'admin' }],
            });
            console.log(`Пользователь '${admin.user}' успешно создан.`);
        } catch (error) {
            if (error.code === 11000 || error.message.includes('already exists') || error.code === 51003) {
                console.log(`Пользователь '${admin.user}' уже существует. Обновляем пароль.`);
                await db.command({
                    updateUser: admin.user,
                    pwd: admin.password
                });
            } else {
                throw error;
            }
        }
        await client.close();
    } catch (error) {
        console.error('Ошибка при настройке администратора:', error.message);
        process.exit(1);
    }
}

createAdminUser().catch(err => {
    console.error('Непредвиденная ошибка:', err);
    process.exit(1);
});
