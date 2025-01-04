const express = require('express');
const path = require('path');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const { WORKING_DIR } = require('./paths');

const app = express();
const port = 3000;

// Создаем сервер livereload с игнорированием минифицированных файлов
const liveReloadServer = livereload.createServer({
    exclusions: ['**/*.min.css', '**/node_modules/**']
});
liveReloadServer.watch(WORKING_DIR);

// Добавляем debounce для предотвращения множественных вызовов
let minificationTimeout;
function debounceMinification(func, wait = 1000) {
    clearTimeout(minificationTimeout);
    minificationTimeout = setTimeout(func, wait);
}

// Функция для минификации CSS
async function minifyCSS() {
    try {
        const assetsStylesDir = path.join(WORKING_DIR, 'assets', 'styles');
        
        // Создаем директорию assets/styles, если её нет
        await fs.mkdir(assetsStylesDir, { recursive: true });
        
        // Минифицируем style.css
        execSync(`cleancss -o ${path.join(assetsStylesDir, 'style.min.css')} ${path.join(WORKING_DIR, 'assets', 'styles', 'style.css')}`, {
            stdio: 'inherit'
        });
        
        // Минифицируем normalize.css
        execSync(`cleancss -o ${path.join(assetsStylesDir, 'normalize.min.css')} ${path.join(WORKING_DIR, 'styles', 'normalize.css')}`, {
            stdio: 'inherit'
        });
        
        console.log('✨ CSS files minified successfully!');
    } catch (error) {
        console.error('Error minifying CSS:', error.message);
    }
}

// Добавляем middleware для livereload
app.use(connectLivereload());

// Настраиваем статические пути
app.use('/assets', express.static(path.join(WORKING_DIR, 'assets')));
app.use('/images', express.static(path.join(WORKING_DIR, 'images')));
app.use('/styles', express.static(path.join(WORKING_DIR, 'styles')));

// Обрабатываем все HTML файлы в корневой директории
app.get('/:page?.html', (req, res) => {
    const page = req.params.page || 'index';
    res.sendFile(path.join(WORKING_DIR, `${page}.html`));
});

// Редирект с / на index.html
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Отслеживаем изменения в CSS файлах
liveReloadServer.server.once("connection", () => {
    // Минифицируем CSS при первом подключении
    minifyCSS();
});

// Добавляем обработчик изменений для CSS файлов
liveReloadServer.watcher.on('change', async (file) => {
    // Игнорируем минифицированные файлы
    if (file.endsWith('.min.css')) return;
    
    // Проверяем только CSS и SCSS файлы
    if (file.endsWith('.css') || file.endsWith('.scss')) {
        debounceMinification(minifyCSS);
    }
});

// Запускаем сервер
app.listen(port, () => {
    console.log(`\n🚀 Server started at http://localhost:${port}`);
    console.log(`📁 Serving files from: ${WORKING_DIR}\n`);
}); 