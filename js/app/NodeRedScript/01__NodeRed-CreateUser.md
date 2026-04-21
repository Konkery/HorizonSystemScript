## АУТЕНТИФИКАЦИЯ, СОЗДАНИЕ ПОЛЬЗОВАТЕЛЕЙ NODE-RED
---
### ОПИСАНИЕ ПРОЦЕДУРЫ ВКЛЮЧЕНИЯ АУТЕНТИФИКАЦИИ
---
В файле `settings.js`, в котором хранятся конфигурационные данные Node-Red, после установки присутствует такой блок закомментированных настроек:
```
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
Данный файл в `Linux` в общем случае расположен в директории пользователя:
```
 /home/user_name/.node-red/settings.js
```
В `Windows` расположение:
```
c:\Users\user_name\.node-red\settings.js
```
Для включении аутентификации и создании пользователей операторов аналогичных СУБД MongoDB, необходимо заменить вышепоказанный блок текста на следующий:
```
    /** To password protect the Node-RED editor and admin API, the following
     * property can be used. See http://nodered.org/docs/security.html for details.
     */
    adminAuth: {
        type: "credentials",
        users: [
            {
                username: "operator1",
                password: "ВНИМАНИЕ! сюда нужно вставить сгенерированный на основе пароля hash код",
                permissions: "*"
            },
            {
                username: "operator2",
                password: "ВНИМАНИЕ! сюда нужно вставить сгенерированный на основе пароля hash код",
                permissions: "*"
            },
            {
                username: "operator3",
                password: "ВНИМАНИЕ! сюда нужно вставить сгенерированный на основе пароля hash код",
                permissions: "*"
            },
            {
                username: "operator4",
                password: "ВНИМАНИЕ! сюда нужно вставить сгенерированный на основе пароля hash код",
                permissions: "*"
            },
            {
                username: "operator5",
                password: "ВНИМАНИЕ! сюда нужно вставить сгенерированный на основе пароля hash код",
                permissions: "*"
            },
            {
                username: "system",
                password: "ВНИМАНИЕ! сюда нужно вставить сгенерированный на основе пароля hash код",
                permissions: "*"
            }
        ]
    },
```
Важно, значение поля `password` в каждом объекте в массиве `users` необходимо заменить на сгенерированное утилитой 'node-red-admin' hash значение полученное на основе пароля учетной записи. Утилита вызывается командой:
```
node-red admin hash-pw
```
Утилита не обязательно ставится вместе с Node-Red, поэтому ее возможно придется установить такой командой:
```
npm i node-red-admin -g
```
Сами пароли которые понадобятся при генерации hash значения необходимо взять из файла `System information.md`.
Который размещен также в данном (HorizonSystemScript) репозитории, по относительному пути `\HorizonSystemScript\js\module\LinuxScript\`.

### НАБОР ДАННЫХ ДЛЯ ОТЛАДОЧНОГО HUB №1
---
```
    /** To password protect the Node-RED editor and admin API, the following
     * property can be used. See http://nodered.org/docs/security.html for details.
     */
    adminAuth: {
        type: "credentials",
        users: [
            {
                username: "operator1",
                password: "$2y$08$4HwAbXZo8IPwKcHfC1tLOeurkficCrCCGi6SdccdE2XlaYcOYT0kC",
                permissions: "*"
            },
            {
                username: "operator2",
                password: "$2y$08$qnRO67K3YH7BmnFgg8.Z4.871jpavRCUM6Z3OBvq2U2PO/WGJDb4C",
                permissions: "*"
            },
            {
                username: "operator3",
                password: "$2y$08$sJuJuUUssz98FXH6yF3C5u/6mUtcCBr0KyLMF9r/yefl4O0aYdM6m",
                permissions: "*"
            },
            {
                username: "operator4",
                password: "$2y$08$RHb7AFOsBZd7xDJxUWf8deqn/inXV3vjMo9svvNTndrmvs/Hb3vAK",
                permissions: "*"
            },
            {
                username: "operator5",
                password: "$2y$08$SqHdsK0Sde7k2/OpQX5QNejxWl/eW0TSbhxRP7joV9ju5ty.tEgjG",
                permissions: "*"
            },
            {
                username: "system",
                password: "$2y$08$jlknOhV85ODimMw.0TI0gO/NO4z/sniBFqJPxlx4K3WxeEcWYrtSS",
                permissions: "*"
            }
        ]
    },
```