const { MongoClient } = require('mongodb');

// Настройки подключения
const MONGO_URI = 'mongodb://localhost:27017'; // URI для подключения к MongoDB
const ADMIN_USERNAME = 'admin'; // Имя администратора
const ADMIN_PASSWORD = 'Gr4a7y'; // Пароль администратора

async function createAdminUser() {
  const client = new MongoClient(MONGO_URI);

  try {
    // Подключение к MongoDB
    await client.connect();

    // Переключение на базу данных admin
    const db = client.db('admin');

    // Создание пользователя администратора
    await db.command({
      createUser: ADMIN_USERNAME,
      pwd: ADMIN_PASSWORD,
      roles: [{ role: 'root', db: 'admin' }],
    });

    console.log(`Пользователь '${ADMIN_USERNAME}' успешно создан с ролью администратора.`);
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
  } finally {
    // Закрытие подключения
    await client.close();
  }
}

createAdminUser().catch(console.error);
