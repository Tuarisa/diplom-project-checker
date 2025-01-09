const fs = require('fs').promises;
const path = require('path');
const parse5 = require('parse5');
const postcss = require('postcss');
const scss = require('postcss-scss');
const { WORKING_DIR, STYLES_DIR, HTML_DIR, resolveWorkingPath, resolveStylesPath, resolveHtmlPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

// List of elements that are block by default
const defaultBlockElements = new Set([
    'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'article', 'aside', 'footer', 'header', 'section',
    'nav', 'main', 'form', 'ul', 'ol', 'li'
]);

// List of CSS properties that are inheritable
const inheritableProperties = new Set([
    // Text properties
    'color',
    'font',
    'font-family',
    'font-size',
    'font-weight',
    'font-variant',
    'font-style',
    'line-height',
    'letter-spacing',
    'text-align',
    'text-indent',
    'text-transform',
    'white-space',
    'word-spacing',
    'word-break',
    'word-wrap',
    'text-shadow',
    
    // List properties
    'list-style',
    'list-style-type',
    'list-style-position',
    'list-style-image',
    
    // Table properties
    'border-collapse',
    'border-spacing',
    'caption-side',
    'empty-cells',
    
    // Other
    'cursor',
    'visibility',
    'vertical-align'
]);

// Function to get HTML string representation of an element
function getElementHTML(node) {
    let html = `<${node.nodeName}`;
    if (node.attrs) {
        html += node.attrs.map(attr => ` ${attr.name}="${attr.value}"`).join('');
    }
    html += '>';
    return html;
}

// Function to get line number from HTML content and element
function getLineNumber(content, element) {
    const elementHtml = getElementHTML(element);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(elementHtml)) {
            return i + 1;
        }
    }
    return 1;
}

// Function to get class names from element
function getClassNames(node) {
    const attrs = node.attrs || [];
    const classAttr = attrs.find(attr => attr.name === 'class');
    return classAttr ? classAttr.value.split(' ') : [];
}

// Function to traverse HTML tree and find paragraphs
function findParagraphs(node, paragraphs = []) {
    if (node.nodeName === 'p') {
        paragraphs.push(node);
    }
    
    if (node.childNodes) {
        node.childNodes.forEach(child => findParagraphs(child, paragraphs));
    }
    
    return paragraphs;
}

// Function to check font styles on paragraph elements
async function checkParagraphFontStyles(htmlContent, styleContent, filePath, fileErrors) {
    // Parse HTML with location info
    const document = parse5.parse(htmlContent, {
        sourceCodeLocationInfo: true
    });
    
    // Parse SCSS/CSS content
    const root = postcss.parse(styleContent, { parser: scss });
    
    // Find all paragraphs
    const paragraphs = findParagraphs(document);
    
    paragraphs.forEach(paragraph => {
        const classes = getClassNames(paragraph);
        const lineNumber = getLineNumber(htmlContent, paragraph);
        
        // Check each class for font-related properties
        classes.forEach(className => {
            if (!className) return;
            
            root.walkRules(new RegExp(`\\.${className}(?![\\w-])`), rule => {
                rule.walkDecls(decl => {
                    if (decl.prop.includes('font') || 
                        decl.prop === 'line-height' || 
                        decl.prop === 'letter-spacing' ||
                        decl.prop === 'text-align') {
                        fileErrors.push({
                            filePath,
                            line: lineNumber,
                            message: `Paragraph element should not have direct font styling. Class: ${className}`,
                            context: `${decl.prop}: ${decl.value} (${filePath}:${lineNumber}) - defined in ${decl.source.input.file}:${decl.source.start.line}`,
                            suggestion: 'Move font styles to a parent element or create a typography class'
                        });
                    }
                });
            });
        });
    });
}

