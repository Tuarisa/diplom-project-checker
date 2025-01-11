const fs = require('fs').promises;
const path = require('path');
const stylelint = require('stylelint');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const { WORKING_DIR, STYLES_DIR, resolveWorkingPath, resolveStylesPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

// Function to check selector nesting depth
function checkSelectorNestingDepth(selector) {
    // Skip validation for specific state-related selectors
    const statePatterns = [
        /:checked/,
        /:focused/,
        /:focus/,
        /:selected/,
        /:active/,
        /:disabled/,
        /--checked/,
        /--focused/,
        /--selected/,
        /--active/,
        /--disabled/,
        /\[checked\]/,
        /\[aria-checked\]/,
        /\[aria-selected\]/,
        /\[aria-expanded\]/,
        /\[disabled\]/,
        /\[aria-disabled\]/,
        /\.is-checked/,
        /\.is-focused/,
        /\.is-selected/,
        /\.is-expanded/,
        /\.is-active/,
        /\.is-disabled/
    ];

    // If selector contains any of the state patterns, skip depth validation
    if (statePatterns.some(pattern => pattern.test(selector))) {
        return 0; // Return 0 to skip validation for these cases
    }

    // Remove pseudo-classes, pseudo-elements and clean up combinators
    const cleanSelector = selector
        .replace(/:[a-zA-Z-]+(?:\([^)]*\))?/g, '') // Remove pseudo-classes
        .replace(/:{1,2}[a-zA-Z-]+/g, '') // Remove pseudo-elements
        .replace(/\s*[+>~]\s*/g, ' ') // Replace combinators with spaces
        .trim();
    
    // Split by spaces and filter out empty strings and combinators
    const parts = cleanSelector
        .split(' ')
        .filter(part => part.length > 0 && !['>', '+', '~'].includes(part));
    
    // Count BEM elements (double underscore) as nesting level
    const bemNestingLevel = (selector.match(/__/g) || []).length;
    
    // Count space-separated parts as nesting level
    const spaceNestingLevel = Math.max(0, parts.length - 1);
    
    // Return the maximum of BEM nesting and space nesting
    return Math.max(bemNestingLevel, spaceNestingLevel);
}

// Function to check selectors nesting
function checkSelectorsNesting(content, filePath, fileErrors) {
    const MAX_NESTING_DEPTH = 2;
    let currentSelector = '';
    let inBlock = false;
    let blockStart = 0;
    
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();

        // Skip comments
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
            return;
        }

        // Find selectors
        if (trimmedLine.includes('{')) {
            currentSelector = trimmedLine.replace('{', '').trim();
            blockStart = lineNumber;
            inBlock = true;

            // Split multiple selectors (separated by commas)
            const selectors = currentSelector.split(',').map(s => s.trim());
            
            selectors.forEach(selector => {
                const nestingDepth = checkSelectorNestingDepth(selector);
                if (nestingDepth > MAX_NESTING_DEPTH) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: `Selector nesting depth (${nestingDepth}) exceeds maximum allowed (${MAX_NESTING_DEPTH})`,
                        context: selector,
                        suggestion: 'Consider refactoring to reduce nesting depth. Use BEM modifiers or separate classes instead of deep nesting.'
                    });
                }
            });
        }

        if (trimmedLine === '}') {
            inBlock = false;
        }
    });
}

