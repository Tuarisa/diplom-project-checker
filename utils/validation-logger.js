/**
 * Format validation errors output in a consistent way
 * @param {string} fileName - Name of the file being validated
 * @param {string} validationType - Type of validation (e.g., 'BEM', 'W3C', 'HTML')
 * @param {Array<{filePath: string, line?: number, message: string, context?: string}>} errors - Array of error objects
 * @returns {boolean} - Returns true if there were no errors, false otherwise
 */
function logValidationErrors(fileName, validationType, errors) {
    if (!errors || errors.length === 0) {
        console.log(`\n✓ ${fileName} passed ${validationType} validation\n`);
        return true;
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`📁 Checking ${fileName}...`);
    console.log('─'.repeat(50));

    errors.forEach((error, index) => {
        const errorNumber = `#${index + 1}`;
        const filePath = error.filePath || fileName;
        const lineInfo = error.line ? `:${error.line}` : '';
        
        console.log(`   ${errorNumber} ⭕ ${filePath}${lineInfo}`);
        console.log(`      • ${error.message}`);
        
        if (error.context) {
            console.log(`      • Context: ${error.context.trim()}`);
        }
    });

    console.log('─'.repeat(50));
    return false;
}

module.exports = { logValidationErrors }; 