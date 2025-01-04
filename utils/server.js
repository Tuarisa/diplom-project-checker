const express = require('express');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');
const path = require('path');
const { execSync } = require('child_process');
const { watch } = require('fs');
const fs = require('fs').promises;
const { WORKING_DIR } = require('./paths');

// Create live-reload server watching HTML and CSS
const liveReloadServer = livereload.createServer({
    exts: ['html', 'css', 'scss'],
    delay: 100,
    port: 35729,
    exclusions: ['**/*.min.css', '**/node_modules/**']
});

// Set directories to watch
const watchDirs = [
    WORKING_DIR,                                    // Root directory for HTML
    path.join(WORKING_DIR, 'assets'),              // Assets directory for compiled CSS
    path.join(WORKING_DIR, 'styles'),              // Styles directory for SCSS
];

// Watch all directories
liveReloadServer.watch(watchDirs);

const app = express();
const port = 3000;

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'tree/templates'));

// Import tree module
const treeRouter = require('./tree');

// Функция для компиляции SCSS
async function compileSass() {
    try {
        const assetsStylesDir = path.join(WORKING_DIR, 'assets', 'styles');
        await fs.mkdir(assetsStylesDir, { recursive: true });
        
        // Компилируем SCSS в CSS
        execSync(`sass ${path.join(WORKING_DIR, 'styles/style.scss')} ${path.join(WORKING_DIR, 'assets/styles/style.css')}`, {
            stdio: 'inherit'
        });
        
        console.log('✨ SCSS compiled successfully!');
        return true;
    } catch (error) {
        console.error('Error compiling SCSS:', error.message);
        return false;
    }
}

// Функция для минификации CSS
async function minifyCSS() {
    try {
        const assetsStylesDir = path.join(WORKING_DIR, 'assets', 'styles');
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
        
        // Trigger livereload for CSS files
        liveReloadServer.refresh('*.css');
    } catch (error) {
        console.error('Error minifying CSS:', error.message);
    }
}

// Connect live-reload middleware
app.use(connectLivereload({
    port: 35729
}));

// Mount tree module
app.use('/tree', treeRouter);

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

// Watch HTML files in root directory
watch(WORKING_DIR, { recursive: false }, (eventType, filename) => {
    if (filename && filename.endsWith('.html')) {
        console.log('HTML file changes detected:', filename);
        liveReloadServer.refresh(filename);
    }
});

// Watch for changes in SCSS files
watch(path.join(WORKING_DIR, 'styles'), { recursive: true }, async (eventType, filename) => {
    if (filename && filename.endsWith('.scss')) {
        console.log('SCSS file changes detected, recompiling...');
        const compiled = await compileSass();
        if (compiled) {
            await minifyCSS();
        }
    }
});

// Инициализация: компилируем SCSS и минифицируем CSS при запуске
(async () => {
    const compiled = await compileSass();
    if (compiled) {
        await minifyCSS();
    }
})();

// Запускаем сервер
app.listen(port, () => {
    console.log(`\n🚀 Server started at http://localhost:${port}`);
    console.log(`📁 Serving files from: ${WORKING_DIR}`);
    console.log('👀 Watching for file changes...\n');
}); 