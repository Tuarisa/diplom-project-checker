const fs = require('fs').promises;
const path = require('path');
const { WORKING_DIR } = require('./paths');

// List of configuration files to sync
const CONFIG_FILES = [
    '.prettierrc',
    '.stylelintrc.json'
];

async function compareFiles(localPath, workingPath) {
    try {
        const [localContent, workingContent] = await Promise.all([
            fs.readFile(localPath, 'utf8'),
            fs.readFile(workingPath, 'utf8')
        ]);
        return localContent === workingContent;
    } catch {
        return false;
    }
}

async function syncConfigs() {
    try {
        console.log('🔄 Syncing configuration files...\n');
        
        for (const file of CONFIG_FILES) {
            const localPath = path.join(__dirname, '..', file);
            const workingPath = path.join(WORKING_DIR, file);

            try {
                // Check if local config exists
                await fs.access(localPath);
                
                // Compare files
                const areEqual = await compareFiles(localPath, workingPath);
                
                if (!areEqual) {
                    // Copy local config to working directory
                    await fs.copyFile(localPath, workingPath);
                    console.log(`✅ Updated ${file} in working directory`);
                } else {
                    console.log(`ℹ️ ${file} is up to date`);
                }
            } catch (error) {
                console.error(`❌ Error syncing ${file}:`, error.message);
            }
        }
        
        console.log('\n✨ Configuration sync completed');
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    syncConfigs();
}

module.exports = syncConfigs; 