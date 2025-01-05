const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const { WORKING_DIR, resolveWorkingPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

async function validateHTML() {
    try {
        const errors = [];
        const titles = new Map();
        const descriptions = new Map();

        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        let hasErrors = false;

        for (const file of htmlFiles) {
            const fileErrors = [];
            const filePath = resolveWorkingPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            const dom = new JSDOM(content);
            const document = dom.window.document;

            // Check DOCTYPE
            if (!content.trim().toLowerCase().startsWith('<!doctype html>')) {
                fileErrors.push({
                    filePath,
                    line: 1,
                    message: 'Missing or incorrect DOCTYPE declaration',
                    context: content.split('\n')[0]
                });
            }

            // Check lang attribute
            const html = document.querySelector('html');
            if (!html.hasAttribute('lang')) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<html')) + 1,
                    message: 'Missing lang attribute on <html> tag',
                    context: html.outerHTML
                });
            }

            // Check charset meta tag
            const charsetMeta = document.querySelector('meta[charset]');
            if (!charsetMeta) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<head')) + 1,
                    message: 'Missing charset meta tag'
                });
            }

            // Check title tag
            const title = document.querySelector('title');
            if (!title || !title.textContent.trim()) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<head')) + 1,
                    message: 'Missing or empty title tag'
                });
            } else {
                const titleText = title.textContent.trim();
                if (titles.has(titleText)) {
                    fileErrors.push({
                        filePath,
                        line: content.split('\n').findIndex(line => line.includes(titleText)) + 1,
                        message: `Duplicate title "${titleText}" also used in ${titles.get(titleText)}`,
                        context: title.outerHTML
                    });
                } else {
                    titles.set(titleText, file);
                }
            }

            // Check meta description
            const metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc || !metaDesc.getAttribute('content')) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<head')) + 1,
                    message: 'Missing or empty meta description'
                });
            } else {
                const descText = metaDesc.getAttribute('content');
                if (descriptions.has(descText)) {
                    fileErrors.push({
                        filePath,
                        line: content.split('\n').findIndex(line => line.includes(descText)) + 1,
                        message: `Duplicate meta description also used in ${descriptions.get(descText)}`,
                        context: metaDesc.outerHTML
                    });
                } else {
                    descriptions.set(descText, file);
                }
            }

            // Check h1 tag
            const h1s = document.querySelectorAll('h1');
            if (h1s.length === 0) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<body')) + 1,
                    message: 'Missing h1 tag'
                });
            } else if (h1s.length > 1) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<h1')) + 1,
                    message: 'Multiple h1 tags found',
                    context: Array.from(h1s).map(h1 => h1.outerHTML).join('\n')
                });
            }

            // Check semantic tags
            const semanticTags = ['header', 'main', 'footer', 'nav', 'article', 'section', 'aside'];
            const usedSemanticTags = new Set();
            semanticTags.forEach(tag => {
                if (document.querySelector(tag)) {
                    usedSemanticTags.add(tag);
                }
            });

            if (usedSemanticTags.size < 3) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<body')) + 1,
                    message: 'Insufficient use of semantic tags',
                    context: `Found: ${Array.from(usedSemanticTags).join(', ')}`
                });
            }

            // Check images
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                const lineNumber = content.split('\n').findIndex(line => line.includes(img.outerHTML)) + 1;
                
                if (!img.hasAttribute('alt')) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Image missing alt attribute',
                        context: img.outerHTML
                    });
                }
                
                if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Image missing width or height attribute',
                        context: img.outerHTML
                    });
                }
            });

            // Check links
            const links = document.querySelectorAll('a');
            links.forEach(link => {
                const href = link.getAttribute('href');
                const lineNumber = content.split('\n').findIndex(line => line.includes(link.outerHTML)) + 1;

                if (!href) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Link missing href attribute',
                        context: link.outerHTML
                    });
                } else if (href === file) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Link points to the current page without a specific section',
                        context: link.outerHTML
                    });
                } else if (href.startsWith('/') && !htmlFiles.includes(href.slice(1))) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Link points to a non-existent internal page',
                        context: link.outerHTML
                    });
                }

                if (href?.startsWith('http') && !link.hasAttribute('target')) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'External link missing target="_blank" attribute',
                        context: link.outerHTML
                    });
                }
            });

            // Check forms
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                const formContent = content.split('\n');
                const formLineNumber = formContent.findIndex(line => line.includes(form.outerHTML)) + 1;

                if (!form.hasAttribute('action')) {
                    fileErrors.push({
                        filePath,
                        line: formLineNumber,
                        message: 'Form missing action attribute',
                        context: form.outerHTML
                    });
                }

                const inputs = form.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    // Ищем строку с input элементом
                    let inputLine = -1;
                    const inputHTML = input.outerHTML;
                    
                    // Сначала ищем точное совпадение
                    inputLine = formContent.findIndex(line => line.includes(inputHTML));
                    
                    // Если не нашли, ищем по частям (атрибуты могут быть в разном порядке)
                    if (inputLine === -1) {
                        const inputId = input.id ? `id="${input.id}"` : '';
                        const inputClass = input.className ? `class="${input.className}"` : '';
                        const inputType = input.type ? `type="${input.type}"` : '';
                        
                        inputLine = formContent.findIndex(line => 
                            inputId && line.includes(inputId) ||
                            inputClass && line.includes(inputClass) ||
                            inputType && line.includes(inputType)
                        );
                    }
                    
                    const inputLineNumber = inputLine !== -1 ? inputLine + 1 : formLineNumber;
                    
                    if (!input.hasAttribute('name')) {
                        fileErrors.push({
                            filePath,
                            line: inputLineNumber,
                            message: 'Form control missing name attribute',
                            context: input.outerHTML
                        });
                    }

                    if (input.tagName === 'INPUT' && !input.hasAttribute('type')) {
                        fileErrors.push({
                            filePath,
                            line: inputLineNumber,
                            message: 'Input missing type attribute',
                            context: input.outerHTML
                        });
                    }
                });
            });

            // Check favicon
            const favicon = document.querySelector('link[rel="icon"]');
            if (!favicon) {
                fileErrors.push({
                    filePath,
                    line: content.split('\n').findIndex(line => line.includes('<head')) + 1,
                    message: 'Missing favicon'
                });
            }

            // Log errors for this file
            const isValid = logValidationErrors(filePath, 'HTML', fileErrors);
            if (!isValid) hasErrors = true;
        }

        return !hasErrors;
    } catch (error) {
        console.error('Error during HTML validation:', error);
        return false;
    }
}

module.exports = validateHTML; 