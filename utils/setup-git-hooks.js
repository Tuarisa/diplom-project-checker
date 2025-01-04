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
        const localCommitMsgPath = path.join(__dirname, 'commit-msg');

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

        // Устанавливаем commit-msg хук
        const commitMsgPath = path.join(hooksDir, 'commit-msg');
        try {
            const commitMsgContent = await fs.readFile(localCommitMsgPath, 'utf8');
            await fs.writeFile(commitMsgPath, commitMsgContent);
            await fs.chmod(commitMsgPath, 0o755);
            console.log('✅ Installed commit-msg hook');
        } catch (error) {
            console.error('❌ Error installing commit-msg hook:', error.message);
        }

        // Создаем pre-commit хук
        const preCommitPath = path.join(hooksDir, 'pre-commit');
        await fs.writeFile(preCommitPath, PRE_COMMIT_HOOK);
        await fs.chmod(preCommitPath, 0o755);
        console.log('✅ Installed pre-commit hook');

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