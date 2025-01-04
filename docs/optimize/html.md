# HTML Optimization

Модуль для оптимизации HTML-файлов дипломного проекта. Расположен в `utils/optimize/html.js`.

## Основные функции

### Оптимизация SVG-иконок
- Находит все `<img>` теги с SVG-файлами (`img[src$=".svg"]`)
- Заменяет их на `<svg>` с использованием спрайта
- Копирует все атрибуты из оригинального изображения (кроме `src` и `alt`)
- Добавляет стандартные размеры (24x24), если не указаны
- Обеспечивает доступность:
  - Если был `alt` - добавляет `aria-label` и `role="img"`
  - Если не было `alt` - добавляет `aria-hidden="true"`

### Форматирование тегов в head
- Форматирует `<link>` и `<meta>` теги в одну строку
- Убирает лишние пробелы и переносы строк
- Сохраняет правильные отступы (4 пробела)
- Не добавляет пустые строки между тегами

### Оптимизация путей к стилям
- Заменяет пути к CSS-файлам на минифицированные версии:
  - `normalize.css` → `assets/styles/normalize.min.css`
  - `styles/*.css` → `assets/styles/*.min.css`

### Оптимизация ссылок
- Заменяет `href="#"` на `href="javascript:void(0)"`
- Добавляет `target="_blank"` для внешних ссылок (начинающихся с `http://` или `https://`)

### Очистка разметки
- Убирает пустые атрибуты (`=""`)
- Заменяет HTML-сущности (`&amp;` → `&`)
- Убирает закрывающие слеши у void-элементов (`<br/>` → `<br>`)

## Использование

```bash
yarn optimize:html
```

## Примеры преобразований

### SVG-иконки
До:
```html
<img src="icons/menu.svg" alt="Открыть меню" class="header__icon">
```
После:
```html
<svg class="header__icon" width="24" height="24" aria-label="Открыть меню" role="img">
    <use href="/assets/images/icons/sprite.svg#icon-menu"></use>
</svg>
```

### Форматирование head
До:
```html
<head>
    <link 
        rel="stylesheet" 
        href="normalize.css">

    <link 
        rel="stylesheet" 
        href="styles/style.css">
</head>
```
После:
```html
<head>
    <link rel="stylesheet" href="assets/styles/normalize.min.css">
    <link rel="stylesheet" href="assets/styles/style.min.css">
</head>
``` 