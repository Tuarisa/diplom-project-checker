const fs = require('fs').promises;
const path = require('path');
const { 
    WORKING_DIR, 
    ASSETS_DIR, 
    STYLES_DIR, 
    IMAGES_DIR,
    resolveWorkingPath 
} = require('../paths');
const { logValidationErrors } = require('../validation-logger');

async function validateStructure() {
    try {
        const allErrors = [];

        // Check required directories
        const requiredDirs = [STYLES_DIR, IMAGES_DIR, ASSETS_DIR];
        for (const dir of requiredDirs) {
            try {
                await fs.access(resolveWorkingPath(dir));
            } catch {
                allErrors.push({
                    filePath: 'structure',
                    message: `Required directory not found: ${dir}`
                });
            }
        }

        // Check index.html existence
        try {
            await fs.access(resolveWorkingPath('index.html'));
        } catch {
            allErrors.push({
                filePath: 'structure',
                message: 'Main page (index.html) not found in root directory'
            });
        }

        // Рекурсивная функция для проверки файлов в директории
        async function validateDir(dirPath, relativePath = '') {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                // Пропускаем node_modules и .git
                if (item === 'node_modules' || item === '.git') {
                    continue;
                }

                const fullPath = path.join(dirPath, item);
                const itemRelativePath = path.join(relativePath, item);
                const stats = await fs.stat(fullPath);

                if (stats.isDirectory()) {
                    await validateDir(fullPath, itemRelativePath);
                } else {
                    // Check for system files
                    if (item === '.DS_Store' || item === 'Thumbs.db') {
                        allErrors.push({
                            filePath: 'structure',
                            
                            message: `System file found in repository: ${itemRelativePath}`
                        });
                    }

                    // Check file naming
                    if (item !== item.toLowerCase() && item !== 'README.md') {
                        allErrors.push({
                            filePath: 'structure',
                            message: `File name should be lowercase: ${itemRelativePath}`
                        });
                    }

                    if (item.includes(' ')) {
                        allErrors.push({
                            filePath: 'structure',
                            message: `File name should not contain spaces: ${itemRelativePath}`
                        });
                    }

                    // Check file extensions
                    if (item.endsWith('.html')) {
                        const content = await fs.readFile(fullPath, 'utf8');
                        
                        // Check for empty files
                        if (!content.trim()) {
                            allErrors.push({
                                filePath: 'structure',
                                message: `Empty HTML file: ${itemRelativePath}`
                            });
                        }
                    }

                    // Check for unnecessary files
                    const unnecessaryPatterns = [
                        /\.zip$/,
                        /\.rar$/,
                        /\.7z$/,
                        /\.bak$/,
                        /\.tmp$/,
                        /~$/
                    ];

                    if (unnecessaryPatterns.some(pattern => pattern.test(item))) {
                        allErrors.push({
                            filePath: 'structure',
                            
                            message: `Unnecessary file found: ${fullPath}`
                        });
                    }
                }
            }
        }

        // Validate entire project structure
        await validateDir(WORKING_DIR);

        // Check CSS directory structure
        try {
            const cssFiles = await fs.readdir(resolveWorkingPath(STYLES_DIR));
            const hasNormalize = cssFiles.some(file => 
                file.toLowerCase().includes('normalize') && file.endsWith('.css')
            );
            
            if (!hasNormalize) {
                allErrors.push({
                    filePath: 'structure',                
                    message: 'Normalize.css not found in css directory'
                });
            }

            for (const file of cssFiles) {
                if (!file.endsWith('.css') && !file.endsWith('.scss')) {
                    allErrors.push({
                        filePath: 'structure',
                        message: `Non-style file found in styles directory: ${file}`
                    });
                }
            }
        } catch {
            // CSS directory check already handled above
        }

        // Check img directory structure recursively
        async function validateImagesDir(dirPath, relativePath = '') {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const itemRelativePath = path.join(relativePath, item);
                const stats = await fs.stat(fullPath);

                if (stats.isDirectory()) {
                    await validateImagesDir(fullPath, itemRelativePath);
                } else {
                    const ext = path.extname(item).toLowerCase();
                    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
                    
                    if (!validExtensions.includes(ext) && item !== '.DS_Store' && item !== 'Thumbs.db') {
                        allErrors.push({
                            filePath: 'structure',
                            message: `Non-image file found in images directory: ${itemRelativePath}`
                        });
                    }
                }
            }
        }

        try {
            await validateImagesDir(resolveWorkingPath(IMAGES_DIR));
        } catch {
            // IMG directory check already handled above
        }

        logValidationErrors('structure', 'Structure', allErrors);
        return allErrors;
    } catch (error) {
        console.error('Error during structure validation:', error);
        return [{
            filePath: 'structure',
            message: `Error during structure validation: ${error.message}`
        }];
    }
}

module.exports = validateStructure; 