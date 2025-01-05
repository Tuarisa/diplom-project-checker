const fs = require('fs').promises;
const path = require('path');
const stylelint = require('stylelint');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const { WORKING_DIR, STYLES_DIR, resolveWorkingPath, resolveStylesPath } = require('../paths');
const { logValidationErrors } = require('../validation-logger');

async function validateStyles() {
    try {
        const files = await fs.readdir(resolveStylesPath());
        const styleFiles = files.filter(file => 
            (file.endsWith('.css') || file.endsWith('.scss')) && 
            !file.includes('normalize')
        );
        const allErrors = [];
        const fileErrorsMap = new Map();

        // Объект для хранения информации о цветах
        const colorUsage = new Map();

        for (const file of styleFiles) {
            const filePath = resolveStylesPath(file);
            const fullPath = resolveWorkingPath(path.join(STYLES_DIR, file));
            const content = await fs.readFile(filePath, 'utf8');
            
            if (!fileErrorsMap.has(fullPath)) {
                fileErrorsMap.set(fullPath, []);
            }
            const fileErrors = fileErrorsMap.get(fullPath);

            // Stylelint validation using local config
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

            // Check for vendor prefixes
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

                if (marginMatch && marginMatch[1] !== currentUnitType) {
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
        }

        // Проверяем дублирующиеся цвета
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

        // Логируем все ошибки для каждого файла
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