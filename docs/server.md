# Development Server

Модуль локального сервера разработки с автоматической перезагрузкой и компиляцией стилей. Расположен в `utils/server.js`.

## Основные функции

### Сервер разработки
- Запускает Express-сервер для раздачи статических файлов
- Настраивает CORS для локальной разработки
- Обслуживает файлы из рабочей директории проекта
- Поддерживает маршрутизацию для SPA (всегда возвращает index.html)

### LiveReload
- Автоматически перезагружает страницу при изменениях
- Отслеживает изменения в:
  - HTML-файлах в корневой директории
  - SCSS-файлах в директории `styles/`
  - CSS-файлах в директории `assets/styles/`
- Добавляет скрипт LiveReload на страницу автоматически

### Компиляция стилей
- Отслеживает изменения в SCSS-файлах
- При изменении:
  - Компилирует SCSS в CSS
  - Минифицирует CSS
  - Сохраняет в `assets/styles/`
  - Перезагружает страницу

### Минификация CSS
- Минифицирует CSS-файлы при изменении
- Обрабатывает:
  - `normalize.css` → `normalize.min.css`
  - `style.css` → `style.min.css`
- Сохраняет минифицированные версии в `assets/styles/`

## Использование

### Запуск сервера
```bash
yarn start
```

### Настройка (через .env)
```bash
# Порт для сервера разработки
PORT=3000

# Порт для LiveReload
LIVERELOAD_PORT=35729
```

## Структура файлов
```
diploma-project/
├── index.html           # Главная страница
├── styles/
│   └── style.scss      # Исходные стили
└── assets/
    └── styles/
        ├── style.min.css       # Минифицированные стили
        └── normalize.min.css   # Минифицированный normalize
```

## События и обработчики

### Отслеживание файлов
| Тип файла | Директория | Действие при изменении |
|-----------|------------|------------------------|
| HTML      | `/`        | Перезагрузка страницы  |
| SCSS      | `styles/`  | Компиляция + минификация + перезагрузка |
| CSS       | `assets/styles/` | Минификация + перезагрузка |

### Порядок обработки
1. Файл изменен
2. Запускается соответствующий обработчик
3. Выполняются необходимые преобразования
4. Сохраняются результаты
5. Отправляется сигнал на перезагрузку
6. Браузер обновляет страницу

## Особенности
- Сервер автоматически создаёт отсутствующие директории
- При ошибках компиляции SCSS выводит подробные сообщения
- Поддерживает source maps для удобной отладки
- Сохраняет консистентность файлов при параллельных изменениях 