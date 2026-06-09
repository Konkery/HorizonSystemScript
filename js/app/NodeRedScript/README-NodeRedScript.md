# NodeRedScript: Управление и развертывание Node-RED

Директория содержит инструменты для автоматизированной настройки, синхронизации и управления множественными инстансами Node-RED на устройствах Horizon Hub.

## Основные компоненты

### 1. Автоматизированное развертывание (`master_deploy.js`)

Скрипт предназначен для запуска на ПК инженера. Он выполняет сквозную настройку всех инстансов Node-RED на удаленном Хабе.

*   **Функционал:**
    *   Считывает актуальные пароли из скрипта `MongoDBscript/03__...js`.
    *   Генерирует криптографические хеши паролей для Node-RED.
    *   Дистанционно обновляет файлы `settings.js` для каждого операторского инстанса (`operator1`-`operator3`) через SSH/SCP.
    *   Перезапускает системные службы Node-RED на Хабе.
*   **Запуск:** `node master_deploy.js`

### 2. Рассылка SSH-ключей (`setup_master_keys.js`)

Подготовительный скрипт для обеспечения беспарольного доступа к Хабу.

*   **Назначение:** Копирует публичный SSH-ключ инженера во все операторские аккаунты Хаба.
*   **Использование:** Запускается один раз перед использованием `master_deploy.js`. Требует однократного ввода паролей для каждого пользователя.
*   **Запуск:** `node setup_master_keys.js`

### 3. Локальная синхронизация (`sync_auth.js`)

Скрипт для выполнения непосредственно на Хабе.

*   **Назначение:** Синхронизирует текущие настройки аутентификации Node-RED с данными, определенными в скриптах MongoDB.
*   **Действие:** Обновляет локальный `settings.js` и перезапускает службу `nodered3`.
*   **Запуск:** `node sync_auth.js`

---

## Ручная настройка аутентификации

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
