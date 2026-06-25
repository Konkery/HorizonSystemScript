---
name: update-common-js
description: Обновление бизнес‑логики скриптов Common (init‑orchestrator, secret‑manager, config‑loader) под новую структуру settings_ha.json
source: auto-skill
extracted_at: '2026-06-23T17:30:00.000Z'
---

## Цель
Перевести скрипты из `js/app/01__Common` в соответствие с новой конфигурацией `settings_ha.json`:
- чтение нового файла и валидация новых полей;
- корректная генерация пользователей, БД и коллекций;
- правильный сброс флага `sessionGeneration`;
- парсинг `externalServices` и `nodeRed.startPort` в `secret-manager.js`.

## Шаги реализации
1. **config‑loader.js**
   - Поменять путь на `settings_ha.json`.
   - Обновить список обязательных ключей: `projectID`, `machineNAME`, `description`, `hubLow`, `hubMid`, `hubHi`.
   - Добавить проверку, что хотя бы один хаб активен (использовать нижний регистр названий).
2. **init‑orchestrator.js**
   - Вынести функцию `generateHub(config, hubName)`.
   - Собирать список пользователей (static/dynamic) из `globalUsers` и `system.users`.
   - Формировать имя БД как `${machineNAME}${dbPostfix}`.
   - Перебрать `collectionGeneral_HA.list` и вывести тип/параметры (TimeSeries, Capped, Standart).
   - При наличии `systemDatabases.systemVM` генерировать системную БД только у одного хаба.
   - После успешного завершения: `hubConfig.sessionGeneration = false; await ConfigLoader.save(config);`.
3. **secret‑manager.js**
   - Исправить опечатку `sessionGengeration` → `sessionGeneration` (в обеих функциях).
   - Унифицировать список хабов: `['hubLow','hubMid','hubHi']`.
   - В `checkAndConfirmGeneration` и `resetGenerationFlags` использовать новые названия.
   - Добавить парсинг `externalServices.settingsServices.nodeRed.startPort` для генерации портов Node‑Red (при формировании `baseConfig`).
   - При формировании списка хабов в `prepareFullDataStructure` и `saveCredentials` также использовать новые имена.
4. **Тесты и линт**
   - Обновить мок‑данные `settings_ha.json` в тестах.
   - Запустить `npm test`/`eslint` и убедиться, что все файлы проходят проверку.
5. **Документация**
   - При необходимости добавить ссылки в `README‑common.md` (не в рамках текущего шага).

## Почему так?
- **Точность:** Используем реальные имена хабов из конфигурации, а не старые константы (`hubLOW`).
- **Поддерживаемость:** Весь код разбит на небольшие функции, каждый файл отвечает только за одну задачу (SRP).
- **Безопасность:** Сброс флага происходит только после полной генерации, и конфиг сохраняется атомарно.
- **Гибкость:** При добавлении новых сервисов (`externalServices`) логика парсинга уже подготовлена.

## Применение
1. Выполнить `git checkout -b feature/update-common-js`.
2. Применить патчи (см. реализацию в репозитории).
3. Запустить `npm run lint && npm test`.
4. Слить ветку после ревью.

---
*Этот навык создан автоматически, чтобы сохранять подход к миграции скриптов Common под новую конфигурацию.*