// Function to check default property overrides
async function checkDefaultPropertyOverrides(content, filePath, fileErrors, htmlFiles) {
    const root = postcss.parse(content, { parser: scss });
    const classesWithDisplayBlock = new Map(); // Map to store classes with display: block

    // First pass: collect all classes that set display: block
    root.walkRules(rule => {
        if (hasPseudoElementsOrClasses(rule.selector)) return;

        rule.walkDecls(decl => {
            if (decl.prop === 'display' && decl.value === 'block') {
                // Extract class names from the selector
                const classNames = rule.selector
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s.startsWith('.'))
                    .map(s => s.split(' ')[0].substring(1)); // Get the first class name

                classNames.forEach(className => {
                    if (!classesWithDisplayBlock.has(className)) {
                        classesWithDisplayBlock.set(className, {
                            line: decl.source.start.line,
                            filePath: filePath
                        });
                    }
                });
            }
        });
    });

    // If we found any display: block declarations, check HTML files
    if (classesWithDisplayBlock.size > 0) {
        for (const htmlFile of htmlFiles) {
            const htmlContent = await fs.readFile(htmlFile, 'utf8');
            const document = parse5.parse(htmlContent, { sourceCodeLocationInfo: true });

            // Function to check elements recursively
            function checkElement(node) {
                if (node.nodeName && defaultBlockElements.has(node.nodeName)) {
                    // Get classes of this element
                    const classNames = getClassNames(node);
                    
                    // Check if any of these classes sets display: block
                    classNames.forEach(className => {
                        if (classesWithDisplayBlock.has(className)) {
                            const { line, filePath: styleFilePath } = classesWithDisplayBlock.get(className);
                            const elementLine = node.sourceCodeLocation ? node.sourceCodeLocation.startLine : 1;
                            
                            fileErrors.push({
                                filePath: styleFilePath,
                                line: line,
                                message: `Unnecessary display: block on naturally block-level element <${node.nodeName}>`,
                                context: `Style defined in ${styleFilePath}:${line} is applied to <${node.nodeName}> in ${htmlFile}:${elementLine}`,
                                suggestion: `Remove redundant display: block from class '${className}' as <${node.nodeName}> is block by default`
                            });
                        }
                    });
                }

                // Check child elements
                if (node.childNodes) {
                    node.childNodes.forEach(checkElement);
                }
            }

            checkElement(document);
        }
    }

    // Original check for direct element selectors
    root.walkRules(rule => {
        const selector = rule.selector.toLowerCase();
        
        // Check if rule directly targets default block elements
        defaultBlockElements.forEach(element => {
            if (selector.includes(`${element}[`) || selector === element || selector.startsWith(`${element}.`)) {
                rule.walkDecls(decl => {
                    if (decl.prop === 'display') {
                        if ((decl.value === 'block' && defaultBlockElements.has(element)) ||
                            (decl.value === 'list-item' && (element === 'li'))) {
                            fileErrors.push({
                                filePath,
                                line: decl.source.start.line,
                                message: `Unnecessary display property override on ${element}`,
                                context: `${decl.prop}: ${decl.value} (${filePath}:${decl.source.start.line})`,
                                suggestion: `Remove redundant display property, ${element} is ${decl.value} by default`
                            });
                        }
                    }
                });
            }
        });
    });
}

// Function to parse combined CSS values into parts
function parseCombinedValue(value) {
    return value.split(/\s+/);
}

// Function to check if values have partial overlap
function hasPartialOverlap(value1, value2) {
    // Handle combined properties like padding, margin
    const parts1 = parseCombinedValue(value1);
    const parts2 = parseCombinedValue(value2);
    
    // If both are single values, they should be exactly equal to be considered overlapping
    if (parts1.length === 1 && parts2.length === 1) {
        return false;
    }
    
    // For combined values, check if they share some parts but are not identical
    const shorter = parts1.length <= parts2.length ? parts1 : parts2;
    const longer = parts1.length <= parts2.length ? parts2 : parts1;
    
    return shorter.every((part, index) => part === longer[index]) && shorter.length !== longer.length;
}

// Function to check if selector contains pseudo-elements or pseudo-classes
function hasPseudoElementsOrClasses(selector) {
    const pseudoPattern = /:[a-zA-Z]/;
    return pseudoPattern.test(selector);
}

