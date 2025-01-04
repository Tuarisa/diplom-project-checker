const { execSync } = require('child_process');
const { WORKING_DIR } = require('./paths');
const path = require('path');

async function formatStyles() {
    try {
        // Change to working directory
        process.chdir(WORKING_DIR);
        
        // Run prettier on SCSS files
        execSync('prettier --write "styles/**/*.scss"', { 
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