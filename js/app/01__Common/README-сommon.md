<div align="left">
<b>ООО "МАС"</b><br /
><b>Проект:</b> 27/2025‑N1‑МАС<br /
><b>Ревизия:</b> rev.03<br />
<b>Версия:</b> v07<br />
<b>Дата:</b> 17 июня 2026 г.</div>
<br>

# Руководство по модулю - Common

## 📋 Содержание

1. [Общее назначение каталога](#obщее-назначение)
2. [Список модулей](#модули)
   - [config‑loader.js](#config‑loaderjs)
   - [init‑orchestrator.js](#init‑orchestratorjs)
   - [service‑generator.js](#service‑generatorjs)
   - [secret‑manager.js](#secret‑managerjs)
3. [Алгоритм типичной инициализации](#алгоритм-инициализации)
4. [Требования к окружению](#требования)
5. [FAQ](#faq)

---

<a id="obщее-назначение"></a>

## 1. Общее назначение каталога

`js/app/01__Common` — ядро логики Horizon Automation. Здесь находятся утилиты, отвечающие за:

- загрузку и валидацию конфигурации;
- генерацию безопасных паролей и их хранение;
- создание `systemd`‑служб для Node‑RED;
- управление секретами проекта.
  Все скрипты работают без привилегий `sudo` и требуют лишь прав записи в каталоги проекта.

<a id="модули"></a>

## 2. Список модулей

### <a id="config‑loaderjs"></a>`config‑loader.js`

```js
const { loadConfig, clearSecrets, generatePassword } = require('./config-loader');
```

- **Назначение** – собрать единый объект конфигурации из `res/01__config/settings_ha.json`, автоматически генерировать пароли и формировать массив `instances` для каждого хаба.
- **Ключевые функции**
  - `loadConfig()` – проверка `settings_ha.json`, генерация паролей через `SecretManager`, построение массива `instances` (поля: `dbName`, `port`, `username`, `operator`, …).
  - `clearSecrets()` – удаляет `generated_secrets.json` и `CREDENTIALS.md` для чистого старта.
  - `generatePassword(len)` – случайный пароль из `A‑Z a‑z 0‑9 !@#$%^&*`.
- **Пример**

```js
const cfg = loadConfig();
console.log(cfg.instances[0]); // первая инстанция
```

---

### <a id="init‑orchestratorjs"></a>`init‑orchestrator.js`

```bash
node js/app/01__Common/init-orchestrator.js
```

- **Назначение** – единственная точка входа, которая последовательно:
  1. Проверяет `settings_ha.json` (флаги `sessionGengeration` должны быть `true`).
  2. Запрашивает подтверждение пользователя для генерации.
  3. Вызывает `SecretManager` → генерирует пароли, сохраняет `generated_secrets.json`, `CREDENTIALS.md`, `dbVMPass.csv`.
  4. Вызывает `ServiceGenerator` → генерирует файлы `*.service` в `js/app/LinuxScript/NodeRedServices/<hub>/`.
  5. Сбрасывает `sessionGengeration` в `settings_ha.json`.
- **Требования** – Node ≥ 14, права записи в `res/01__config` и `js/app/LinuxScript/NodeRedServices`.

---

### <a id="service‑generatorjs"></a>`service‑generator.js`

```js
const { generate } = require('./service-generator');
```

- **Назначение** – автоматическое создание `systemd`‑служб для каждой инстанции Node‑RED.
- **Ключевые функции**
  - `cleanup()` – удаляет старые каталоги `NodeRedServices/<hub>` и создает их заново.
  - `generate(config, hubsArray)` – принимает объект конфигурации и массив хабов, формирует шаблон сервиса с полями `User`, `Group`, `WorkingDirectory`, `ExecStart` и сохраняет в соответствующие каталоги.
- **Пример**

```js
const cfg = require('./config-loader').loadConfig();
generate(cfg, ['hubLOW', 'hubMID']);
```

---

### <a id="secret‑managerjs"></a>`secret‑manager.js`

```js
const secretMgr = require('./secret-manager');
```

- **Назначение** – централизованная работа с паролями и их экспорт.
- **Ключевые методы**
  - `generatePassword(len)` – случайный пароль.
  - `saveSecrets(obj)` – запись `generated_secrets.json`.
  - `saveCredentials(arr)` – формирует `CREDENTIALS.md` (таблица Markdown).
  - `archivePassword(data)` – добавляет запись в `dbVMPass.csv`.
  - `resetGenerationFlags(config, hubs)` – сбрасывает `sessionGengeration`.
  - `checkAndConfirmGeneration(config)` – проверка, что хотя бы один хаб готов к генерации.
- **Экспорт** – `module.exports = new SecretManager();`

---

<a id="алгоритм-инициализации"></a>

## 3. Алгоритм типичной инициализации

1. **Установить зависимости**: `npm install`.
2. **Очистить старые секреты** (если нужно):
   ```bash
   node -e "require('./js/app/01__Common/config-loader').clearSecrets()"
   ```
3. **Запустить оркестратор**:
   ```bash
   node js/app/01__Common/init-orchestrator.js
   ```
   Подтвердите (`Y`) для каждого хаба.
4. **Проверить результаты**:
   - `res/01__config/generated_secrets.json`
   - `res/01__config/CREDENTIALS.md`
   - `res/01__config/dbVMPass.csv`
   - `js/app/LinuxScript/NodeRedServices/<hub>/*.service`
5. **Готово** – флаги `sessionGengeration` сброшены, повторный запуск оркестратора не создаст дубликаты.

---

<a id="требования"></a>

## 4. Требования к окружению

| Компонент | Минимальная версия                                               | Примечание                                                        |
| --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Node.js   | 14.x                                                             | Указана в `package.json`.                                         |
| npm       | ≥ 6.x                                                            | Для установки зависимостей.                                       |
| Права     | запись в `res/01__config` и `js/app/LinuxScript/NodeRedServices` | Отсутствие прав → ошибка записи.                                  |
| ОС        | Windows 7/10+ или любой \*nix                                    | Скрипты работают через `node`; `sudo` не нужен в локальной среде. |

---

<a id="faq"></a>

## 5. FAQ

**Q:** _Нужен ли `sudo` для создания `.service`‑файлов?_\
**A:** Нет. Скрипты пишут в папку проекта. На целевом Linux‑хабе `sudo` требуется только для `systemctl daemon-reload` и `systemctl restart`.

**Q:** _Как перезапустить сервисы после изменения `settings_ha.json`?_\
**A:** На хабе выполните:

```bash
sudo systemctl daemon-reload
sudo systemctl restart nodered1.service   # и остальные нужные сервисы
```

**Q:** _Можно ли добавить новые параметры в `settings_ha.json`?_\
**A:** Да. Добавьте их в объект хаба; скрипты автоматически используют новые поля без изменений кода.

**Q:** _Что делать, если `init‑orchestrator.js` падает с ошибкой «invalid JSON»?_\
**A:** Проверьте синтаксис `res/01__config/settings_ha.json` (особенно запятые и кавычки). Убедитесь, что все обязательные поля (`sessionGengeration`, `system.instancesCount`, …) присутствуют.

---

**Контакты**

- Техподдержка: helpdesk@mas-tech.ru
- Запуск: `node js/app/01__Common/init-orchestrator.js`
