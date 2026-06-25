/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.04
 * Версия: v01
 * Дата: 23 июня 2026 г.
 *
 * Модуль: 02__MongoDB-InitParam
 * Назначение: Идемпотентная инициализация параметров СУБД MongoDB для конкретного хаба.
 * Скрипт выполняет:
 *  - Проверку конфигурации /etc/mongod.conf;
 *  - Настройку bindIp (0.0.0.0) для удаленного доступа;
 *  - Включение механизма аутентификации (authorization: enabled);
 *  - Перезапуск службы MongoDB при необходимости.
 */

const fs = require('fs').promises;
const { exec } = require('child_process');
const configLoader = require('../Common/config-loader');

// Парсинг аргументов
const args = process.argv.slice(2);
const hubArg = args.find(arg => arg.startsWith('--hub='));
const hubKeyInput = hubArg ? hubArg.split('=')[1] : null;

const configFilePath = '/etc/mongod.conf';

/**
 * Проверяет, требуются ли изменения в конфигурации.
 * @param {string} configContent 
 * @returns {boolean}
 */
function needsUpdate(configContent) {
    const bindIpNeedsUpdate = !configContent.includes('bindIp: 0.0.0.0');
    const authNeedsUpdate = !configContent.includes('authorization: enabled');
    return bindIpNeedsUpdate || authNeedsUpdate;
}

/**
 * Обновляет содержимое конфигурационного файла.
 */
async function updateConfig() {
    let configContent = await fs.readFile(configFilePath, 'utf8');

    if (!needsUpdate(configContent)) {
        console.log('Конфигурация MongoDB актуальна. Изменения не требуются.');
        return false;
    }

    // Резервная копия
    const backupFilePath = `${configFilePath}.backup`;
    await fs.copyFile(configFilePath, backupFilePath);
    console.log(`Создана резервная копия: ${backupFilePath}`);

    // 1. Настройка сетевого интерфейса
    configContent = configContent.replace(/bindIp:.*$/m, 'bindIp: 0.0.0.0');
    console.log('Параметр bindIp установлен на 0.0.0.0.');

    // 2. Настройка безопасности
    if (!configContent.includes('security:')) {
        configContent += '\nsecurity:\n  authorization: enabled\n';
    } else {
        configContent = configContent.replace(/security:\s*$/m, 'security:\n  authorization: enabled');
    }
    console.log('Секция security активирована, авторизация включена.');

    await fs.writeFile(configFilePath, configContent);
    return true;
}

/**
 * Перезапускает службу MongoDB.
 */
async function restartMongoDB() {
    console.log('Перезапуск службы MongoDB...');
    return new Promise((resolve, reject) => {
        exec('sudo systemctl restart mongod', (error, stdout, stderr) => {
            if (error) {
                reject(`Ошибка перезапуска: ${stderr || error.message}`);
            } else {
                console.log('Служба MongoDB успешно перезапущена.');
                resolve(stdout);
            }
        });
    });
}

/**
 * Основной процесс инициализации.
 */
(async () => {
    if (!hubKeyInput) {
        console.error('Ошибка: Необходимо указать хаб через аргумент --hub=hubLOW/hubMID/hubHI');
        process.exit(1);
    }
    
    console.log(`=== Шаг 2: Идемпотентная инициализация системных параметров MongoDB для ${hubKeyInput} ===`);
    
    try {
        // Проверка конфигурации проекта
        configLoader.getHubConfig(hubKeyInput);

        const updated = await updateConfig();
        if (updated) {
            await restartMongoDB();
        }
        console.log('Инициализация системных параметров завершена успешно.');
    } catch (error) {
        console.error('Произошла критическая ошибка:', error.message);
        process.exit(1);
    }
})();
