const path = require('path');
require('dotenv').config();

// Базовые пути
const WORKING_DIR = process.env.WORKING_DIR;
const ASSETS_DIR = process.env.ASSETS_DIR || 'assets';
const STYLES_DIR = process.env.STYLES_DIR || 'styles';
const IMAGES_DIR = process.env.IMAGES_DIR || 'images';
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

function getRelativePath(absolutePath) {
    return path.relative(WORKING_DIR, absolutePath);
}

function getSpritePath() {
    return resolveWorkingPath(SPRITE_PATH);
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
    SPRITE_PATH,
    resolveWorkingPath,
    resolveAssetsPath,
    resolveStylesPath,
    resolveImagesPath,
    getRelativePath,
    getSpritePath,
    ensureDirectoryExists
}; 