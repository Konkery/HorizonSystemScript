/**
 * ООО "МАС"
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 10 июня 2026 г.
 *
 * Модуль: 01__MongoDB-CreateUserAdmin
 * Назначение: Создание суперпользователя (root) в базе данных 'admin'.
 * Данный скрипт выполняется один раз на чистой СУБД для обеспечения дальнейшего управления.
 */

const { MongoClient } = require('mongodb');
const { loadConfig } = require('../Common/config-loader-rev.03-v01');

/**
 * Основная функция создания администратора.
 */
async function createAdminUser() {
    console.log('=== Шаг 1: Создание системного администратора MongoDB ===');

    let config;
    try {
        config = loadConfig();
    } catch (e) {
        console.error(`Критическая ошибка конфигурации: ${e.message}`);
        return;
    }

    const { mongoUri, admin } = config.system;
    const client = new MongoClient(mongoUri);

    try {
        // Установка соединения с сервером
        await client.connect();
        console.log('Успешное подключение к MongoDB.');

        // Переключение на системную базу данных 'admin'
        const db = client.db('admin');

        // Выполнение команды создания пользователя
        await db.command({
            createUser: admin.user,
            pwd: admin.password,
            roles: [{ role: 'root', db: 'admin' }],
        });

        console.log(`Пользователь '${admin.user}' успешно создан с ролью 'root'.`);
    } catch (error) {
        if (error.code === 11000 || error.message.includes('already exists')) {
            console.warn(`Предупреждение: Пользователь '${admin.user}' уже существует.`);
        } else {
            console.error('Ошибка при создании пользователя:', error.message);
        }
    } finally {
        // Закрытие сессии подключения
        await client.close();
        console.log('Соединение с MongoDB закрыто.');
    }
}

// Запуск процесса
createAdminUser().catch(err => {
    console.error('Непредвиденная ошибка:', err);
});
