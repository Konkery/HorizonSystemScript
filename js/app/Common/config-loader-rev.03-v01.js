/**
 * ООО "МАС"
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 10 июня 2026 г.
 *
 * Модуль для загрузки, валидации и динамического расширения конфигурации settings.json.
 * Реализует логику генерации паролей, имен БД и портов.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.resolve(__dirname, '../../../res/01__config/settings.json');
const SECRETS_PATH = path.resolve(__dirname, '../../../res/01__config/generated_secrets.json');

/**
 * Генерирует надежный пароль заданной длины.
 */
function generatePassword(length = 8) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}

/**
 * Загружает существующие секреты или генерирует новые.
 */
function getOrGenerateSecrets(instancesCount, externalServices) {
    let secrets = {};
    if (fs.existsSync(SECRETS_PATH)) {
        try {
            secrets = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8'));
        } catch (e) {
            secrets = {};
        }
    }

    let updated = false;

    // Секреты для инстансов
    for (let i = 1; i <= instancesCount; i++) {
        const key = `operator${i}`;
        if (!secrets[key]) {
            secrets[key] = generatePassword();
            updated = true;
        }
    }

    // Секреты для внешних сервисов
    externalServices.forEach(service => {
        if (!secrets[service.username]) {
            secrets[service.username] = generatePassword();
            updated = true;
        }
    });

    if (updated) {
        fs.writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 2));
        console.log(`[ConfigLoader] Обновлен файл секретов: ${SECRETS_PATH}`);
        
        // После обновления JSON сохраняем удобный текстовый отчет
        saveCredentialsReport(instancesCount, externalServices, secrets);
    }

    return secrets;
}

/**
 * Сохраняет учетные данные в удобном для чтения Markdown формате.
 */
function saveCredentialsReport(instancesCount, externalServices, secrets) {
    const REPORT_PATH = path.resolve(__dirname, '../../../res/01__config/CREDENTIALS.md');
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const { vending } = config.system;

    let content = `# Учетные данные Horizon Automation\n\n`;
    content += `> **Внимание:** Этот файл генерируется автоматически. Пароли действительны до следующего цикла развертывания.\n`;
    content += `> Дата генерации: ${new Date().toLocaleString()}\n\n`;

    content += `## 1. Рабочие инстансы (Horizon Instances)\n\n`;
    content += `| ID | Пользователь | Пароль | Порт | База данных |\n`;
    content += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (let i = 1; i <= instancesCount; i++) {
        const user = `${vending.userBaseName}${i}`;
        const db = `${vending.machineName}_${vending.dbBaseName}${i}`;
        const port = vending.startPort + (i - 1);
        content += `| ${i} | \`${user}\` | \`${secrets[user]}\` | ${port} | \`${db}\` |\n`;
    }

    content += `\n## 2. Внешние сервисы и системные БД\n\n`;
    content += `| Сервис | Пользователь | Пароль | База данных |\n`;
    content += `| :--- | :--- | :--- | :--- |\n`;

    externalServices.forEach(service => {
        content += `| ${service.description || 'Service'} | \`${service.username}\` | \`${secrets[service.username]}\` | \`${service.dbName}\` |\n`;
    });

    fs.writeFileSync(REPORT_PATH, content);
    console.log(`[ConfigLoader] Создан отчет с паролями: ${REPORT_PATH}`);
}

/**
 * Загружает и динамически расширяет конфигурацию.
 */
function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(`Файл конфигурации не найден: ${CONFIG_PATH}`);
    }

    try {
        const rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        const { vending } = rawConfig.system;
        const secrets = getOrGenerateSecrets(vending.instancesCount, rawConfig.externalServices);

        // 1. Формируем список инстансов
        const instances = [];
        for (let i = 1; i <= vending.instancesCount; i++) {
            const username = `${vending.userBaseName}${i}`;
            instances.push({
                id: i,
                username: username,
                password: secrets[username],
                dbName: `${vending.machineName}_${vending.dbBaseName}${i}`,
                port: vending.startPort + (i - 1)
            });
        }

        // 2. Расширяем внешние сервисы паролями
        const externalServices = rawConfig.externalServices.map(service => ({
            ...service,
            password: secrets[service.username]
        }));

        // 3. Возвращаем итоговый объект
        return {
            system: rawConfig.system,
            instances: instances,
            collections: rawConfig.collectionTemplates.list,
            externalServices: externalServices
        };
    } catch (error) {
        throw new Error(`Ошибка при загрузке конфигурации: ${error.message}`);
    }
}

/**
 * Очищает (уничтожает) текущие секреты.
 * Вызывается для обеспечения "срока жизни" пароля.
 */
function clearSecrets() {
    const REPORT_PATH = path.resolve(__dirname, '../../../res/CREDENTIALS.md');
    if (fs.existsSync(SECRETS_PATH)) {
        fs.unlinkSync(SECRETS_PATH);
        console.log('[ConfigLoader] Секреты (JSON) удалены.');
    }
    if (fs.existsSync(REPORT_PATH)) {
        fs.unlinkSync(REPORT_PATH);
        console.log('[ConfigLoader] Отчет CREDENTIALS.md удален.');
    }
}

module.exports = {
    loadConfig,
    clearSecrets
};
