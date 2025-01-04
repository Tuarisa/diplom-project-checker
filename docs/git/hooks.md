# Git Hooks

Модуль для установки и настройки Git-хуков в дипломном проекте. Расположен в `utils/setup-git-hooks.js` и `utils/commit-msg`.

## Основные функции

### Установка хуков
- Проверяет наличие директории `.git`
- Создает директорию `.git/hooks` если её нет
- Копирует хук `commit-msg` из `utils/commit-msg` в `.git/hooks`
- Устанавливает права на выполнение (chmod 755)

### Валидация сообщений коммитов
Хук `commit-msg` проверяет сообщение коммита на соответствие следующим правилам:

#### Формат сообщения
```
<тип>: <описание>

[опциональное тело]

[опциональный футер]
```

#### Поддерживаемые типы
- `feat` - новая функциональность
- `fix` - исправление бага
- `docs` - изменения в документации
- `style` - форматирование, отступы и т.д.
- `refactor` - рефакторинг кода
- `test` - добавление тестов
- `chore` - обновление зависимостей и т.д.

#### Правила валидации
- Тип должен быть из списка поддерживаемых
- Описание должно:
  - Начинаться с маленькой буквы
  - Быть на английском языке
  - Использовать повелительное наклонение
  - Не заканчиваться точкой
  - Быть не длиннее 60 символов

## Использование

### Установка хуков
```bash
yarn setup-git
```

### Примеры сообщений коммитов

✅ Правильно:
```
feat: add image optimization
fix: resolve path resolution in Windows
docs: update README with new commands
style: format HTML according to guidelines
refactor: extract color conversion logic
test: add unit tests for validation
chore: update dependencies
```

❌ Неправильно:
```
Added new feature           # нет типа
feat: Добавил оптимизацию  # не на английском
feat: Add new feature.     # точка в конце
FIX: broken styles         # тип с большой буквы
feat: this is a very very very very very very very long commit message  # слишком длинное
```

## Структура файлов
```
diploma-project/
├── .git/
│   └── hooks/
│       └── commit-msg     # Установленный хук
└── utils/
    ├── setup-git-hooks.js # Скрипт установки
    └── commit-msg         # Исходный файл хука
```

## Отключение проверок
В экстренных случаях можно пропустить проверку, добавив флаг `--no-verify`:
```bash
git commit -m "feat: add something" --no-verify
```
⚠️ Не рекомендуется использовать этот флаг в обычной работе 