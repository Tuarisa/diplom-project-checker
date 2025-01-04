const fs = require('fs').promises;
const path = require('path');
const { 
    WORKING_DIR,
    STYLES_DIR,
    resolveWorkingPath,
    resolveStylesPath,
    ensureDirectoryExists 
} = require('./paths');

// List of configuration files to sync
const CONFIG_FILES = [
    '.prettierrc',
    '.stylelintrc.json'
];

// Additional files to sync with specific destinations
const ADDITIONAL_FILES = [
    {
        source: 'configs/normalize.css',
        destination: STYLES_DIR
    }
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
        
        // Sync config files
        for (const file of CONFIG_FILES) {
            const localPath = path.join(__dirname, '..', file);
            const workingPath = resolveWorkingPath(file);

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

        // Sync additional files
        for (const file of ADDITIONAL_FILES) {
            const localPath = path.join(__dirname, '..', 'utils', file.source);
            const targetDir = resolveWorkingPath(file.destination);
            const fileName = path.basename(file.source);
            const workingPath = path.join(targetDir, fileName);

            try {
                // Ensure target directory exists
                await ensureDirectoryExists(targetDir);

                // Check if local file exists
                await fs.access(localPath);
                
                // Compare files
                const areEqual = await compareFiles(localPath, workingPath);
                
                if (!areEqual) {
                    // Copy local file to working directory
                    await fs.copyFile(localPath, workingPath);
                    console.log(`✅ Updated ${fileName} in ${file.destination}`);
                } else {
                    console.log(`ℹ️ ${fileName} is up to date`);
                }
            } catch (error) {
                console.error(`❌ Error syncing ${fileName}:`, error.message);
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