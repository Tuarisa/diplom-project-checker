const { execSync } = require('child_process');
const { WORKING_DIR } = require('./paths');
const path = require('path');

async function formatStyles() {
    try {
        // Change to working directory
        process.chdir(WORKING_DIR);
        
        // Run stylelint on SCSS files
        execSync('stylelint "styles/**/*.scss" --fix --config ../diplom-project-checker/.stylelintrc.json', { 
            stdio: 'inherit',
            encoding: 'utf-8'
        });
        
        console.log('✨ Styles formatted successfully!');
    } catch (error) {
        console.error('Error formatting styles:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    formatStyles();
}

module.exports = formatStyles; 