// Function to check property duplications
function checkPropertyDuplications(content, filePath, fileErrors) {
    const root = postcss.parse(content, { parser: scss });
    const selectorProperties = new Map();

    // First pass: collect all properties by their full selectors
    root.walkRules(rule => {
        // Skip pseudo-elements and pseudo-classes
        if (hasPseudoElementsOrClasses(rule.selector)) {
            return;
        }

        const selector = rule.selector;
        if (!selectorProperties.has(selector)) {
            selectorProperties.set(selector, new Map());
        }
        
        const properties = selectorProperties.get(selector);
        
        rule.walkDecls(decl => {
            // Only track inheritable properties
            if (!inheritableProperties.has(decl.prop)) {
                return;
            }

            if (!properties.has(decl.prop)) {
                properties.set(decl.prop, []);
            }
            properties.get(decl.prop).push({
                value: decl.value,
                line: decl.source.start.line,
                decl: decl
            });
        });
    });

    // Second pass: check for duplicates within same selector
    for (const [selector, properties] of selectorProperties) {
        for (const [prop, declarations] of properties) {
            if (declarations.length > 1) {
                // Check for exact duplicates within same selector
                declarations.forEach((decl, index) => {
                    for (let i = index + 1; i < declarations.length; i++) {
                        const otherDecl = declarations[i];
                        if (decl.value === otherDecl.value) {
                            fileErrors.push({
                                filePath,
                                line: otherDecl.line,
                                message: `Duplicate inheritable property "${prop}" within same selector`,
                                context: `Previous: ${prop}: ${decl.value} (line: ${decl.line})\nCurrent: ${prop}: ${otherDecl.value} (line: ${otherDecl.line})`,
                                suggestion: 'Remove duplicate property within the same selector'
                            });
                        }
                    }
                });
            }
        }
    }

    // Third pass: check for parent-child inheritance issues
    root.walkRules(rule => {
        if (hasPseudoElementsOrClasses(rule.selector)) return;

        const currentSelector = rule.selector;
        
        // Find potential parent selectors
        const parentSelectors = Array.from(selectorProperties.keys())
            .filter(selector => {
                // Check if current selector is a child of this selector
                return currentSelector.includes(selector) && currentSelector !== selector;
            });

        rule.walkDecls(decl => {
            // Only check inheritable properties
            if (!inheritableProperties.has(decl.prop)) {
                return;
            }

            // Check against each parent's properties
            parentSelectors.forEach(parentSelector => {
                const parentProps = selectorProperties.get(parentSelector);
                if (parentProps && parentProps.has(decl.prop)) {
                    const parentDecls = parentProps.get(decl.prop);
                    
                    parentDecls.forEach(parentDecl => {
                        // Check for redundant inheritance
                        if (decl.value === parentDecl.value) {
                            fileErrors.push({
                                filePath,
                                line: decl.source.start.line,
                                message: `Redundant inheritable property "${decl.prop}" inherits same value from parent`,
                                context: `Parent (${parentSelector}): ${decl.prop}: ${parentDecl.value} (line: ${parentDecl.line})\nChild (${currentSelector}): ${decl.prop}: ${decl.value} (line: ${decl.source.start.line})`,
                                suggestion: 'Remove redundant property from child as it inherits the same value from parent'
                            });
                        }
                    });
                }
            });
        });
    });
}

// Helper function to identify shorthand properties
function isShorthandProperty(prop) {
    return [
        'padding',
        'margin',
        'border',
        'background',
        'font',
        'border-radius',
        'transition',
        'animation',
        'flex',
        'grid',
        'outline'
    ].includes(prop);
}

