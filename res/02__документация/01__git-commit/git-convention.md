# Правила оформления коммитов (Git Convention)

Проект 27/2025-N1-МАС придерживается спецификации [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.2/).

## Основные положения
1.  **Тип коммита:** Обязательно в нижнем регистре.
2.  **Грамматика:**
    *   **Время:** Настоящее время (Present tense) — `add feature`, не `added feature`.
    *   **Настроение:** Повелительное наклонение (Imperative mood) — `move cursor`, не `moves cursor`.
3.  **Формат сообщения:** `тип: описание`.
4.  **Локальная нумерация:** При необходимости использовать формат `[YYYYMMDD]-[Тип]-[Краткое описание]` для внутренней идентификации этапов.

## Список типов коммитов
- `init`: Начало проекта/задачи.
- `feat`: Новая функциональность (реализация согласно ТЗ).
- `fix`: Исправление ошибок в существующей функциональности.
- `refactor`: Рефакторинг кода (изменение структуры, именования, форматирования) без изменения функциональности.
- `docs`: Работа с документацией проекта (README, инструкции и т.д.).
- `val`: Предфинальная проверка, валидация инфраструктуры перед релизом.

---

## Примеры

### init:
- `init: start project configuration`

### feat:
- `feat: implement dynamic configuration loader`
- `feat: add systemd service generator`

### fix:
- `fix: correct mongodb connection string`
- `fix: adjust port settings for instance #2`

### refactor:
- `refactor: rename settings.json to settings_ha.json`
- `refactor: apply prettier formatting`

### docs:
- `docs: update deployment manual`
- `docs: update git commit conventions`

### val:
- `val: validate infrastructure before deployment`
