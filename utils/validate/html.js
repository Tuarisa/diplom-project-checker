const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const validator = require('html-validator');
const { WORKING_DIR, resolveWorkingPath } = require('../paths');

async function validateHTML() {
    try {
        const fileErrors = new Map();

        const addError = (file, message, lineNumber = '', context = '') => {
            if (!fileErrors.has(file)) {
                fileErrors.set(file, []);
            }
            const errors = fileErrors.get(file);
            const fullPath = resolveWorkingPath(file);
            
            let errorMsg = `   #${errors.length + 1} 🔴 ${fullPath}`;
            if (lineNumber) errorMsg += `:${lineNumber}`;
            errorMsg += `\n      • ${message}`;
            if (context) errorMsg += `\n      • Context: ${context.trim()}`;
            errors.push(errorMsg);
        };

        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));

        // Store titles and meta descriptions to check for uniqueness
        const titles = new Map();
        const descriptions = new Map();

        for (const file of htmlFiles) {
            const filePath = resolveWorkingPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            const dom = new JSDOM(content);
            const document = dom.window.document;

            // Check DOCTYPE
            if (!content.trim().toLowerCase().startsWith('<!doctype html>')) {
                addError(
                    file,
                    'Missing or incorrect DOCTYPE declaration',
                    1,
                    content.split('\n')[0]
                );
            }

            // Check lang attribute
            const html = document.querySelector('html');
            if (!html.hasAttribute('lang')) {
                addError(
                    file,
                    'Missing lang attribute on <html> tag',
                    content.split('\n').findIndex(line => line.includes('<html')) + 1,
                    html.outerHTML
                );
            }

            // Check charset meta tag
            const charsetMeta = document.querySelector('meta[charset]');
            if (!charsetMeta) {
                addError(
                    file,
                    'Missing charset meta tag',
                    content.split('\n').findIndex(line => line.includes('<head')) + 1
                );
            }

            // Check title tag
            const title = document.querySelector('title');
            if (!title || !title.textContent.trim()) {
                addError(
                    file,
                    'Missing or empty title tag',
                    content.split('\n').findIndex(line => line.includes('<head')) + 1
                );
            } else {
                const titleText = title.textContent.trim();
                if (titles.has(titleText)) {
                    addError(
                        file,
                        `Duplicate title "${titleText}" also used in ${titles.get(titleText)}`,
                        content.split('\n').findIndex(line => line.includes(titleText)) + 1,
                        title.outerHTML
                    );
                } else {
                    titles.set(titleText, file);
                }
            }

            // Check meta description
            const metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc || !metaDesc.getAttribute('content')) {
                addError(
                    file,
                    'Missing or empty meta description',
                    content.split('\n').findIndex(line => line.includes('<head')) + 1
                );
            } else {
                const descText = metaDesc.getAttribute('content');
                if (descriptions.has(descText)) {
                    addError(
                        file,
                        `Duplicate meta description also used in ${descriptions.get(descText)}`,
                        content.split('\n').findIndex(line => line.includes(descText)) + 1,
                        metaDesc.outerHTML
                    );
                } else {
                    descriptions.set(descText, file);
                }
            }

            // Check h1 tag
            const h1s = document.querySelectorAll('h1');
            if (h1s.length === 0) {
                addError(
                    file,
                    'Missing h1 tag',
                    content.split('\n').findIndex(line => line.includes('<body')) + 1
                );
            } else if (h1s.length > 1) {
                addError(
                    file,
                    'Multiple h1 tags found',
                    content.split('\n').findIndex(line => line.includes('<h1')) + 1,
                    Array.from(h1s).map(h1 => h1.outerHTML).join('\n')
                );
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
                addError(
                    file,
                    'Insufficient use of semantic tags',
                    content.split('\n').findIndex(line => line.includes('<body')) + 1,
                    `Found: ${Array.from(usedSemanticTags).join(', ')}`
                );
            }

            // Check images
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                const lineNumber = content.split('\n').findIndex(line => line.includes(img.outerHTML)) + 1;
                
                if (!img.hasAttribute('alt')) {
                    addError(
                        file,
                        'Image missing alt attribute',
                        lineNumber,
                        img.outerHTML
                    );
                }
                
                if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
                    addError(
                        file,
                        'Image missing width or height attribute',
                        lineNumber,
                        img.outerHTML
                    );
                }
            });

            // Check links
            const links = document.querySelectorAll('a');
            links.forEach(link => {
                const href = link.getAttribute('href');
                const lineNumber = content.split('\n').findIndex(line => line.includes(link.outerHTML)) + 1;

                if (!href) {
                    addError(
                        file,
                        'Link missing href attribute',
                        lineNumber,
                        link.outerHTML
                    );
                } else if (href === '#') {
                    addError(
                        file,
                        'Link with href="#" should use javascript:void(0)',
                        lineNumber,
                        link.outerHTML
                    );
                }

                if (href?.startsWith('http') && !link.hasAttribute('target')) {
                    addError(
                        file,
                        'External link missing target="_blank" attribute',
                        lineNumber,
                        link.outerHTML
                    );
                }
            });

            // Check forms
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                const lineNumber = content.split('\n').findIndex(line => line.includes(form.outerHTML)) + 1;

                if (!form.hasAttribute('action')) {
                    addError(
                        file,
                        'Form missing action attribute',
                        lineNumber,
                        form.outerHTML
                    );
                }

                const inputs = form.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    const inputLineNumber = content.split('\n').findIndex(line => line.includes(input.outerHTML)) + 1;
                    
                    if (!input.hasAttribute('name')) {
                        addError(
                            file,
                            'Form control missing name attribute',
                            inputLineNumber,
                            input.outerHTML
                        );
                    }

                    if (input.tagName === 'INPUT' && !input.hasAttribute('type')) {
                        addError(
                            file,
                            'Input missing type attribute',
                            inputLineNumber,
                            input.outerHTML
                        );
                    }
                });
            });

            // W3C validation
            try {
                const result = await validator({
                    data: content,
                    format: 'text'
                });

                if (result.includes('Error:')) {
                    const errors = result.split('\n').filter(line => line.includes('Error:'));
                    errors.forEach(error => {
                        const match = error.match(/line (\d+)/);
                        const lineNumber = match ? parseInt(match[1]) : null;
                        addError(
                            file,
                            error.replace(/^Error:\s*/, ''),
                            lineNumber,
                            lineNumber ? content.split('\n')[lineNumber - 1] : ''
                        );
                    });
                }
            } catch (error) {
                addError(
                    file,
                    `W3C validation failed: ${error.message}`
                );
            }

            // Check favicon
            const favicon = document.querySelector('link[rel="icon"]');
            if (!favicon) {
                addError(
                    file,
                    'Missing favicon',
                    content.split('\n').findIndex(line => line.includes('<head')) + 1
                );
            }
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
        console.error('Error during HTML validation:', error);
        return [`Error during HTML validation: ${error.message}`];
    }
}

module.exports = validateHTML; 