// Function to check for CAPS LOCK text
function checkCapsLockUsage(content, filePath, fileErrors) {
    const root = postcss.parse(content, { parser: scss });
    
    // Regular expression to match 3 or more consecutive uppercase letters
    const capsLockPattern = /[A-Z]{3,}/;
    
    // Check property values
    root.walkDecls(decl => {
        if (typeof decl.value === 'string' && capsLockPattern.test(decl.value)) {
            const match = decl.value.match(capsLockPattern)[0];
            fileErrors.push({
                filePath,
                line: decl.source.start.line,
                message: `Found CAPS LOCK text "${match}" in CSS value`,
                context: `${decl.prop}: ${decl.value} (${filePath}:${decl.source.start.line})`,
                suggestion: 'Use regular case or CSS text-transform property instead of CAPS LOCK'
            });
        }
    });
    
    // Check selectors
    root.walkRules(rule => {
        if (capsLockPattern.test(rule.selector)) {
            const match = rule.selector.match(capsLockPattern)[0];
            fileErrors.push({
                filePath,
                line: rule.source.start.line,
                message: `Found CAPS LOCK text "${match}" in selector`,
                context: `${rule.selector} (${filePath}:${rule.source.start.line})`,
                suggestion: 'Use lowercase or camelCase for selectors instead of CAPS LOCK'
            });
        }
    });
    
    // Check custom properties and at-rules
    root.walkAtRules(atRule => {
        if (capsLockPattern.test(atRule.params)) {
            const match = atRule.params.match(capsLockPattern)[0];
            fileErrors.push({
                filePath,
                line: atRule.source.start.line,
                message: `Found CAPS LOCK text "${match}" in at-rule`,
                context: `@${atRule.name} ${atRule.params} (${filePath}:${atRule.source.start.line})`,
                suggestion: 'Use regular case instead of CAPS LOCK'
            });
        }
    });
}

// Function to check active classes on list items
async function checkActiveClassesOnListItems(htmlContent, filePath, fileErrors) {
    const document = parse5.parse(htmlContent, { sourceCodeLocationInfo: true });

    function checkNode(node) {
        if (node.nodeName === 'li') {
            // Find any nested <a> elements
            const findNestedAnchors = (n, anchors = []) => {
                if (n.nodeName === 'a') {
                    anchors.push(n);
                }
                if (n.childNodes) {
                    n.childNodes.forEach(child => findNestedAnchors(child, anchors));
                }
                return anchors;
            };

            const nestedAnchors = findNestedAnchors(node);
            const liClasses = getClassNames(node);
            
            nestedAnchors.forEach(anchor => {
                const anchorClasses = getClassNames(anchor);
                const activeClasses = anchorClasses.filter(className => 
                    className.toLowerCase().includes('active') || 
                    className.toLowerCase().includes('current')
                );

                if (activeClasses.length > 0) {
                    const anchorLine = anchor.sourceCodeLocation ? anchor.sourceCodeLocation.startLine : 1;
                    fileErrors.push({
                        filePath,
                        line: anchorLine,
                        message: `Active state class found on <a> element inside <li>`,
                        context: `Class "${activeClasses.join(', ')}" is applied to <a> element at ${filePath}:${anchorLine}`,
                        suggestion: `Move the active state class "${activeClasses.join(', ')}" to the parent <li> element for better semantic structure`
                    });
                }
            });
        }

        if (node.childNodes) {
            node.childNodes.forEach(checkNode);
        }
    }

    checkNode(document);
}

// Function to check iframe accessibility
function checkIframeAccessibility(document, filePath, fileErrors) {
    function checkNode(node) {
        if (node.nodeName === 'iframe') {
            const attrs = node.attrs || [];
            const titleAttr = attrs.find(attr => attr.name === 'title');
            
            if (!titleAttr || !titleAttr.value.trim()) {
                const line = node.sourceCodeLocation ? node.sourceCodeLocation.startLine : 1;
                fileErrors.push({
                    filePath,
                    line,
                    message: 'Iframe element missing title attribute',
                    context: `<iframe> element at ${filePath}:${line}`,
                    suggestion: 'Add a descriptive title attribute to the iframe for better accessibility'
                });
            }
        }

        if (node.childNodes) {
            node.childNodes.forEach(child => checkNode(child));
        }
    }

    checkNode(document);
}

