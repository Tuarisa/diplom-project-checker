const fs = require('fs').promises;
const path = require('path');
const { WORKING_DIR } = require('./paths');

const PRE_COMMIT_HOOK = `#!/bin/sh
# Run validation before commit
cd "${WORKING_DIR}"
yarn validate

# Check if validation failed
if [ $? -ne 0 ]; then
    echo "❌ Validation failed. Please fix the issues before committing."
    exit 1
fi

echo "✅ Validation passed. Proceeding with commit..."
exit 0`;

async function setupGitHooks() {
    try {
        console.log('\n🔧 Setting up Git hooks...\n');

        const gitDir = path.join(WORKING_DIR, '.git');
        const hooksDir = path.join(gitDir, 'hooks');
        const commitMsgPath = path.join(hooksDir, 'commit-msg');
        const preCommitPath = path.join(hooksDir, 'pre-commit');

        // Проверяем существование .git директории
        try {
            await fs.access(gitDir);
        } catch {
            console.error('❌ Not a Git repository:', WORKING_DIR);
            process.exit(1);
        }

        // Создаем директорию hooks, если её нет
        try {
            await fs.access(hooksDir);
        } catch {
            await fs.mkdir(hooksDir);
            console.log('✅ Created hooks directory');
        }

        // Копируем commit-msg хук из текущей директории
        try {
            const commitMsgContent = await fs.readFile(path.join(__dirname, 'commit-msg'), 'utf8');
            await fs.writeFile(commitMsgPath, commitMsgContent, { mode: 0o755 });
            console.log('✅ Installed commit-msg hook');
        } catch (error) {
            console.error('❌ Error installing commit-msg hook:', error.message);
            process.exit(1);
        }

        // Создаем pre-commit хук
        try {
            await fs.writeFile(preCommitPath, PRE_COMMIT_HOOK, { mode: 0o755 });
            console.log('✅ Installed pre-commit hook');
        } catch (error) {
            console.error('❌ Error installing pre-commit hook:', error.message);
            process.exit(1);
        }

        console.log('\n✨ Git hooks setup completed');
        console.log('\nThe following hooks are now active:');
        console.log('1. commit-msg: Validates commit message format');
        console.log('2. pre-commit: Runs project validation before commit');
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    setupGitHooks();
}

module.exports = setupGitHooks; 