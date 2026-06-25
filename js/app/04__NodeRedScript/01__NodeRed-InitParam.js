/**
 * ООО "МАС"
 * Проект: 27/2025-N1-МАС
 * Ревизия: rev.04
 * Версия: v01
 * Дата: 23 июня 2026 г.
 *
 * Модуль: 01__NodeRed-InitParam
 * Назначение: Первоначальная настройка сервера Node-RED (сеть и базовые параметры).
 * 
 * Особенности:
 * 1. ЛОКАЛЬНОСТЬ: Выполняется на Хабе под конкретным пользователем оператора.
 * 2. СЕТЬ: Разрешает удаленное подключение (uiHost: "0.0.0.0").
 * 3. ДИНАМИКА: Автоматически определяет нужный порт на основе конфигурации.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const configLoader = require('../Common/config-loader');

const SETTINGS_PATH = path.join(os.homedir(), '.node-red', 'settings.js');

// Парсинг аргументов
const args = process.argv.slice(2);
const hubArg = args.find(arg => arg.startsWith('--hub='));
const hubKeyInput = hubArg ? hubArg.split('=')[1] : null;

/**
 * Основная функция инициализации параметров.
 */
async function initNodeRed() {
    if (!hubKeyInput) {
        console.error('Ошибка: Необходимо указать хаб через аргумент --hub=hubLOW/hubMID/hubHI');
        process.exit(1);
    }
    
    console.log(`=== Шаг 1: Первоначальная настройка сервера Node-RED для ${hubKeyInput} ===`);

    try {
        const { hubConfig } = configLoader.getHubConfig(hubKeyInput);
        const currentUser = os.userInfo().username;
        
        // Определение индекса текущего пользователя (operator1, operator2...)
        const { userTemplate } = hubConfig.system;
        if (!currentUser.startsWith(userTemplate)) {
            throw new Error(`Текущий пользователь '${currentUser}' не соответствует шаблону '${userTemplate}'`);
        }
        const userIndex = parseInt(currentUser.replace(userTemplate, ''), 10);
        
        // Расчет порта
        const startPort = hubConfig.externalServices.settingsServices.nodeRed.startPort;
        const port = startPort + userIndex - 1;

        if (!fs.existsSync(SETTINGS_PATH)) {
            console.error(`Ошибка: Файл settings.js не найден по пути: ${SETTINGS_PATH}`);
            process.exit(1);
        }

        let settingsContent = fs.readFileSync(SETTINGS_PATH, 'utf8');

        console.log(`Настройка параметров для пользователя ${currentUser} (Порт: ${port})...`);

        // 1. Настройка порта
        const portRegex = /uiPort:\s*\d+,/;
        const newPortLine = `uiPort: ${port},`;
        if (portRegex.test(settingsContent)) {
            settingsContent = settingsContent.replace(portRegex, newPortLine);
        } else {
             settingsContent = settingsContent.replace('module.exports = {', `module.exports = {\n    ${newPortLine}`);
        }

        // 2. Настройка Host
        const hostRegex = /uiHost:\s*"[^"]*",/;
        const newHostLine = `uiHost: "0.0.0.0",`;
        if (hostRegex.test(settingsContent)) {
            settingsContent = settingsContent.replace(hostRegex, newHostLine);
        } else {
            settingsContent = settingsContent.replace('module.exports = {', `module.exports = {\n    ${newHostLine}`);
        }

        // 3. Другие параметры
        if (!settingsContent.includes('functionExternalModules: true')) {
            settingsContent = settingsContent.replace('module.exports = {', 'module.exports = {\n    functionExternalModules: true,');
        }

        fs.writeFileSync(SETTINGS_PATH, settingsContent, 'utf8');
        console.log('✅ Базовые параметры сервера успешно обновлены.');

    } catch (error) {
        console.error('Ошибка при настройке settings.js:', error.message);
        process.exit(1);
    }
}

initNodeRed();
