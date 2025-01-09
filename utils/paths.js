const path = require('path');
const glob = require('glob');
require('dotenv').config();

// Базовые пути
const WORKING_DIR = process.env.WORKING_DIR;
const ASSETS_DIR = process.env.ASSETS_DIR || 'assets';
const STYLES_DIR = process.env.STYLES_DIR || 'styles';
const IMAGES_DIR = process.env.IMAGES_DIR || 'images';
const HTML_DIR = process.env.HTML_DIR || '.';
const SPRITE_PATH = process.env.SPRITE_PATH || 'assets/images/icons/sprite.svg';

// Функции для работы с путями
function resolveWorkingPath(...parts) {
    return path.join(WORKING_DIR, ...parts);
}

function resolveAssetsPath(...parts) {
    return resolveWorkingPath(ASSETS_DIR, ...parts);
}

function resolveStylesPath(...parts) {
    return resolveWorkingPath(STYLES_DIR, ...parts);
}

function resolveImagesPath(...parts) {
    return resolveWorkingPath(IMAGES_DIR, ...parts);
}

function resolveHtmlPath(...parts) {
    return resolveWorkingPath(HTML_DIR, ...parts);
}

function getRelativePath(absolutePath) {
    return path.relative(WORKING_DIR, absolutePath);
}

function getSpritePath() {
    return resolveWorkingPath(SPRITE_PATH);
}

// Функция для получения файлов проекта по паттерну
function getProjectFiles(pattern) {
    return glob.sync(pattern, {
        cwd: WORKING_DIR,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.*/**']
    });
}

// Функция для проверки существования директории
async function ensureDirectoryExists(dirPath) {
    const fs = require('fs').promises;
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

module.exports = {
    WORKING_DIR,
    ASSETS_DIR,
    STYLES_DIR,
    IMAGES_DIR,
    HTML_DIR,
    SPRITE_PATH,
    resolveWorkingPath,
    resolveAssetsPath,
    resolveStylesPath,
    resolveImagesPath,
    resolveHtmlPath,
    getRelativePath,
    getSpritePath,
    getProjectFiles,
    ensureDirectoryExists
}; 