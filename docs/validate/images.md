# Images Validation

Модуль для проверки изображений на соответствие требованиям. Расположен в `utils/validate/images.js`.

## Проверки

### 1. Форматы и оптимизация
- Наличие WebP версий:
  - Для всех JPG/JPEG
  - Для всех PNG
  - С правильным качеством сжатия
- Оптимизация оригиналов:
  - JPEG с прогрессивной загрузкой
  - PNG с оптимальным сжатием
  - Удаление метаданных
- Размеры файлов:
  - JPEG/PNG не более 500KB
  - WebP не более 200KB
  - SVG не более 10KB

### 2. Размеры изображений
- Максимальные размеры:
  - Ширина не более 1920px
  - Высота не более 1080px
- Минимальные размеры:
  - Не менее 2x размера в макете
  - Достаточное разрешение для retina
- Пропорции:
  - Соответствие макету
  - Отсутствие искажений
  - Правильные соотношения сторон

### 3. SVG-иконки
- Наличие в спрайте:
  - Все иконки собраны в один спрайт
  - Правильные ID для каждой иконки
  - Корректные viewBox
- Оптимизация:
  - Удаление лишних атрибутов
  - Минификация путей
  - Удаление комментариев
  - Правильные цвета (currentColor)
- Доступность:
  - Наличие title
  - Корректные aria-label
  - Правильные роли

### 4. Имена файлов
- Правильный формат:
  - Только латинские буквы
  - Нижний регистр
  - Слова через дефис
  - Без пробелов и спецсимволов
- Правильная структура:
  - Контентные изображения в `images/`
  - Иконки в `images/icons/`
  - Оптимизированные в `assets/images/`

### 5. Использование в HTML/CSS
- Правильные пути:
  - Относительные пути в HTML
  - Корректные пути в CSS
  - Правильные пути к WebP
- Атрибуты:
  - Корректные width/height
  - Правильные alt тексты
  - Ленивая загрузка где нужно
- Оформление:
  - Правильное масштабирование
  - Корректные object-fit
  - Поддержка retina

## Примеры ошибок

### Неправильно:
```
images/
  └── HEADER LOGO.jpg  # Неверное имя файла
  └── icon.svg         # SVG не в папке icons
  └── photo.jpg        # Нет WebP версии
```

### Правильно:
```
images/
  └── header-logo.jpg
  └── header-logo.webp
  └── icons/
      └── menu.svg
assets/
  └── images/
      └── icons/
          └── sprite.svg
```

## Использование

```bash
yarn validate:images
```

## Конфигурация

### Настройка правил (через .env)
```bash
# Максимальные размеры файлов (в байтах)
MAX_JPEG_SIZE=500000
MAX_PNG_SIZE=500000
MAX_WEBP_SIZE=200000
MAX_SVG_SIZE=10000

# Максимальные размеры изображений (в пикселях)
MAX_IMAGE_WIDTH=1920
MAX_IMAGE_HEIGHT=1080

# Качество WebP (в процентах)
WEBP_QUALITY=80
```

## Особенности
- Рекурсивная проверка всех поддиректорий
- Проверка соответствия WebP оригиналам
- Валидация SVG на корректность разметки
- Проверка оптимальности сжатия
- Рекомендации по улучшению изображений
- Учет особенностей различных браузеров 