const fs = require('fs').promises;
const validator = require('html-validator');
const { WORKING_DIR, resolveWorkingPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

async function validateW3C() {
    try {
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        const allErrors = [];

        for (const file of htmlFiles) {
            const fileErrors = [];
            const filePath = resolveWorkingPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');

            try {
                const result = await validator({
                    data: content,
                    format: 'json'
                });

                if (result.messages && result.messages.length > 0) {
                    result.messages.forEach(message => {
                        if (message.type === 'error') {
                            let lineNumber = message.lastLine || message.firstLine;
                            let errorContext = '';


                            if (lineNumber && lineNumber <= lines.length) {
                                errorContext = lines[lineNumber - 1].trim();
                            }

                            fileErrors.push({
                                filePath,
                                line: lineNumber || 1,
                                message: message.message,
                                context: errorContext
                            });
                        }
                    });
                }
            } catch (error) {
                fileErrors.push({
                    filePath,
                    line: 1,
                    message: `W3C validation failed: ${error.message}`
                });
            }

            logValidationErrors(filePath, 'W3C', fileErrors);
            allErrors.push(...fileErrors);
        }

        return allErrors;
    } catch (error) {
        console.error('Error during W3C validation:', error);
        return [{
            filePath: 'unknown',
            line: 1,
            message: `W3C validation failed: ${error.message}`
        }];
    }
}

module.exports = validateW3C; 