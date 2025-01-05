# BEM Validation

Модуль для проверки соответствия HTML-классов методологии BEM. Расположен в `utils/validate/bem.js`.

## Функциональность

### Проверка именования
- Соответствие формату `block-name__element-name--modifier-name`
- Валидация блоков (только строчные буквы и дефисы)
- Валидация элементов (двойное подчеркивание и корректное именование)
- Валидация модификаторов (двойное тире и корректное именование)

### Дополнительные проверки
- Выявление презентационных классов
- Проверка излишней вложенности элементов
- Поиск неиспользуемых классов
- Анализ структуры компонентов

## Правила именования

### Блоки
```css
.block-name {}
```
- Только строчные буквы
- Слова разделяются дефисом
- Осмысленные имена, отражающие назначение

### Элементы
```css
.block-name__element-name {}
```
- Двойное подчеркивание после имени блока
- Только строчные буквы
- Слова разделяются дефисом
- Описывают часть блока

### Модификаторы
```css
.block-name--modifier {}
.block-name__element-name--modifier {}
```
- Двойное тире перед модификатором
- Только строчные буквы
- Слова разделяются дефисом
- Описывают состояние или вариацию

## Использование

### Запуск валидации
```bash
yarn validate:bem
```

## Формат вывода

### Пример успешной валидации
```
✓ BEM Validation: index.html
  All class names follow BEM convention
```

### Пример с ошибками
```
❌ BEM Validation: index.html
  Line 15: Invalid BEM class name: "menuItem"
  Context: <div class="menuItem">
  Suggestion: Use "menu-item" instead

  Line 28: Presentational class name detected: "fz-large"
  Context: <h1 class="title fz-large">
  Suggestion: Move font-size to a modifier class

  Line 45: Unnecessary wrapper element detected
  Context: <div class="wrapper"><div class="content">...</div></div>
  Suggestion: Remove redundant wrapper
```

## Особенности
- Гибкая настройка правил проверки
- Подробные сообщения об ошибках с рекомендациями
- Проверка всех HTML файлов в проекте
- Выявление типичных ошибок в BEM-структуре
- Интеграция с общей системой валидации
- Поддержка кастомных правил именования 