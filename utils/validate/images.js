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
const { logValidationErrors } = require('../validation-logger');

async function validateImages() {
    try {
        const allErrors = [];

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
                    allErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Missing alt attribute',
                        context: img.outerHTML
                    });
                }

                // Check for missing width/height attributes
                if (!width || !height) {
                    allErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Missing width or height attribute',
                        context: img.outerHTML
                    });
                }

                // Check if path is absolute (starts with /)
                if (src.startsWith('/')) {
                    allErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Image path should be relative (should not start with /)',
                        context: img.outerHTML,
                        suggestion: `Change path to relative: ${src.substring(1)}`
                    });
                }

                // Check if image file exists and has correct format
                if (src) {
                    let imgPath;
                    if (src.startsWith('assets/')) {
                        // Для путей, начинающихся с assets/
                        imgPath = resolveWorkingPath(src);
                    } else {
                        // Для остальных путей используем resolveImagesPath
                        imgPath = resolveImagesPath(src.replace(/^images\//, ''));
                    }
                    
                    try {
                        await fs.access(imgPath);
                        // Проверяем расширение файла
                        if (!src.toLowerCase().endsWith('.webp') && !src.toLowerCase().endsWith('.svg')) {
                            allErrors.push({
                                filePath,
                                line: lineNumber,
                                message: 'Image must be in WebP or SVG format',
                                context: img.outerHTML
                            });
                        }
                    } catch {
                        allErrors.push({
                            filePath,
                            line: lineNumber,
                            message: `Image file not found: ${src} (looked in ${imgPath})`,
                            context: img.outerHTML
                        });
                    }
                } else {
                    allErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Missing src attribute',
                        context: img.outerHTML
                    });
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
                    await validateImagesInDir(fullPath, itemRelativePath, isAssetsDir);
                } else {
                    const ext = path.extname(item).toLowerCase();
                    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];

                    // Пропускаем системные файлы
                    if (item === '.DS_Store' || item === 'Thumbs.db') {
                        allErrors.push({
                            filePath: resolveWorkingPath(path.join(isAssetsDir ? path.join(ASSETS_DIR, 'images') : IMAGES_DIR, itemRelativePath)),
                            line: 1,
                            message: 'System file found in images directory'
                        });
                        continue;
                    }

                    // Проверяем расширение файла
                    if (!validExtensions.includes(ext)) {
                        allErrors.push({
                            filePath: resolveWorkingPath(path.join(isAssetsDir ? path.join(ASSETS_DIR, 'images') : IMAGES_DIR, itemRelativePath)),
                            line: 1,
                            message: 'Invalid image file extension'
                        });
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
                                allErrors.push({
                                    filePath: resolveWorkingPath(path.join(path.join(ASSETS_DIR, 'images'), itemRelativePath)),
                                    line: 1,
                                    message: `Image dimensions too large: ${metadata.width}x${metadata.height}px`
                                });
                            }

                            // Проверяем размер файла
                            const stats = await fs.stat(fullPath);
                            const fileSizeMB = stats.size / (1024 * 1024);
                            if (fileSizeMB > 1) {
                                allErrors.push({
                                    filePath: resolveWorkingPath(path.join(path.join(ASSETS_DIR, 'images'), itemRelativePath)),
                                    line: 1,
                                    message: `Image file size too large: ${fileSizeMB.toFixed(2)}MB`
                                });
                            }
                        } catch (error) {
                            allErrors.push({
                                filePath: resolveWorkingPath(path.join(path.join(ASSETS_DIR, 'images'), itemRelativePath)),
                                line: 1,
                                message: `Error processing image: ${error.message}`
                            });
                        }
                    }
                }
            }
        }

        // Validate source image files recursively
        try {
            await validateImagesInDir(resolveImagesPath(), '');
        } catch (error) {
            allErrors.push({
                filePath: resolveWorkingPath(IMAGES_DIR),
                line: 1,
                message: `Error accessing images directory: ${error.message}`
            });
        }

        // Validate assets/images recursively
        try {
            const assetsImagesPath = path.join(resolveAssetsPath(), 'images');
            await validateImagesInDir(assetsImagesPath, '', true);
        } catch (error) {
            allErrors.push({
                filePath: resolveWorkingPath(path.join(ASSETS_DIR, 'images')),
                line: 1,
                message: `Error accessing assets/images directory: ${error.message}`
            });
        }

        logValidationErrors(resolveWorkingPath('images'), 'Images', allErrors);
        return allErrors;
    } catch (error) {
        console.error('Error during image validation:', error);
        return [{
            filePath: resolveWorkingPath('images'),
            line: 1,
            message: `Error during image validation: ${error.message}`
        }];
    }
}

module.exports = validateImages; 