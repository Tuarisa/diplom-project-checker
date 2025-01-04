const fs = require('fs').promises;
const path = require('path');
const { WORKING_DIR } = require('./paths');

// Список файлов и директорий для очистки
const CLEANUP_PATTERNS = [
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '*.tmp',
    '*.bak',
    '~*',
    '*.swp'
];

async function cleanupRepo() {
    try {
        console.log('\n🧹 Starting repository cleanup...\n');

        // Рекурсивная функция для очистки директории
        async function cleanupDir(dirPath) {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stats = await fs.stat(fullPath);

                if (stats.isDirectory()) {
                    // Рекурсивно очищаем поддиректории
                    await cleanupDir(fullPath);
                } else {
                    // Проверяем, соответствует ли файл паттернам для очистки
                    const shouldClean = CLEANUP_PATTERNS.some(pattern => {
                        if (pattern.includes('*')) {
                            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                            return regex.test(item);
                        }
                        return item === pattern;
                    });

                    if (shouldClean) {
                        try {
                            await fs.unlink(fullPath);
                            console.log(`✅ Removed: ${path.relative(WORKING_DIR, fullPath)}`);
                        } catch (error) {
                            console.error(`❌ Error removing ${fullPath}:`, error.message);
                        }
                    }
                }
            }
        }

        // Начинаем очистку с корневой директории
        await cleanupDir(WORKING_DIR);
        
        console.log('\n✨ Repository cleanup completed');
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    cleanupRepo();
}

module.exports = cleanupRepo; 