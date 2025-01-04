const fs = require('fs').promises;
const path = require('path');
const { WORKING_DIR } = require('./paths');

async function setupGitHooks() {
    try {
        console.log('\n🔧 Setting up Git hooks...\n');

        // Путь к хукам в проверяемом проекте
        const gitDir = path.join(WORKING_DIR, '.git');
        const hooksDir = path.join(gitDir, 'hooks');
        const commitMsgPath = path.join(hooksDir, 'commit-msg');

        // Путь к исходному хуку в текущей директории
        const sourceHookPath = path.join(__dirname, 'git-hooks', 'commit-msg');

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

        // Копируем commit-msg хук из utils/git-hooks
        try {
            const commitMsgContent = await fs.readFile(sourceHookPath, 'utf8');
            await fs.writeFile(commitMsgPath, commitMsgContent, { mode: 0o755 });
            console.log('✅ Installed commit-msg hook');
        } catch (error) {
            console.error('❌ Error installing commit-msg hook:', error.message);
            process.exit(1);
        }

        console.log('\n✨ Git hooks setup completed');
        console.log('\nCommit message hook is now active:');
        console.log('• Enforces conventional commit format');
        console.log('• Checks message length and language');
        console.log('• Ensures imperative mood usage');
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    setupGitHooks();
}

module.exports = setupGitHooks; 