<div align="right">
  <b>ООО "МАС"</b><br />
  <b>Ревизия:</b> rev.03<br />
  <b>Версия:</b> v01<br />
  <b>Дата:</b> 10 июня 2026 г.
</div>
<br />

# NodeRedScript: Управление и развертывание Node-RED

Директория содержит инструменты для автоматизированной настройки, синхронизации и управления множественными инстансами Node-RED на устройствах Horizon Hub.

## Взаимодействие с другими модулями

Работа Node-RED в экосистеме Horizon Automation неразрывно связана с настройкой безопасности и баз данных. 

**Важно:** Перед развертыванием Node-RED необходимо убедиться, что:
1.  Сгенерированы пароли и системные службы (см. [README-LinuxScript.md](../LinuxScript/README-LinuxScript.md)).
2.  Настроена СУБД MongoDB и созданы пользователи (см. [README-MongoDBscript.md](../MongoDBscript/README-MongoDBscript.md)).

### Самостоятельный запуск модулей MongoDB
Если вам требуется подготовить базу данных независимо от развертывания Node-RED, используйте следующие команды:
```bash
cd ../MongoDBscript
node 01__MongoDB-CreateUserAdmin-rev.03-v01.js   # Создание администратора
node 02__MongoDB-InitParam-rev.03-v01.js         # Настройка сетевого доступа
node 03__MongoDB-CreateUserAndCollection-rev.03-v01.js # Инициализация структуры
```

---

## Основные компоненты NodeRedScript

### 1. Автоматизированное развертывание (`master_deploy-rev.03-v01.js`)

Скрипт предназначен для запуска на ПК инженера. Он выполняет сквозную настройку всех инстансов Node-RED на удаленном Хабе.

*   **Принцип работы:**
    *   Считывает актуальные динамические пароли из `res/generated_secrets.json`.
    *   Генерирует криптографические хеши паролей, совместимые с Node-RED.
    *   Дистанционно обновляет файлы `settings.js` для каждого инстанса через SSH/SCP.
    *   Перезапускает соответствующие системные службы на Хабе.
*   **Запуск:** `node master_deploy-rev.03-v01.js`

### 2. Рассылка SSH-ключей (`setup_master_keys-rev.03-v01.js`)

Подготовительный скрипт для обеспечения беспарольного доступа к Хабу.

*   **Назначение:** Копирует публичный SSH-ключ инженера во все операторские аккаунты Хаба.
*   **Запуск:** `node setup_master_keys-rev.03-v01.js`

---

## Ручная настройка (Справочно)

### Описание процедуры включения аутентификации
В файле `settings.js`, в котором хранятся конфигурационные данные Node-Red, после установки присутствует такой блок закомментированных настроек:
```javascript
    /** To password protect the Node-RED editor and admin API, the following
     * property can be used. See http://nodered.org/docs/security.html for details.
     */
    //adminAuth: {
    //    type: "credentials",
    //    users: [{
    //        username: "admin",
    //        password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.",
    //        permissions: "*"
    //    }]
    //},
```
Данный файл в `Linux` расположен в директории пользователя: `/home/user_name/.node-red/settings.js`.

Для включения аутентификации необходимо заменить этот блок на структурированный список пользователей (`operator1`-`operator5` и `system`). Пароли должны быть предварительно хешированы утилитой:
```bash
node-red admin hash-pw
```

### Набор данных для отладочного HUB №1
Пример готового блока `adminAuth` с предсгенерированными хешами:
```javascript
    adminAuth: {
        type: "credentials",
        users: [
            { username: "operator1", password: "$2y$08$4HwAbXZo8IPwKcHfC1tLOeurkficCrCCGi6SdccdE2XlaYcOYT0kC", permissions: "*" },
            { username: "operator2", password: "$2y$08$qnRO67K3YH7BmnFgg8.Z4.871jpavRCUM6Z3OBvq2U2PO/WGJDb4C", permissions: "*" },
            { username: "operator3", password: "$2y$08$sJuJuUUssz98FXH6yF3C5u/6mUtcCBr0KyLMF9r/yefl4O0aYdM6m", permissions: "*" },
            { username: "operator4", password: "$2y$08$RHb7AFOsBZd7xDJxUWf8deqn/inXV3vjMo9svvNTndrmvs/Hb3vAK", permissions: "*" },
            { username: "operator5", password: "$2y$08$SqHdsK0Sde7k2/OpQX5QNejxWl/eW0TSbhxRP7joV9ju5ty.tEgjG", permissions: "*" },
            { username: "system",    password: "$2y$08$jlknOhV85ODimMw.0TI0gO/NO4z/sniBFqJPxlx4K3WxeEcWYrtSS", permissions: "*" }
        ]
    },
```
