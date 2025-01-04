const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const { WORKING_DIR, resolveWorkingPath } = require('../paths');

// BEM naming convention regex
const BEM_CLASS_PATTERN = /^[a-z]+(-[a-z]+)*(__[a-z]+(-[a-z]+)*)?(--[a-z]+(-[a-z]+)*)?$/;

async function validateBEM() {
    try {
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        const fileErrors = new Map();

        const addError = (file, message, lineNumber = '', context = '') => {
            if (!fileErrors.has(file)) {
                fileErrors.set(file, []);
            }
            const errors = fileErrors.get(file);
            const fullPath = resolveWorkingPath(file);
            
            let errorMsg = `   #${errors.length + 1} ⭕ ${fullPath}`;
            if (lineNumber) errorMsg += `:${lineNumber}`;
            errorMsg += `\n      • ${message}`;
            if (context) errorMsg += `\n      • Context: ${context.trim()}`;
            errors.push(errorMsg);
        };

        for (const file of htmlFiles) {
            const filePath = resolveWorkingPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            const dom = new JSDOM(content);
            const document = dom.window.document;

            // Get all elements with class attributes
            const elements = document.querySelectorAll('[class]');
            
            elements.forEach(element => {
                const classes = element.getAttribute('class').split(/\s+/);
                const elementHtml = element.outerHTML.split('\n')[0]; // Get first line of element's HTML
                const lineNumber = content.split('\n').findIndex(line => line.includes(elementHtml)) + 1;

                classes.forEach(className => {
                    // Skip empty classes
                    if (!className) return;

                    // Check BEM naming convention
                    if (!BEM_CLASS_PATTERN.test(className)) {
                        addError(
                            file,
                            `Invalid BEM class name: "${className}"`,
                            lineNumber,
                            elementHtml
                        );
                    }

                    // Check for presentational class names
                    if (
                        /^(fz|fs|color|bg|margin|padding|left|right|top|bottom|block)/.test(className) ||
                        /(left|right|center|bold|italic)$/.test(className)
                    ) {
                        addError(
                            file,
                            `Presentational class name detected: "${className}"`,
                            lineNumber,
                            elementHtml
                        );
                    }
                });

                // Check for unnecessary wrappers
                if (
                    element.children.length === 1 &&
                    !element.textContent.trim() &&
                    !element.querySelector('img') &&
                    !element.classList.contains('visually-hidden')
                ) {
                    addError(
                        file,
                        'Unnecessary wrapper element detected',
                        lineNumber,
                        elementHtml
                    );
                }
            });
        }

        // Format output with file headers and separators
        const result = [];
        for (const [file, errors] of fileErrors) {
            if (errors.length > 0) {
                // Add file header
                result.push(`\n📁 Checking ${file}...`);
                result.push('─'.repeat(50));
                result.push(...errors);
                result.push('─'.repeat(50));
            }
        }

        return result;
    } catch (error) {
        console.error('Error during BEM validation:', error);
        return [`Error during BEM validation: ${error.message}`];
    }
}

module.exports = validateBEM; 