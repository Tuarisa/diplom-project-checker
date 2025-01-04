const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');
const { 
    WORKING_DIR, 
    IMAGES_DIR,
    ASSETS_DIR,
    resolveWorkingPath,
    resolveImagesPath,
    resolveAssetsPath 
} = require('../paths');

async function validateImages() {
    try {
        const fileErrors = new Map();

        const addError = (file, message, lineNumber = '', context = '') => {
            if (!fileErrors.has(file)) {
                fileErrors.set(file, []);
            }
            const errors = fileErrors.get(file);
            const fullPath = resolveWorkingPath(file);
            
            let errorMsg = `   #${errors.length + 1} 🔴 ${fullPath}`;
            if (lineNumber) errorMsg += `:${lineNumber}`;
            errorMsg += `\n      • ${message}`;
            if (context) errorMsg += `\n      • Context: ${context.trim()}`;
            errors.push(errorMsg);
        };

        // Validate HTML files for image references
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));

        for (const file of htmlFiles) {
            const filePath = resolveWorkingPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            const dom = new JSDOM(content);
            const document = dom.window.document;

            // Check all img elements
            const images = document.querySelectorAll('img');
            for (const img of images) {
                const src = img.getAttribute('src');
                const alt = img.getAttribute('alt');
                const width = img.getAttribute('width');
                const height = img.getAttribute('height');
                const lineNumber = content.split('\n').findIndex(line => line.includes(img.outerHTML)) + 1;

                // Check for missing alt attribute
                if (!alt) {
                    addError(
                        file,
                        'Missing alt attribute',
                        lineNumber,
                        img.outerHTML
                    );
                }

                // Check for missing width/height attributes
                if (!width || !height) {
                    addError(
                        file,
                        'Missing width or height attribute',
                        lineNumber,
                        img.outerHTML
                    );
                }

                // Check if image file exists
                if (src) {
                    const imgPath = resolveImagesPath(src.replace(/^images\//, ''));
                    try {
                        await fs.access(imgPath);
                    } catch {
                        addError(
                            file,
                            `Image file not found: ${src}`,
                            lineNumber,
                            img.outerHTML
                        );
                    }
                } else {
                    addError(
                        file,
                        'Missing src attribute',
                        lineNumber,
                        img.outerHTML
                    );
                }
            }
        }

        // Рекурсивная функция для проверки изображений в директории
        async function validateImagesInDir(dirPath, relativePath = '', isAssetsDir = false) {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const itemRelativePath = path.join(relativePath, item);
                const stats = await fs.stat(fullPath);

                if (stats.isDirectory()) {
                    // Рекурсивно проверяем поддиректории
                    await validateImagesInDir(fullPath, itemRelativePath, isAssetsDir);
                } else {
                    const ext = path.extname(item).toLowerCase();
                    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];

                    // Пропускаем системные файлы
                    if (item === '.DS_Store' || item === 'Thumbs.db') {
                        addError(
                            path.join(isAssetsDir ? path.join(ASSETS_DIR, 'images') : IMAGES_DIR, itemRelativePath),
                            'System file found in images directory'
                        );
                        continue;
                    }

                    // Проверяем расширение файла
                    if (!validExtensions.includes(ext)) {
                        addError(
                            path.join(isAssetsDir ? path.join(ASSETS_DIR, 'images') : IMAGES_DIR, itemRelativePath),
                            'Invalid image file extension'
                        );
                        continue;
                    }

                    // Пропускаем проверку размеров для SVG
                    if (ext === '.svg') continue;

                    // Проверяем размеры и размер файла только для изображений в assets/images
                    if (isAssetsDir) {
                        try {
                            const metadata = await sharp(fullPath).metadata();

                            // Проверяем размеры изображения
                            if (metadata.width > 2000 || metadata.height > 2000) {
                                addError(
                                    path.join(path.join(ASSETS_DIR, 'images'), itemRelativePath),
                                    `Image dimensions too large: ${metadata.width}x${metadata.height}px`
                                );
                            }

                            // Проверяем размер файла
                            const stats = await fs.stat(fullPath);
                            const fileSizeMB = stats.size / (1024 * 1024);
                            if (fileSizeMB > 1) {
                                addError(
                                    path.join(path.join(ASSETS_DIR, 'images'), itemRelativePath),
                                    `Image file size too large: ${fileSizeMB.toFixed(2)}MB`
                                );
                            }
                        } catch (error) {
                            addError(
                                path.join(path.join(ASSETS_DIR, 'images'), itemRelativePath),
                                `Error processing image: ${error.message}`
                            );
                        }
                    }
                }
            }
        }

        // Validate source image files recursively
        try {
            await validateImagesInDir(resolveImagesPath(), '');
        } catch (error) {
            addError('images', `Error accessing images directory: ${error.message}`);
        }

        // Validate assets/images recursively
        try {
            const assetsImagesPath = path.join(resolveAssetsPath(), 'images');
            await validateImagesInDir(assetsImagesPath, '', true);
        } catch (error) {
            addError('assets/images', `Error accessing assets/images directory: ${error.message}`);
        }

        // Format output with file headers and separators
        const result = [];
        for (const [file, errors] of fileErrors) {
            if (errors.length > 0) {
                // Add file header
                result.push(`\n📁 Checking ${file}...`);
                result.push('─'.repeat(50));
                result.push(...errors);
                result.push('─'.repeat(50));
            }
        }

        return result;
    } catch (error) {
        console.error('Error during image validation:', error);
        return [`Error during image validation: ${error.message}`];
    }
}

module.exports = validateImages; 