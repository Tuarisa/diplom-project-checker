const fs = require('fs').promises;
const path = require('path');
const prettier = require('prettier');
const stylelint = require('stylelint');

// Словарь именованных цветов и их HEX-эквивалентов
const COLOR_NAMES = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    purple: '#800080',
    gray: '#808080',
    silver: '#c0c0c0',
    maroon: '#800000',
    olive: '#808000',
    lime: '#00ff00',
    aqua: '#00ffff',
    teal: '#008080',
    navy: '#000080',
    fuchsia: '#ff00ff'
};

async function replaceNamedColors(content) {
    let updatedContent = content;
    let replacements = [];

    // Ищем использование именованных цветов
    const colorPattern = new RegExp(`:\\s*(${Object.keys(COLOR_NAMES).join('|')})\\b`, 'gi');
    let match;

    while ((match = colorPattern.exec(content)) !== null) {
        const namedColor = match[1].toLowerCase();
        const hexColor = COLOR_NAMES[namedColor];
        const position = match.index + match[0].indexOf(namedColor);
        
        replacements.push({
            original: namedColor,
            replacement: hexColor,
            position: position
        });
    }

    // Сортируем замены от конца к началу, чтобы не сбить позиции
    replacements.sort((a, b) => b.position - a.position);

    // Применяем замены
    for (const replacement of replacements) {
        const before = updatedContent.slice(0, replacement.position);
        const after = updatedContent.slice(replacement.position + replacement.original.length);
        updatedContent = before + replacement.replacement + after;
    }

    return updatedContent;
}

async function optimizeStyles() {
    console.log('🔍 Checking SCSS against criteria...');
    
    const stylesDir = path.join(__dirname, '..', '..', 'styles');
    const scssFiles = await fs.readdir(stylesDir);
    
    for (const file of scssFiles) {
        if (!file.endsWith('.scss')) continue;
        
        const filePath = path.join(stylesDir, file);
        let content = await fs.readFile(filePath, 'utf8');
        
        // Форматируем SCSS с помощью prettier
        console.log(`\nProcessing ${file}...`);
        content = await prettier.format(content, {
            parser: 'scss',
            printWidth: 80,
            tabWidth: 4,
            useTabs: false,
            singleQuote: true,
            trailingComma: 'none',
            bracketSpacing: true,
            semi: true,
            // Специфичные настройки для SCSS
            singleLinePerSelector: true, // Каждый селектор на новой строке
            singleLinePerProperty: true, // Каждое свойство на новой строке
            hexLowercase: true, // HEX цвета в нижнем регистре
            hexShorthand: true // Сокращенные HEX цвета где возможно (#ffffff -> #fff)
        });
        
        // Заменяем именованные цвета на HEX
        content = await replaceNamedColors(content);
        await fs.writeFile(filePath, content);
        console.log(`✅ Formatted ${file}`);
        
        // Проверяем оставшиеся проблемы через stylelint
        const lintResult = await stylelint.lint({
            files: filePath,
            fix: false, // Отключаем автоисправление, так как форматирование делает prettier
            formatter: 'string'
        });
        
        if (lintResult.errored) {
            console.log('\n⚠️  Remaining SCSS issues that need manual fixes:');
            console.log(lintResult.output);
            console.log('\nPlease fix these issues manually according to the criteria.');
        } else {
            console.log('✅ SCSS meets all criteria!');
        }
    }
}

if (require.main === module) {
    optimizeStyles().catch(console.error);
}

module.exports = { optimizeStyles }; 