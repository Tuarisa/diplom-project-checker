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
function checkDefaultPropertyOverrides(content, filePath, fileErrors) {
    const root = postcss.parse(content, { parser: scss });
    
    root.walkRules(rule => {
        const selector = rule.selector.toLowerCase();
        
        // Check if rule targets default block elements
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

async function validateSemanticStyles() {
    try {
        const styleFiles = await fs.readdir(resolveStylesPath());
        const htmlFiles = await fs.readdir(resolveHtmlPath());
        const allErrors = [];
        const fileErrorsMap = new Map();

        // Process style files
        for (const file of styleFiles.filter(f => f.endsWith('.scss') || f.endsWith('.css'))) {
            const filePath = resolveStylesPath(file);
            const content = await fs.readFile(filePath, 'utf8');
            
            if (!fileErrorsMap.has(filePath)) {
                fileErrorsMap.set(filePath, []);
            }
            const fileErrors = fileErrorsMap.get(filePath);

            // Run style-specific checks
            checkDefaultPropertyOverrides(content, filePath, fileErrors);
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