// Функция для проверки интерактивных элементов
function checkInteractiveElements(content, filePath, fileErrors) {
    const lines = content.split('\n');
    const interactiveSelectors = new Set();
    let currentSelector = null;
    let hasHover = false;
    let hasActive = false;
    let hasFocus = false;
    
    // Регулярки для поиска только BEM блоков и элементов
    const bemPattern = /^\.([a-z0-9]+-[a-z0-9]+(?:__[a-z0-9]+-[a-z0-9]+)?)/;
    
    // Паттерны для интерактивных элементов в BEM
    const interactiveNames = /(btn|button|link)/i;
    
    // Свойства, которые могут нарушать поток документа
    const flowBreakingProps = [
        'width',
        'height',
        'margin',
        'padding',
        'position',
        'display',
        'top',
        'left',
        'right',
        'bottom'
    ];

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();

        // Пропускаем комментарии
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
            return;
        }

        // Ищем селектор
        if (trimmedLine.includes('{')) {
            currentSelector = null; // Сбрасываем селектор по умолчанию
            
            // Проверяем, что это BEM селектор
            const bemMatch = trimmedLine.match(bemPattern);
            if (bemMatch) {
                const selector = bemMatch[1];
                
                // Проверяем, что это не модификатор и содержит интерактивное имя
                if (!selector.includes('--') && interactiveNames.test(selector)) {
                    currentSelector = selector;
                    interactiveSelectors.add(selector);
                    hasHover = false;
                    hasActive = false;
                    hasFocus = false;
                }
            }
        }
        
        // Проверяем состояния только для валидных BEM селекторов
        if (currentSelector) {
            if (line.includes(':hover')) hasHover = true;
            if (line.includes(':active')) hasActive = true;
            if (line.includes(':focus')) hasFocus = true;

            // Проверяем свойства в состояниях
            if ((line.includes(':hover') || line.includes(':focus')) && 
                flowBreakingProps.some(prop => line.includes(prop))) {
                fileErrors.push({
                    filePath,
                    line: lineNumber,
                    message: `Interactive element state changes document flow: ${currentSelector}`,
                    context: line.trim(),
                    suggestion: 'Use transform or opacity for hover/focus states instead'
                });
            }
        }

        // Если блок закрывается, проверяем наличие всех состояний
        if (trimmedLine === '}' && currentSelector) {
            if (!hasHover || !hasActive || !hasFocus) {
                const missingStates = [];
                if (!hasHover) missingStates.push(':hover');
                if (!hasActive) missingStates.push(':active');
                if (!hasFocus) missingStates.push(':focus');

                fileErrors.push({
                    filePath,
                    line: lineNumber,
                    message: `Interactive element ${currentSelector} missing states: ${missingStates.join(', ')}`,
                    context: `Selector: ${currentSelector}`,
                    suggestion: 'Add missing states to improve accessibility and user experience'
                });
            }
            currentSelector = null;
        }
    });
}

// Функция для проверки фона
function checkBackgroundProperties(content, filePath, fileErrors) {
    const lines = content.split('\n');
    let hasBackgroundImage = false;
    let hasBackgroundColor = false;
    let backgroundImageLine = 0;
    let currentSelector = '';
    let inBlock = false;
    let isSvgBackground = false;

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();

        // Skip comments
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
            return;
        }

        // Find block start
        if (trimmedLine.includes('{')) {
            currentSelector = trimmedLine.replace('{', '').trim();
            inBlock = true;
            hasBackgroundImage = false;
            hasBackgroundColor = false;
            isSvgBackground = false;
        }

        // Check properties inside block
        if (inBlock) {
            if (trimmedLine.includes('background-image') || 
                (trimmedLine.includes('background:') && trimmedLine.includes('url('))) {
                hasBackgroundImage = true;
                backgroundImageLine = lineNumber;
                // Check if it's an SVG background
                if (trimmedLine.includes('.svg')) {
                    isSvgBackground = true;
                }
            }
            if (trimmedLine.includes('background-color') || 
                (trimmedLine.includes('background:') && /:#?[0-9a-f]{3,8}|rgba?\(|hsla?\(/.test(trimmedLine))) {
                hasBackgroundColor = true;
            }
        }

        // End of block - check results
        if (trimmedLine === '}') {
            if (hasBackgroundImage && !hasBackgroundColor && !isSvgBackground) {
                fileErrors.push({
                    filePath,
                    line: backgroundImageLine,
                    message: `Missing background-color for element with background-image`,
                    context: `Selector: ${currentSelector}`,
                    suggestion: 'Add background-color to ensure text readability when image fails to load'
                });
            }
            inBlock = false;
        }
    });
}

