const express = require('express');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');
const path = require('path');
const { execSync } = require('child_process');
const { watch } = require('fs');
const fs = require('fs').promises;
const { WORKING_DIR, STYLES_DIR, ASSETS_DIR, IMAGES_DIR } = require('./paths');
const { purgeStyles } = require('./optimize/purgecss');

console.log(WORKING_DIR, STYLES_DIR, ASSETS_DIR, IMAGES_DIR);

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
    path.join(WORKING_DIR, ASSETS_DIR),              // Assets directory for compiled CSS
    path.join(WORKING_DIR, STYLES_DIR),              // Styles directory for SCSS
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

// Функция для компиляции SCSS с использованием purgeStyles
async function compileSass() {
    try {
        await purgeStyles();
        console.log('✨ SCSS compiled and processed successfully!');
        return true;
    } catch (error) {
        console.error('Error processing SCSS:', error.message);
        return false;
    }
}

// Функция для минификации normalize.css
async function minifyNormalize() {
    try {
        const assetsStylesDir = path.join(WORKING_DIR, 'assets', 'styles');
        await fs.mkdir(assetsStylesDir, { recursive: true });
        
        // Минифицируем только normalize.css
        execSync(`cleancss -o ${path.join(assetsStylesDir, 'normalize.min.css')} ${path.join(WORKING_DIR, 'styles', 'normalize.css')}`, {
            stdio: 'inherit'
        });
        
        console.log('✨ normalize.css minified successfully!');
        
        // Trigger livereload for CSS files
        liveReloadServer.refresh('*.css');
    } catch (error) {
        console.error('Error minifying normalize.css:', error.message);
    }
}

// Connect live-reload middleware
app.use(connectLivereload({
    port: 35729
}));

// Mount tree module
app.use('/tree', treeRouter);

// Настраиваем статические пути
app.use('/'+ASSETS_DIR, express.static(path.join(WORKING_DIR, ASSETS_DIR)));
app.use('/'+IMAGES_DIR, express.static(path.join(WORKING_DIR, IMAGES_DIR)));
app.use('/'+STYLES_DIR, express.static(path.join(WORKING_DIR, STYLES_DIR)));

// Обработка favicon.ico
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(WORKING_DIR, 'favicon.ico'));
});

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
watch(WORKING_DIR, { recursive: false }, async (eventType, filename) => {
    if (filename && filename.endsWith('.html')) {
        console.log('HTML file changes detected:', filename);
        // При изменении HTML перекомпилируем стили, так как могли измениться используемые классы
        await compileSass();
        liveReloadServer.refresh(filename);
    }
});

// Watch for changes in SCSS files
watch(path.join(WORKING_DIR, STYLES_DIR), { recursive: true }, async (eventType, filename) => {
    if (filename && filename.endsWith('.scss')) {
        console.log('SCSS file changes detected, recompiling...');
        await compileSass();
    }
});

// Инициализация: компилируем SCSS и минифицируем CSS при запуске
(async () => {
    await minifyNormalize();
    await compileSass();
})();

// Запускаем сервер
app.listen(port, () => {
    console.log(`\n🚀 Server started at http://localhost:${port}`);
    console.log(`📁 Serving files from: ${WORKING_DIR}`);
    console.log('👀 Watching for file changes...\n');
}); 