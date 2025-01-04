const fs = require('fs').promises;
const path = require('path');
const prettier = require('prettier');
const stylelint = require('stylelint');
const { 
    resolveWorkingPath,
    resolveStylesPath,
    ensureDirectoryExists 
} = require('../paths');

// Files to ignore during optimization
const IGNORED_FILES = ['normalize.css'];

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
    try {
        console.log('🔍 Checking styles against criteria...');
        
        // Ensure styles directory exists
        const stylesDir = resolveStylesPath();
        await ensureDirectoryExists(stylesDir);
        
        // Get all style files except ignored ones
        const files = await fs.readdir(stylesDir);
        const styleFiles = files
            .filter(file => !IGNORED_FILES.includes(file))
            .filter(file => file.endsWith('.scss') || file.endsWith('.css'));
        
        if (styleFiles.length === 0) {
            console.log('⚠️ No style files found to optimize');
            return;
        }
        
        for (const file of styleFiles) {
            try {
                console.log(`\nProcessing ${file}...`);
                const filePath = path.join(stylesDir, file);
                let content = await fs.readFile(filePath, 'utf8');
                
                // Format with prettier
                content = await prettier.format(content, {
                    parser: file.endsWith('.scss') ? 'scss' : 'css',
                    printWidth: 80,
                    tabWidth: 4,
                    useTabs: false,
                    singleQuote: true,
                    trailingComma: 'none',
                    bracketSpacing: true,
                    semi: true,
                    singleLinePerSelector: true,
                    singleLinePerProperty: true,
                    hexLowercase: true,
                    hexShorthand: true
                });
                
                // Replace named colors with HEX
                content = await replaceNamedColors(content);
                
                // Save formatted content
                await fs.writeFile(filePath, content);
                console.log(`✅ Formatted ${file}`);
                
                // Run stylelint
                const lintResult = await stylelint.lint({
                    files: filePath,
                    fix: false,
                    formatter: 'string'
                });
                
                if (lintResult.errored) {
                    console.log('\n⚠️  Style issues that need manual fixes:');
                    console.log(lintResult.output);
                    console.log('\nPlease fix these issues manually according to the criteria.');
                } else {
                    console.log('✅ Styles meet all criteria!');
                }
            } catch (error) {
                console.error(`❌ Error processing ${file}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error optimizing styles:', error.message);
    }
}

if (require.main === module) {
    optimizeStyles().catch(console.error);
}

module.exports = { optimizeStyles }; 