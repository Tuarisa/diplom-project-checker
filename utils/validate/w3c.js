const fs = require('fs').promises;
const validator = require('html-validator');
const { WORKING_DIR, resolveWorkingPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

async function validateW3C() {
    try {
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        let hasErrors = false;

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

                            if (!lineNumber) {
                                // Поиск по специфичным паттернам
                                if (message.message.includes('element "form"') && message.message.includes('action')) {
                                    // Ищем form без action или с пустым action
                                    lineNumber = lines.findIndex(line => 
                                        line.includes('<form') && (line.includes('action=""') || !line.includes('action='))
                                    ) + 1;
                                } else if (message.message.includes('Duplicate ID')) {
                                    // Извлекаем ID из сообщения
                                    const idMatch = message.message.match(/ID "([^"]+)"/);
                                    if (idMatch) {
                                        const id = idMatch[1];
                                        lineNumber = lines.findIndex(line => 
                                            line.includes(`id="${id}"`)
                                        ) + 1;
                                    }
                                } else if (message.message.includes('not allowed as child of element')) {
                                    // Извлекаем элементы из сообщения
                                    const elements = message.message.match(/element "([^"]+)".*?element "([^"]+)"/);
                                    if (elements) {
                                        const [_, child, parent] = elements;
                                        // Ищем строку где дочерний элемент находится внутри родительского
                                        for (let i = 0; i < lines.length; i++) {
                                            if (lines[i].includes(`<${parent}`) && 
                                                (lines[i].includes(`<${child}`) || 
                                                 (i + 1 < lines.length && lines[i + 1].includes(`<${child}`)))) {
                                                lineNumber = i + 1;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

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

            const isValid = logValidationErrors(filePath, 'W3C', fileErrors);
            if (!isValid) hasErrors = true;
        }

        return !hasErrors;
    } catch (error) {
        console.error('Error during W3C validation:', error);
        return false;
    }
}

module.exports = validateW3C; 