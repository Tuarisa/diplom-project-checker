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

        // Создаем директорию для хуков в проекте
        const projectHooksDir = path.join(WORKING_DIR, 'utils', 'git-hooks');
        try {
            await fs.mkdir(projectHooksDir, { recursive: true });
            console.log('✅ Project hooks directory ready:', projectHooksDir);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error('❌ Error creating project hooks directory:', error.message);
                process.exit(1);
            }
        }

        // Копируем хук в директорию проекта
        const sourceHookPath = path.join(__dirname, 'git-hooks', 'commit-msg');
        const projectHookPath = path.join(projectHooksDir, 'commit-msg');
        const gitHooksDir = path.join(WORKING_DIR, gitDir, 'hooks');
        const hookPath = path.join(gitHooksDir, 'commit-msg');

        console.log('Source hook path:', sourceHookPath);
        console.log('Project hook path:', projectHookPath);
        console.log('Git hook path:', hookPath);

        // Проверяем существование исходного хука
        try {
            await fs.access(sourceHookPath);
            console.log('✅ Source hook file found');
        } catch {
            console.error('❌ Source hook file not found:', sourceHookPath);
            process.exit(1);
        }

        // Копируем хук в директорию проекта
        try {
            const hookContent = await fs.readFile(sourceHookPath, 'utf8');
            await fs.writeFile(projectHookPath, hookContent, { mode: 0o755 });
            console.log('✅ Hook copied to project directory');
        } catch (error) {
            console.error('❌ Error copying hook to project:', error.message);
            process.exit(1);
        }

        // Создаем директорию hooks в .git, если её нет
        try {
            await fs.mkdir(gitHooksDir, { recursive: true });
            console.log('✅ Git hooks directory ready:', gitHooksDir);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error('❌ Error creating git hooks directory:', error.message);
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

        // Создаем символическую ссылку на хук в проекте
        try {
            const relativePath = path.relative(gitHooksDir, projectHookPath);
            await fs.symlink(relativePath, hookPath);
            await fs.chmod(hookPath, 0o755);
            console.log('✅ Created symbolic link to project hook');
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