# Styles Optimization

Модуль для оптимизации CSS и SCSS файлов дипломного проекта. Расположен в `utils/optimize/styles.js`.

## Основные функции

### Форматирование кода
- Использует prettier для форматирования CSS и SCSS
- Настройки форматирования:
  - Ширина строки: 80 символов
  - Отступы: 4 пробела
  - Одинарные кавычки
  - Точка с запятой в конце правил
  - Один селектор на строку
  - Одно свойство на строку
  - Lowercase для HEX-цветов
  - Сокращенная запись HEX-цветов где возможно

### Оптимизация цветов
- Заменяет именованные цвета на HEX-эквиваленты:
  - `black` → `#000000`
  - `white` → `#ffffff`
  - `red` → `#ff0000`
  - `green` → `#008000`
  - `blue` → `#0000ff`
  - И другие стандартные цвета CSS

### Оптимизация SVG
- Находит все SVG-иконки, используемые через `url()`
- Заменяет пути на ссылки на спрайт:
  - До: `url('icons/menu.svg')`
  - После: `url("../images/icons/sprite.svg#icon-menu")`
- Работает только для SVG в директории `icons/`

### Проверка стилей
- Запускает stylelint для проверки кода
- Выводит список ошибок и предупреждений
- Не исправляет ошибки автоматически

### Игнорируемые файлы
- `normalize.css` - пропускается при оптимизации

## Использование

```bash
yarn optimize:styles
```

## Примеры преобразований

### Форматирование кода
До:
```scss
.header{
    background-color:white;
    .nav{
        display:flex;
        &__item{color:black}
    }
}
```
После:
```scss
.header {
    background-color: #ffffff;

    .nav {
        display: flex;

        &__item {
            color: #000000;
        }
    }
}
```

### Оптимизация SVG
До:
```scss
.icon {
    background-image: url('icons/menu.svg');
}
```
После:
```scss
.icon {
    background-image: url("../images/icons/sprite.svg#icon-menu");
}
```

## Структура директорий
```
diploma-project/
├── styles/
│   ├── style.scss     # Исходные стили
│   └── blocks/        # SCSS-блоки
└── assets/
    └── styles/        # Скомпилированные и минифицированные стили
```

## Поддерживаемые цвета
| Имя цвета | HEX-значение |
|-----------|--------------|
| black     | #000000      |
| white     | #ffffff      |
| red       | #ff0000      |
| green     | #008000      |
| blue      | #0000ff      |
| yellow    | #ffff00      |
| purple    | #800080      |
| gray      | #808080      |
| silver    | #c0c0c0      |
| maroon    | #800000      |
| olive     | #808000      |
| lime      | #00ff00      |
| aqua      | #00ffff      |
| teal      | #008080      |
| navy      | #000080      |
| fuchsia   | #ff00ff      | 