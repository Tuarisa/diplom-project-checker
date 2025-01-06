const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const { WORKING_DIR, resolveWorkingPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

// Helper function to get normalized HTML structure (excluding href attributes)
function getNormalizedStructure(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    
    // Remove href attributes from links
    const links = clone.getElementsByTagName('a');
    for (const link of links) {
        link.removeAttribute('href');
        link.removeAttribute('disabled');
    }

    // Remove active classes
    const elementsWithClass = clone.querySelectorAll('[class]');
    elementsWithClass.forEach(el => {
        const classes = el.getAttribute('class').split(' ');
        const filteredClasses = classes.filter(cls => !cls.includes('active'));
        if (filteredClasses.length > 0) {
            el.setAttribute('class', filteredClasses.join(' '));
        } else {
            el.removeAttribute('class');
        }
    });

    return clone.innerHTML.replace(/\s+/g, ' ').trim();
}

// Helper function to find first difference in HTML structures
function findFirstDifference(str1, str2) {
    const lines1 = str1.split('\n');
    const lines2 = str2.split('\n');
    
    for (let i = 0; i < Math.min(lines1.length, lines2.length); i++) {
        if (lines1[i].trim() !== lines2[i].trim()) {
            return `Difference found:\nCurrent: ${lines1[i].trim()}\nExpected: ${lines2[i].trim()}`;
        }
    }
    if (lines1.length !== lines2.length) {
        return `Different number of lines. Current: ${lines1.length}, Expected: ${lines2.length}`;
    }
    return lines1[0].trim(); // Return first line if no visible difference found
}

async function validateHTML() {
    try {
        const allErrors = [];
        const titles = new Map();
        const descriptions = new Map();
        
        // Store reference structures from index.html
        let referenceHeader = null;
        let referenceFooter = null;
        let indexContent = null;
        let indexDoc = null;

        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));

        // First, get reference structures from index.html
        if (htmlFiles.includes('index.html')) {
            const indexPath = resolveWorkingPath('index.html');
            indexContent = await fs.readFile(indexPath, 'utf8');
            const indexDom = new JSDOM(indexContent);
            indexDoc = indexDom.window.document;
            
            const indexHeader = indexDoc.querySelector('header');
            const indexFooter = indexDoc.querySelector('footer');
            
            if (indexHeader) referenceHeader = getNormalizedStructure(indexHeader);
            if (indexFooter) referenceFooter = getNormalizedStructure(indexFooter);
        }

        for (const file of htmlFiles) {
            const fileErrors = [];
            const filePath = resolveWorkingPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            const dom = new JSDOM(content);
            const document = dom.window.document;

            // Skip header/footer checks for index.html itself
            if (file !== 'index.html' && indexDoc) {
                const header = document.querySelector('header');
                const footer = document.querySelector('footer');

                // Compare header structure
                if (header && referenceHeader) {
                    const currentHeader = getNormalizedStructure(header);
                    if (currentHeader !== referenceHeader) {
                        const firstDiff = findFirstDifference(header.outerHTML, indexDoc.querySelector('header').outerHTML);
                        fileErrors.push({
                            filePath,
                            line: content.split('\n').findIndex(line => line.includes('<header')) + 1,
                            message: 'Header structure differs from index.html',
                            context: firstDiff
                        });
                    }
                } else if (!header && referenceHeader) {
                    fileErrors.push({
                        filePath,
                        line: 1,
                        message: 'Missing header element (present in index.html)'
                    });
                }

                // Compare footer structure
                if (footer && referenceFooter) {
                    const currentFooter = getNormalizedStructure(footer);
                    if (currentFooter !== referenceFooter) {
                        const firstDiff = findFirstDifference(footer.outerHTML, indexDoc.querySelector('footer').outerHTML);
                        fileErrors.push({
                            filePath,
                            line: content.split('\n').findIndex(line => line.includes('<footer')) + 1,
                            message: 'Footer structure differs from index.html',
                            context: firstDiff
                        });
                    }
                } else if (!footer && referenceFooter) {
                    fileErrors.push({
                        filePath,
                        line: 1,
                        message: 'Missing footer element (present in index.html)'
                    });
                }
            }

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

            // Check links and buttons for accessibility
            const clickableElements = document.querySelectorAll('a, button');
            clickableElements.forEach(element => {
                const lineNumber = content.split('\n').findIndex(line => line.includes(element.outerHTML)) + 1;
                const visibleText = element.textContent.trim();
                const hasAriaLabel = element.hasAttribute('aria-label');
                const hasChildSvgWithAriaLabel = element.querySelector('svg[aria-label]');
                
                if (!visibleText && !hasAriaLabel && !hasChildSvgWithAriaLabel) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: `${element.tagName.toLowerCase()} has no text content and no accessibility attributes (aria-label or aria-label on SVG)`,
                        context: element.outerHTML
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
                } else if (href === file && !link.hasAttribute('disabled')) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Link pointing to the current page must have disabled attribute',
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
                    let inputLine = -1;
                    const inputHTML = input.outerHTML;
                    
                    inputLine = formContent.findIndex(line => line.includes(inputHTML));
                    
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

            logValidationErrors(filePath, 'HTML', fileErrors);
            allErrors.push(...fileErrors);
        }

        return allErrors;
    } catch (error) {
        console.error('Error during HTML validation:', error);
        return [{
            filePath: 'unknown',
            line: 1,
            message: `HTML validation failed: ${error.message}`
        }];
    }
}

module.exports = validateHTML; 
module.exports = validateHTML; 