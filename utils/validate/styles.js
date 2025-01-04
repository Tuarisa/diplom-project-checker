const fs = require('fs').promises;
const path = require('path');
const stylelint = require('stylelint');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const { WORKING_DIR, STYLES_DIR, resolveWorkingPath, resolveStylesPath } = require('../paths');

async function validateStyles() {
    try {
        const files = await fs.readdir(resolveStylesPath());
        const styleFiles = files.filter(file => 
            (file.endsWith('.css') || file.endsWith('.scss')) && 
            !file.includes('normalize')
        );
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

        // Объект для хранения информации о цветах
        const colorUsage = new Map();

        for (const file of styleFiles) {
            const filePath = resolveStylesPath(file);
            const content = await fs.readFile(filePath, 'utf8');

            // Stylelint validation using local config
            const stylelintResult = await stylelint.lint({
                code: content,
                fix: false,
                configFile: path.join(__dirname, '..', '..', '.stylelintrc.json')
            });

            if (stylelintResult.results[0].warnings.length > 0) {
                stylelintResult.results[0].warnings.forEach(warning => {
                    addError(
                        path.join(STYLES_DIR, file),
                        warning.text,
                        warning.line,
                        content.split('\n')[warning.line - 1]
                    );
                });
            }

            // Check for vendor prefixes
            try {
                const result = await postcss([autoprefixer]).process(content, {
                    from: undefined
                });

                if (result.warnings().length > 0) {
                    result.warnings().forEach(warning => {
                        addError(
                            path.join(STYLES_DIR, file),
                            `Autoprefixer: ${warning.text}`,
                            warning.line || 1
                        );
                    });
                }
            } catch (error) {
                addError(
                    path.join(STYLES_DIR, file),
                    `Error processing vendor prefixes: ${error.message}`,
                    1
                );
            }

            // Check for consistent units
            const lines = content.split('\n');
            let currentUnitType = null;

            lines.forEach((line, index) => {
                const lineNumber = index + 1;

                // Проверка на дублирование цветов
                const colorMatches = line.match(/:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g);
                if (colorMatches) {
                    colorMatches.forEach(match => {
                        const color = match.replace(/^:\s*/, '').toLowerCase();
                        // Игнорируем строки с переменными
                        if (!line.includes('var(') && !line.includes('$')) {
                            if (!colorUsage.has(color)) {
                                colorUsage.set(color, [{
                                    file: path.join(STYLES_DIR, file),
                                    line: lineNumber,
                                    context: line.trim()
                                }]);
                            } else {
                                colorUsage.get(color).push({
                                    file: path.join(STYLES_DIR, file),
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
                        addError(
                            path.join(STYLES_DIR, file),
                            `Inconsistent units: mixing ${currentUnitType} and ${unit}`,
                            lineNumber,
                            line.trim()
                        );
                    }
                }

                if (marginMatch && marginMatch[1] !== currentUnitType) {
                    addError(
                        path.join(STYLES_DIR, file),
                        `Inconsistent units: margin uses ${marginMatch[1]} while font-size uses ${currentUnitType}`,
                        lineNumber,
                        line.trim()
                    );
                }

                if (paddingMatch && paddingMatch[1] !== currentUnitType) {
                    addError(
                        path.join(STYLES_DIR, file),
                        `Inconsistent units: padding uses ${paddingMatch[1]} while font-size uses ${currentUnitType}`,
                        lineNumber,
                        line.trim()
                    );
                }
            });
        }

        // Проверяем дублирующиеся цвета
        for (const [color, usages] of colorUsage) {
            if (usages.length > 1) {
                const firstUsage = usages[0];
                addError(
                    firstUsage.file,
                    `Color "${color}" is used multiple times. Consider using a variable.`,
                    firstUsage.line,
                    `First usage: ${firstUsage.context}\nOther usages:\n${usages
                        .slice(1)
                        .map(usage => `  • ${path.basename(usage.file)}:${usage.line}: ${usage.context}`)
                        .join('\n')}`
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
        console.error('Error during styles validation:', error);
        return [`Error during styles validation: ${error.message}`];
    }
}

module.exports = validateStyles; 