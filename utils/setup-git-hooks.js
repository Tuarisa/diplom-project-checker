const fs = require('fs');
const path = require('path');
const { WORKING_DIR } = require('./paths');

function setupGitHooks() {
    try {
        console.log('\n🔧 Setting up Git hooks...\n');

        // Проверяем существование WORKING_DIR
        if (!fs.existsSync(WORKING_DIR)) {
            console.error('❌ Working directory does not exist:', WORKING_DIR);
            process.exit(1);
        }

        // Путь к хукам в проверяемом проекте
        const gitDir = path.join(WORKING_DIR, '.git');
        const hooksDir = path.join(gitDir, 'hooks');
        const commitMsgPath = path.join(hooksDir, 'commit-msg');

        // Путь к исходному хуку в директории чекера
        const sourceHookPath = path.join(__dirname, 'git-hooks', 'commit-msg');

        console.log('Source hook path:', sourceHookPath);
        console.log('Target hook path:', commitMsgPath);

        // Проверяем существование исходного хука
        if (!fs.existsSync(sourceHookPath)) {
            console.error('❌ Source hook file not found:', sourceHookPath);
            process.exit(1);
        }

        // Проверяем существование .git директории
        if (!fs.existsSync(gitDir)) {
            console.error('❌ Not a Git repository:', WORKING_DIR);
            process.exit(1);
        }

        // Создаем директорию hooks и все промежуточные директории
        try {
            if (!fs.existsSync(hooksDir)) {
                fs.mkdirSync(hooksDir, { recursive: true });
                console.log('✅ Created hooks directory:', hooksDir);
            } else {
                console.log('✅ Hooks directory exists:', hooksDir);
            }
        } catch (error) {
            console.error('❌ Error with hooks directory:', error.message);
            process.exit(1);
        }

        // Удаляем существующий хук, если он есть
        if (fs.existsSync(commitMsgPath)) {
            try {
                fs.unlinkSync(commitMsgPath);
                console.log('✅ Removed existing hook');
            } catch (error) {
                console.error('❌ Error removing existing hook:', error.message);
                process.exit(1);
            }
        }

        // Копируем commit-msg хук
        try {
            const commitMsgContent = fs.readFileSync(sourceHookPath, 'utf8');
            fs.writeFileSync(commitMsgPath, commitMsgContent, { mode: 0o755, flag: 'w' });
            
            // Проверяем, что файл создался и имеет правильные права
            const stats = fs.statSync(commitMsgPath);
            if ((stats.mode & 0o777) !== 0o755) {
                fs.chmodSync(commitMsgPath, 0o755);
            }
            
            console.log('✅ Installed commit-msg hook to:', commitMsgPath);
        } catch (error) {
            console.error('❌ Error installing commit-msg hook:', error.message);
            console.error('Source:', sourceHookPath);
            console.error('Target:', commitMsgPath);
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