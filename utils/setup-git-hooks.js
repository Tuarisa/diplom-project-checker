const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { WORKING_DIR } = require('./paths');

const execAsync = promisify(exec);

async function setupGitHooks() {
    try {
        console.log('\n🔧 Setting up Git hooks...\n');

        // Проверяем существование WORKING_DIR
        try {
            await fs.access(WORKING_DIR);
        } catch {
            console.error('❌ Working directory does not exist:', WORKING_DIR);
            process.exit(1);
        }

        // Определяем директорию .git
        let gitDir;
        try {
            process.chdir(WORKING_DIR);
            const { stdout } = await execAsync('git rev-parse --git-dir');
            gitDir = stdout.trim();
            console.log('✅ Git repository found:', gitDir);
        } catch (error) {
            console.log('🔄 Initializing git repository...');
            await execAsync('git init');
            gitDir = '.git';
            console.log('✅ Git repository initialized');
        }

        const gitHooksDir = path.join(WORKING_DIR, gitDir, 'hooks');
        const sourceHookPath = path.join(__dirname, 'git-hooks', 'commit-msg');
        const hookPath = path.join(gitHooksDir, 'commit-msg');

        console.log('Source hook path:', sourceHookPath);
        console.log('Target hook path:', hookPath);

        // Проверяем существование исходного хука
        try {
            await fs.access(sourceHookPath);
            console.log('✅ Source hook file found');
        } catch {
            console.error('❌ Source hook file not found:', sourceHookPath);
            process.exit(1);
        }

        // Создаем директорию hooks, если её нет
        try {
            await fs.mkdir(gitHooksDir, { recursive: true });
            console.log('✅ Hooks directory ready:', gitHooksDir);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error('❌ Error creating hooks directory:', error.message);
                process.exit(1);
            }
        }

        // Проверяем существующий хук
        try {
            const stats = await fs.lstat(hookPath);
            if (stats.isSymbolicLink()) {
                await fs.unlink(hookPath);
                console.log('🔄 Removed existing symbolic link');
            } else if (stats.isFile()) {
                await fs.rename(hookPath, `${hookPath}.backup`);
                console.log('🔄 Existing hook saved as .backup');
            }
        } catch {}

        // Создаем символическую ссылку
        try {
            const relativePath = path.relative(gitHooksDir, sourceHookPath);
            await fs.symlink(relativePath, hookPath);
            await fs.chmod(hookPath, 0o755);
            console.log('✅ Created symbolic link to hook');
        } catch (error) {
            console.error('❌ Error creating symbolic link:', error.message);
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