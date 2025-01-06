const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const { WORKING_DIR, resolveWorkingPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

// BEM naming convention regex
const BEM_CLASS_PATTERN = /^[a-z]+(-[a-z]+)*(__[a-z]+(-[a-z]+)*)?(--[a-z]+(-[a-z]+)*)?$/;

async function validateBEM() {
    try {
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        const allErrors = [];

        for (const file of htmlFiles) {
            const filePath = resolveWorkingPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            const dom = new JSDOM(content);
            const document = dom.window.document;
            const fileErrors = [];

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
                        fileErrors.push({
                            filePath,
                            line: lineNumber,
                            message: `Invalid BEM class name: "${className}"`,
                            context: elementHtml
                        });
                    }

                    // Check for presentational class names
                    if (
                        /^(fz|fs|color|bg|margin|padding|left|right|top|bottom|block)-/.test(className) ||
                        /--(left|right|center|bold|italic)$/.test(className)
                    ) {
                        fileErrors.push({
                            filePath,
                            line: lineNumber,
                            message: `Presentational class name detected: "${className}"`,
                            context: elementHtml
                        });
                    }
                });

                // Check for unnecessary wrappers
                if (
                    element.children.length === 1 &&
                    !element.textContent.trim() &&
                    !element.querySelector('img') &&
                    !element.classList.contains('visually-hidden') &&
                    element.tagName.toLowerCase() !== 'svg' &&
                    element.tagName.toLowerCase() !== 'a'
                ) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Unnecessary wrapper element detected',
                        context: elementHtml
                    });
                }
            });

            if (fileErrors.length > 0) {
                logValidationErrors(filePath, 'BEM', fileErrors);
                allErrors.push(...fileErrors);
            }
        }

        return allErrors;
    } catch (error) {
        console.error('Error during BEM validation:', error);
        return [{
            filePath: resolveWorkingPath('bem'),
            line: 1,
            message: `Error during BEM validation: ${error.message}`
        }];
    }
}

module.exports = validateBEM; 