// Функция для проверки закомментированного кода
function checkCommentedCode(content, filePath, fileErrors) {
    const lines = content.split('\n');
    let inCommentBlock = false;
    let commentBlockStart = 0;
    let commentedCode = [];

    // Паттерны для определения кода в комментариях
    const codePatterns = [
        /[{};]/,                    // CSS синтаксис
        /^[.#][a-zA-Z]/,           // Селекторы
        /^[a-z-]+:/,               // CSS свойства
        /@media|@keyframes|@import/ // CSS директивы
    ];

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();

        // Начало блочного комментария
        if (trimmedLine.startsWith('/*')) {
            inCommentBlock = true;
            commentBlockStart = lineNumber;
            commentedCode = [];
        }

        // Проверяем содержимое комментария
        if (inCommentBlock || trimmedLine.startsWith('//')) {
            const uncommentedLine = trimmedLine
                .replace(/^\/\*/, '')
                .replace(/\*\/$/, '')
                .replace(/^\/\//, '')
                .trim();

            if (codePatterns.some(pattern => pattern.test(uncommentedLine))) {
                commentedCode.push(uncommentedLine);
            }
        }

        // Конец блочного комментария
        if (trimmedLine.endsWith('*/')) {
            inCommentBlock = false;
            if (commentedCode.length > 0) {
                fileErrors.push({
                    filePath,
                    line: commentBlockStart,
                    message: 'Found commented code block',
                    context: commentedCode.join('\n'),
                    suggestion: 'Remove commented code to keep the codebase clean. Use version control for code history'
                });
            }
        }

        // Однострочный комментарий с кодом
        if (trimmedLine.startsWith('//') && commentedCode.length > 0) {
            fileErrors.push({
                filePath,
                line: lineNumber,
                message: 'Found commented code',
                context: trimmedLine,
                suggestion: 'Remove commented code to keep the codebase clean. Use version control for code history'
            });
            commentedCode = [];
        }
    });
}

// Function to check color formats
function checkColorFormats(content, filePath, fileErrors) {
    const lines = content.split('\n');
    let inBlock = false;
    let currentSelector = '';

    // Pattern for color properties
    const colorProps = [
        'color',
        'background-color',
        'border-color',
        'outline-color',
        'box-shadow',
        'text-shadow'
    ];

    // Pattern for named colors
    const namedColors = /\b(red|blue|green|yellow|white|black|gray|purple|orange|pink|brown|violet|indigo|gold|silver|bronze|navy|olive|teal|maroon|aqua|lime|fuchsia)\b/i;

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();

        // Skip comments
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
            return;
        }

        // Find block start
        if (trimmedLine.includes('{')) {
            currentSelector = trimmedLine.replace('{', '').trim();
            inBlock = true;
        }

        // Check properties inside block
        if (inBlock) {
            // Skip if line contains gradient or CSS variable
            if (trimmedLine.includes('gradient') || trimmedLine.includes('var(')) {
                return;
            }

            // Check for color properties
            if (colorProps.some(prop => trimmedLine.includes(prop + ':'))) {
                // Check for rgba/rgb format when not needed
                if (trimmedLine.includes('rgb') && !trimmedLine.includes('rgba')) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Use HEX format instead of rgb()',
                        context: trimmedLine,
                        suggestion: 'Convert rgb() to HEX color format for consistency'
                    });
                }

                // Check for named colors only if not inside a CSS variable
                const hasNamedColor = namedColors.test(trimmedLine);
                if (hasNamedColor && !trimmedLine.includes('var(--color-')) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Use HEX format instead of named color',
                        context: trimmedLine,
                        suggestion: 'Convert named color to HEX color format for consistency'
                    });
                }

                // Check for HSL format
                if (trimmedLine.includes('hsl')) {
                    fileErrors.push({
                        filePath,
                        line: lineNumber,
                        message: 'Use HEX format instead of hsl()/hsla()',
                        context: trimmedLine,
                        suggestion: 'Convert HSL color to HEX color format for consistency'
                    });
                }
            }
        }

        if (trimmedLine === '}') {
            inBlock = false;
        }
    });
}

