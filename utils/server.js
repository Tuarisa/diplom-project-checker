const express = require('express');
const path = require('path');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');
const { WORKING_DIR } = require('./paths');

const app = express();
const port = 3000;

// Создаем сервер livereload
const liveReloadServer = livereload.createServer();
liveReloadServer.watch(WORKING_DIR);

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

// Запускаем сервер
app.listen(port, () => {
    console.log(`\n🚀 Server started at http://localhost:${port}`);
    console.log(`📁 Serving files from: ${WORKING_DIR}\n`);
}); 