// Function to check form elements accessibility
function checkFormElementsAccessibility(document, filePath, fileErrors) {
    const formElements = new Set(['input', 'textarea', 'select']);
    const inputTypesRequiringLabel = new Set([
        'text', 'password', 'email', 'tel', 'url', 'search',
        'number', 'date', 'datetime-local', 'time', 'week',
        'month', 'color', 'file', 'range', 'hidden'
    ]);
    
    // First, collect all labels and their associated 'for' attributes
    const labelForIds = new Set();
    function collectLabels(node) {
        if (node.nodeName === 'label') {
            const attrs = node.attrs || [];
            const forAttr = attrs.find(attr => attr.name === 'for');
            if (forAttr && forAttr.value) {
                labelForIds.add(forAttr.value);
            }
            
            // Check if label has nested input (implicit association)
            let hasNestedInput = false;
            const checkForNestedInput = (n) => {
                if (formElements.has(n.nodeName)) {
                    hasNestedInput = true;
                }
                if (n.childNodes) {
                    n.childNodes.forEach(checkForNestedInput);
                }
            };
            
            if (node.childNodes) {
                node.childNodes.forEach(checkForNestedInput);
            }
            
            if (!forAttr && !hasNestedInput) {
                const line = node.sourceCodeLocation ? node.sourceCodeLocation.startLine : 1;
                fileErrors.push({
                    filePath,
                    line,
                    message: 'Label element without association to form control',
                    context: `<label> element at ${filePath}:${line}`,
                    suggestion: 'Add "for" attribute to label or nest form control inside the label'
                });
            }
        }
        
        if (node.childNodes) {
            node.childNodes.forEach(collectLabels);
        }
    }
    
    // Then check all form elements
    function checkFormElement(node) {
        if (formElements.has(node.nodeName)) {
            const attrs = node.attrs || [];
            const idAttr = attrs.find(attr => attr.name === 'id');
            const typeAttr = attrs.find(attr => attr.name === 'type');
            const type = typeAttr ? typeAttr.value.toLowerCase() : 'text';
            
            // Skip only submit and button types
            if (node.nodeName === 'input' && (type === 'submit' || type === 'button')) {
                return;
            }
            
            // Check if element has an associated label
            let hasLabel = false;
            let hasAriaLabel = false;
            
            // Check for label association via 'id'
            if (idAttr && labelForIds.has(idAttr.value)) {
                hasLabel = true;
            }
            
            // Check for aria-label or aria-labelledby
            const ariaLabel = attrs.find(attr => attr.name === 'aria-label');
            const ariaLabelledby = attrs.find(attr => attr.name === 'aria-labelledby');
            if ((ariaLabel && ariaLabel.value.trim()) || 
                (ariaLabelledby && ariaLabelledby.value.trim())) {
                hasAriaLabel = true;
            }
            
            // Check if element is nested within a label
            let parent = node.parentNode;
            while (parent) {
                if (parent.nodeName === 'label') {
                    hasLabel = true;
                    break;
                }
                parent = parent.parentNode;
            }
            
            const line = node.sourceCodeLocation ? node.sourceCodeLocation.startLine : 1;
            
            // Report error if no proper label is found
            if (!hasLabel) {
                fileErrors.push({
                    filePath,
                    line,
                    message: `Form element <${node.nodeName}> missing associated label`,
                    context: `<${node.nodeName}> element at ${filePath}:${line}`,
                    suggestion: 'Add a label element with matching "for" attribute or nest the element inside a label'
                });
            }
            
            // Report separate warning if ARIA is used instead of label
            if (!hasLabel && hasAriaLabel) {
                fileErrors.push({
                    filePath,
                    line,
                    message: `Form element using ARIA attributes instead of proper label`,
                    context: `<${node.nodeName}> element at ${filePath}:${line} uses ARIA for labeling`,
                    suggestion: 'Replace ARIA labeling with proper <label> element for better accessibility'
                });
            }
        }
        
        if (node.childNodes) {
            node.childNodes.forEach(checkFormElement);
        }
    }
    
    // First collect all labels
    collectLabels(document);
    // Then check all form elements
    checkFormElement(document);
}