async function validateStyles() {
    try {
        const files = await fs.readdir(resolveStylesPath());
        const styleFiles = files.filter(file => 
            (file.endsWith('.css') || file.endsWith('.scss')) && 
            !file.includes('normalize')
        );
        const allErrors = [];
        const fileErrorsMap = new Map();
        const colorUsage = new Map();

        for (const file of styleFiles) {
            const filePath = resolveStylesPath(file);
            const fullPath = resolveWorkingPath(path.join(STYLES_DIR, file));
            const content = await fs.readFile(filePath, 'utf8');
            
            if (!fileErrorsMap.has(fullPath)) {
                fileErrorsMap.set(fullPath, []);
            }
            const fileErrors = fileErrorsMap.get(fullPath);

            // Add color format check
            checkColorFormats(content, fullPath, fileErrors);

            // Add new nesting check
            checkSelectorsNesting(content, fullPath, fileErrors);

            // Stylelint validation
            const stylelintResult = await stylelint.lint({
                code: content,
                fix: false,
                configFile: path.join(__dirname, '..', '..', '.stylelintrc.json')
            });

            if (stylelintResult.results[0].warnings.length > 0) {
                stylelintResult.results[0].warnings.forEach(warning => {
                    fileErrors.push({
                        filePath: fullPath,
                        line: warning.line,
                        message: warning.text,
                        context: content.split('\n')[warning.line - 1]
                    });
                });
            }

            // Проверка вендорных префиксов
            try {
                const result = await postcss([autoprefixer]).process(content, {
                    from: undefined
                });

                if (result.warnings().length > 0) {
                    result.warnings().forEach(warning => {
                        fileErrors.push({
                            filePath: fullPath,
                            line: warning.line || 1,
                            message: `Autoprefixer: ${warning.text}`
                        });
                    });
                }
            } catch (error) {
                fileErrors.push({
                    filePath: fullPath,
                    line: 1,
                    message: `Error processing vendor prefixes: ${error.message}`
                });
            }

            // Проверка единиц измерения
            const lines = content.split('\n');
            let currentUnitType = null;

            lines.forEach((line, index) => {
                const lineNumber = index + 1;

                const colorMatches = line.match(/:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g);
                if (colorMatches) {
                    colorMatches.forEach(match => {
                        const color = match.replace(/^:\s*/, '').toLowerCase();
                        if (!line.includes('var(') && !line.includes('$')) {
                            if (!colorUsage.has(color)) {
                                colorUsage.set(color, [{
                                    filePath: fullPath,
                                    line: lineNumber,
                                    context: line.trim()
                                }]);
                            } else {
                                colorUsage.get(color).push({
                                    filePath: fullPath,
                                    line: lineNumber,
                                    context: line.trim()
                                });
                            }
                        }
                    });
                }

                const fontSizeMatch = line.match(/font-size:\s*([0-9.]+)(px|em|rem)/);
                const marginMatch = line.match(/margin[^:]*:\s*[^;]*[0-9.]+([a-z]+)/);
                const paddingMatch = line.match(/padding[^:]*:\s*[^;]*[0-9.]+([a-z]+)/);

                if (fontSizeMatch) {
                    const unit = fontSizeMatch[2];
                    if (currentUnitType === null) {
                        currentUnitType = unit;
                    } else if (unit !== currentUnitType) {
                        fileErrors.push({
                            filePath: fullPath,
                            line: lineNumber,
                            message: `Inconsistent units: mixing ${currentUnitType} and ${unit}`,
                            context: line.trim()
                        });
                    }
                }

                if (marginMatch && marginMatch[1] !== currentUnitType && currentUnitType !== null) {
                    fileErrors.push({
                        filePath: fullPath,
                        line: lineNumber,
                        message: `Inconsistent units: margin uses ${marginMatch[1]} while font-size uses ${currentUnitType}`,
                        context: line.trim()
                    });
                }

                if (paddingMatch && paddingMatch[1] !== currentUnitType && currentUnitType !== null) {
                    fileErrors.push({
                        filePath: fullPath,
                        line: lineNumber,
                        message: `Inconsistent units: padding uses ${paddingMatch[1]} while font-size uses ${currentUnitType}`,
                        context: line.trim()
                    });
                }
            });

            // Новые проверки
            checkInteractiveElements(content, fullPath, fileErrors);
            checkBackgroundProperties(content, fullPath, fileErrors);
            checkCommentedCode(content, fullPath, fileErrors);
        }

        // Проверка дублирования цветов
        for (const [color, usages] of colorUsage) {
            if (usages.length > 1) {
                const firstUsage = usages[0];
                const fileErrors = fileErrorsMap.get(firstUsage.filePath);
                fileErrors.push({
                    filePath: firstUsage.filePath,
                    line: firstUsage.line,
                    message: `Color "${color}" is used multiple times. Consider using a variable.`,
                    context: `First usage: ${firstUsage.context}\nOther usages:\n${usages
                        .slice(1)
                        .map(usage => `  • Line ${usage.line}: ${usage.context}`)
                        .join('\n')}`
                });
            }
        }

        // Логируем все ошибки
        for (const [filePath, fileErrors] of fileErrorsMap) {
            if (fileErrors.length > 0) {
                logValidationErrors(filePath, 'Styles', fileErrors);
                allErrors.push(...fileErrors);
            }
        }

        return allErrors;
    } catch (error) {
        console.error('Error during styles validation:', error);
        return [{
            filePath: resolveWorkingPath(STYLES_DIR),
            line: 1,
            message: `Error during styles validation: ${error.message}`
        }];
    }
}

module.exports = validateStyles; 