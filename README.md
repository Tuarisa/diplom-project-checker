# Diploma Project Checker

Инструмент для проверки и оптимизации дипломных проектов.

## Документация

### Основные модули
- [Сервер разработки](docs/server.md)
- [Git хуки](docs/git/hooks.md)

### Валидация
- [HTML валидация](docs/validate/html.md)
  - [W3C валидация](docs/validate/w3c.md)
  - [BEM валидация](docs/validate/bem.md)
- [CSS/SCSS валидация](docs/validate/styles.md)
- [Валидация изображений](docs/validate/images.md)
- [Валидация структуры проекта](docs/validate/structure.md)

### Оптимизация
- [HTML оптимизация](docs/optimize/html.md)
- [Оптимизация изображений](docs/optimize/images.md)
- [Оптимизация стилей](docs/optimize/styles.md)

## Установка

```bash
git clone https://github.com/your-username/diplom-project-checker.git
cd diplom-project-checker
yarn install
```

## Использование

### Полная проверка проекта
```bash
yarn validate
```

### Частичная валидация
```bash
# HTML валидация
yarn validate:html

# W3C валидация
yarn validate:w3c

# BEM валидация
yarn validate:bem

# Валидация стилей
yarn validate:styles

# Валидация изображений
yarn validate:images

# Валидация структуры
yarn validate:structure
```

### Запуск сервера разработки
```bash
yarn start
```

### Оптимизация проекта
```bash
yarn optimize
```

### Форматирование кода
```bash
yarn format
```

### Полная настройка проекта
```bash
yarn setup
```

## Конфигурация

Настройки проекта можно изменить через файл `.env`. Подробнее в документации каждого модуля.

## Особенности
- Автоматическая валидация при коммите
- Интеграция с W3C валидатором
- Проверка BEM методологии
- Оптимизация изображений и создание WebP
- Минификация CSS и HTML
- Создание SVG-спрайтов
- Проверка доступности
- Линтинг кода
- Форматирование кода
- Единый формат логирования ошибок
- Кэширование результатов валидации

## Требования
- Node.js >= 14
- Yarn >= 1.22
- Git >= 2.0 