async function validateSemanticStyles() {
    try {
        const styleFiles = await fs.readdir(resolveStylesPath());
        const htmlFiles = await fs.readdir(resolveHtmlPath());
        const allErrors = [];
        const fileErrorsMap = new Map();

        // Get full paths for HTML files
        const htmlFilePaths = htmlFiles
            .filter(f => f.endsWith('.html'))
            .map(f => resolveHtmlPath(f));

        // Process style files
        for (const file of styleFiles.filter(f => f.endsWith('.scss') || f.endsWith('.css'))) {
            const filePath = resolveStylesPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            
            if (!fileErrorsMap.has(filePath)) {
                fileErrorsMap.set(filePath, []);
            }
            const fileErrors = fileErrorsMap.get(filePath);

            // Run style-specific checks
            await checkDefaultPropertyOverrides(content, filePath, fileErrors, htmlFilePaths);
            checkPropertyDuplications(content, filePath, fileErrors);
        }

        // Process HTML files and cross-reference with styles
        for (const file of htmlFiles.filter(f => f.endsWith('.html'))) {
            const htmlPath = resolveHtmlPath(file);
            const htmlContent = await fs.readFile(htmlPath, 'utf8');
            
            // Get all style content for cross-referencing
            const styleContent = await Promise.all(
                styleFiles
                    .filter(f => f.endsWith('.scss') || f.endsWith('.css'))
                    .map(f => fs.readFile(resolveStylesPath(f), 'utf8'))
            ).then(contents => contents.join('\n'));

            if (!fileErrorsMap.has(htmlPath)) {
                fileErrorsMap.set(htmlPath, []);
            }
            const fileErrors = fileErrorsMap.get(htmlPath);

            // Run HTML-specific checks
            await checkParagraphFontStyles(htmlContent, styleContent, htmlPath, fileErrors);
            await checkActiveClassesOnListItems(htmlContent, htmlPath, fileErrors);
            
            // Parse HTML once for all checks
            const document = parse5.parse(htmlContent, { sourceCodeLocationInfo: true });
            
            // Run accessibility checks
            checkIframeAccessibility(document, htmlPath, fileErrors);
            checkFormElementsAccessibility(document, htmlPath, fileErrors);
            
            // Check HTML content for CAPS LOCK
            function checkNodeText(node) {
                if (node.nodeName === '#text' && node.value) {
                    const capsLockPattern = /[A-Z]{3,}/;
                    if (capsLockPattern.test(node.value)) {
                        const match = node.value.match(capsLockPattern)[0];
                        const parentElement = node.parentNode;
                        if (parentElement && parentElement.sourceCodeLocation) {
                            fileErrors.push({
                                filePath: htmlPath,
                                line: parentElement.sourceCodeLocation.startLine,
                                message: `Found CAPS LOCK text "${match}" in HTML content`,
                                context: `Text content: "${node.value.trim()}" (${htmlPath}:${parentElement.sourceCodeLocation.startLine})`,
                                suggestion: 'Use regular case and CSS text-transform property instead of CAPS LOCK'
                            });
                        }
                    }
                }
                
                if (node.childNodes) {
                    node.childNodes.forEach(checkNodeText);
                }
            }
            
            checkNodeText(document);
        }

        // Log all errors
        for (const [filePath, fileErrors] of fileErrorsMap) {
            if (fileErrors.length > 0) {
                logValidationErrors(filePath, 'Semantic Styles', fileErrors);
                allErrors.push(...fileErrors);
            }
        }

        return allErrors;
    } catch (error) {
        console.error('Error during semantic styles validation:', error);
        return [{
            filePath: resolveWorkingPath(STYLES_DIR),
            line: 1,
            message: `Error during semantic styles validation: ${error.message}`
        }];
    }
}

module.exports = validateSemanticStyles; 