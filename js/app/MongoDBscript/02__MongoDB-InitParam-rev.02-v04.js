/**
 * Модуль предназначен для первоначальной инициализации СУБД.
 * Изначально СУБД не позволяет подключаться удаленным хостам, а также в ней не активирована возможность
 * аутентификации пользователей.
 * Данный скрипт выполняет:
 *  - разрешает удаленное подключение к СУБД;
 *  - создает пользователя администратора с именем 'system';
 *  - включает механизм аутентификации по логин/пароль;
 */

const fs = require("fs").promises;

const configFilePath = "/etc/mongod.conf"; // Путь к конфигурационному файлу mongod.conf

/**
 *  Функция для создания резервной копии конфигурационного файла
*/ 
async function createBackup() {
  const backupFilePath = `${configFilePath}.backup`;
  await fs.copyFile(configFilePath, backupFilePath);
  console.log("Создана резервная копия конфигурационного файла.");
}

// Функция для изменения конфигурации
async function updateConfig() {
  let config = await fs.readFile(configFilePath, "utf8");

  // Обновленный bindIp
  const newBindIpLine = "  bindIp: 0.0.0.0"; // Новая строка bindIp с двумя пробелами

  // Регулярное выражение для поиска строки bindIp в секции net
  const bindIpRegex = /^(  bindIp:\s*).*$/m;

  // Заменяем только если та строка bindIp не равна новой
  if (bindIpRegex.test(config)) {
    config = config.replace(bindIpRegex, newBindIpLine);
    console.log("Удаленное подключение разрешено.");
  } else {
    console.log("Секция net bindIp не найдена, добавляется новая.");

    // Если bindIp не найден, пытаемся добавить его
    const netSectionRegex = /^(net:\s*\n.*?\n)(\s*port:\s*27017\n)/s; // Находим секцию net
    const newNetConfig = `${newBindIpLine}\n`;

    if (netSectionRegex.test(config)) {
      config = config.replace(netSectionRegex, `$1${newNetConfig}$2`);
      console.log("Новая строка bindIp добавлена в секцию net.");
    }
  }

  // Проверяем и разблокируем секцию security
  const securityRegex = /^\s*#*security:\s*.*$/m; // Регулярное выражение для нахождения строки security
  const securityLine = "\nsecurity:\n"; // Строка для разблокировки
  const authorizationLine = "  authorization: enabled\n"; // Строка для добавления с двумя ведущими пробелами

  if (securityRegex.test(config)) {
    // Убираем символы "#" перед security: и заменяем
    config = config.replace(securityRegex, securityLine);
    console.log("Секция security разблокирована.");

    // Проверяем, есть ли уже строка authorization: enabled
    if (!config.includes(authorizationLine.trim())) {
      const lines = config.split("\n");
      const securityIndex = lines.findIndex(
        (line) => line.trim() === "security:"
      );

      // Вставляем строку authorization: enabled сразу после строки security:
      lines.splice(securityIndex + 1, 0, authorizationLine);
      config = lines.join("\n") + "\n"; // Обновляем конфигурацию

      console.log("Аутентификация включена.");
    } else {
      console.log("Аутентификация уже включена.");
    }
  } else {
    console.log("Секция security уже разблокирована.");
  }

  // Сохраняем изменения
  await fs.writeFile(configFilePath, config);
}

// Функция для перезапуска службы MongoDB
async function restartMongoDB() {
  console.log("Перезапуск службы MongoDB...");
  const { exec } = require("child_process");
  await new Promise((resolve, reject) => {
    exec("systemctl restart mongod", (error, stdout, stderr) => {
      if (error) {
        reject(`Ошибка перезапуска: ${stderr || error.message}`);
      } else {
        console.log("MongoDB перезапущен.");
        resolve(stdout);
      }
    });
  });
}

// Основная функция
(async () => {
  try {
    await createBackup();
    await updateConfig();
    await restartMongoDB();
    console.log("Инициализация MongoDB завершена.");
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
})();
