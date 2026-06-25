---
name: merge-readme
description: Объединить README-config-loader.md и README-init-orchestrator.md в единый README-сommon.md и обновить ссылки в корневом README.md
source: auto-skill
extracted_at: '2026-06-17T18:35:00.000Z'
---

## Цель
Объединить содержимое файлов `README-config-loader.md` и `README-init-orchestrator.md` в один документ `README-сommon.md` в каталоге `js/app/01__Common`, затем обновить ссылки в корневом `README.md` проекта.

## Шаги
1. **Считать исходные файлы** `README-config-loader.md` и `README-init-orchestrator.md`.
2. **Сформировать объединённый контент**:
   - Сохранить метаданные проекта (шапку с ООО, проект, ревизию, версию, дату).
   - Добавить разделы:
     * **ConfigLoader** – назначение, основные функции.
     * **Init‑Orchestrator** – назначение, функционал.
     * **Иные вспомогательные модули** – `secret-manager.js`, `service-generator.js`.
   - Добавить ссылки на соответствующие файлы.
3. **Записать файл** `js/app/01__Common/README-сommon.md` (имя соответствует соглашениям проекта – тире и строчные символы после `README-`).
4. **Удалить/пометить устаревшими** старые файлы `README-config-loader.md` и `README-init-orchestrator.md` (в данном случае они оставлены как устаревшие, можно удалить вручную).
5. **Обновить корневой README.md**:
   - Найти ссылки вида `js/app/01__Common/README-config-loader.md` и `js/app/01__Common/README-init-orchestrator.md`.
   - Заменить их одной ссылкой на `js/app/01__Common/README-сommon.md`.
6. **Закоммитить изменения** (если требуется) с сообщением «Объединены README‑файлы в README‑сommon.md и обновлены ссылки». 

## Примечания
- Важно соблюдать регистр и символы в имени файла (`README-сommon.md`), так как проект использует только строчные буквы после `README-`.
- При необходимости можно добавить в `README-сommon.md` раздел **Иные вспомогательные модули**, чтобы отразить полностью всё, что находится в модуле `01__Common`.
- После выполнения проверяем, что `npm run lint` и `npm test` проходят без ошибок, чтобы убедиться в корректности импортов.
