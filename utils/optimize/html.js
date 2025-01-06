const fs = require('fs').promises;
const path = require('path');
const prettier = require('prettier');
const { JSDOM } = require('jsdom');
const {
    WORKING_DIR,
    SPRITE_PATH,
    resolveWorkingPath,
    getRelativePath
} = require('../paths');

// List of void (self-closing) HTML elements
const VOID_ELEMENTS = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
];

// Атрибуты, которые не нужно копировать из img в svg
const EXCLUDED_ATTRIBUTES = ['src', 'alt'];

async function optimizeHtml(content) {
    console.log('Processing HTML content...');
    
    // Preserve line break entities at the very beginning
    content = content.replace(/&#10;/g, '__LINE_BREAK__');
    
    const dom = new JSDOM(content);
    const document = dom.window.document;

    // Оптимизация путей для GitHub Pages
    // Заменяем /assets/ на assets/ для SVG спрайтов
    const svgElements = document.querySelectorAll('use[href^="/assets/"]');
    for (const svg of svgElements) {
        const href = svg.getAttribute('href');
        svg.setAttribute('href', href.replace(/^\/assets\//, 'assets/'));
    }

    // Обработка изображений в формате jpg, png
    const imgElements = document.querySelectorAll('img[src]');
    let imagesOptimized = 0;

    for (const img of imgElements) {
        const src = img.getAttribute('src');
        
        // Проверяем, является ли изображение jpg или png из папки images/content
        if (src.match(/^(?:\/)?images\/content\/.*\.(jpg|jpeg|png)$/i)) {
            // Создаем новый путь для WebP
            const newPath = src
                .replace(/^\//, '') // Убираем начальный слеш если есть
                .replace(/^images\/content\//, 'assets/images/content/')
                .replace(/\.(jpg|jpeg|png)$/i, '.webp');
            
            img.setAttribute('src', newPath);
            imagesOptimized++;
        }
    }

    if (imagesOptimized > 0) {
        console.log(`✓ Updated ${imagesOptimized} image paths to WebP format`);
    }

    // Оптимизация SVG - замена на спрайты
    const svgImgElements = document.querySelectorAll('img[src$=".svg"]');
    let svgOptimized = 0;

    for (const svg of svgImgElements) {
        const src = svg.getAttribute('src');
        const alt = svg.getAttribute('alt');
        
        // Получаем имя иконки из пути к файлу
        const iconName = path.basename(src, '.svg');
        
        // Создаем новый элемент svg с использованием спрайта
        const newSvg = document.createElement('svg');
        const useElement = document.createElement('use');
        // Используем относительный путь для GitHub Pages
        useElement.setAttribute('href', 'assets/images/icons/sprite.svg#icon-' + iconName);
        newSvg.appendChild(useElement);
        
        // Копируем атрибуты из оригинального изображения, исключая ненужные
        const attrs = svg.attributes;
        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (!EXCLUDED_ATTRIBUTES.includes(attr.name)) {
                newSvg.setAttribute(attr.name, attr.value);
            }
        }
        
        // Добавляем стандартные атрибуты для SVG
        if (!newSvg.hasAttribute('width')) {
            newSvg.setAttribute('width', '24');
        }
        if (!newSvg.hasAttribute('height')) {
            newSvg.setAttribute('height', '24');
        }

        // Если был alt, добавляем aria-label для доступности
        if (alt) {
            newSvg.setAttribute('aria-label', alt);
            newSvg.setAttribute('role', 'img');
        } else {
            newSvg.setAttribute('aria-hidden', 'true');
        }
        
        // Заменяем оригинальный элемент на новый
        svg.parentNode.replaceChild(newSvg, svg);
        svgOptimized++;
    }

    if (svgOptimized > 0) {
        console.log(`✓ Replaced ${svgOptimized} SVG images with sprite references`);
    }
    
    // Get optimized content after SVG replacement
    content = dom.serialize();

    // Clean up empty attributes and HTML entities
    content = content
        // Убираем пустые кавычки в атрибутах
        .replace(/=""/g, '')
        // Убираем amp; из HTML сущностей
        .replace(/&amp;/g, '&');
    
    // Format with prettier using .prettierrc config
    console.log('Formatting with prettier...');
    const prettierConfig = await prettier.resolveConfig(WORKING_DIR);
    let optimizedContent = await prettier.format(content, {
        ...prettierConfig,
        parser: 'html',
        printWidth: 120,
        htmlWhitespaceSensitivity: 'css',
        bracketSameLine: true,
        singleAttributePerLine: false
    });

    // Restore line break entities after all formatting
    optimizedContent = optimizedContent.replace(/__LINE_BREAK__/g, '&#10;');

    // Форматируем ссылки в head в одну строку
    const headPattern = /(<head[^>]*>)([\s\S]*?)(<\/head>)/i;
    optimizedContent = optimizedContent.replace(headPattern, (match, startTag, content, endTag) => {
        // Обрабатываем только link и meta теги
        content = content.replace(/<(link|meta)[^>]+>/g, (tag) => {
            // Убираем переносы строк и лишние пробелы
            return tag.replace(/\s+/g, ' ').trim();
        });
        // Разделяем теги одним переносом строки
        content = content.split(/\s*\n\s*/).filter(Boolean).join('\n    ');
        return `${startTag}\n    ${content}\n${endTag}`;
    });
    
    // Replace style paths with minified versions from assets
    const stylePattern = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    const styleMatches = [];
    let styleMatch;
    
    while ((styleMatch = stylePattern.exec(optimizedContent)) !== null) {
        styleMatches.push({
            full: styleMatch[0],
            path: styleMatch[1]
        });
    }
    
    if (styleMatches.length > 0) {
        optimizedContent = optimizedContent.replace(stylePattern, (match, path) => {
            // Заменяем пути к стилям
            if (path === 'normalize.css') {
                return match.replace(path, 'assets/styles/normalize.min.css');
            } else if (path.startsWith('styles/')) {
                // Для остальных стилей заменяем styles/ на assets/styles/ и добавляем .min
                const newPath = path.replace('styles/', 'assets/styles/').replace('.css', '.min.css');
                return match.replace(path, newPath);
            }
            return match;
        });
    }
    
    // Replace href="#" with javascript:void(0)
    const hrefPattern = /<a[^>]*\shref=["']#["'][^>]*>/gi;
    optimizedContent = optimizedContent.replace(hrefPattern, (match) => {
        return match.replace(/href=["']#["']/, 'href="javascript:void(0)"');
    });
    
    // Add target="_blank" for external links
    const externalLinkPattern = /<a[^>]*\shref=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
    optimizedContent = optimizedContent.replace(externalLinkPattern, (match) => {
        if (!match.includes('target="_blank"')) {
            match = match.replace(/>$/, ' target="_blank">');
        }
        return match;
    });

    // Remove self-closing slashes after all other operations
    for (const tag of VOID_ELEMENTS) {
        const tagPattern = new RegExp(`<${tag}([^>]*?)\\s*?\\/>`, 'gi');
        optimizedContent = optimizedContent.replace(tagPattern, (match, attrs) => {
            return `<${tag}${attrs}>`;
        });
    }

    // Final cleanup of empty attributes and HTML entities
    optimizedContent = optimizedContent
        .replace(/=""/g, '')
        .replace(/&amp;/g, '&');
    
    // Replace javascript:void(0) with href="#"
    const voidPattern = /<a[^>]*\shref=["']javascript:void\(0\)["'][^>]*>/gi;
    optimizedContent = optimizedContent.replace(voidPattern, (match) => {
        return match.replace(/href=["']javascript:void\(0\)["']/, 'href="#"');
    });
    
    return optimizedContent;
}

async function processHtmlFiles() {
    try {
        console.log('🔄 Optimizing HTML files...');
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));

        if (htmlFiles.length === 0) {
            console.log('⚠️ No HTML files found to optimize');
            return;
        }

        for (const file of htmlFiles) {
            try {
                console.log(`\n📄 Processing ${file}...`);
                const filePath = resolveWorkingPath(file);
                const content = await fs.readFile(filePath, 'utf8');
                const optimizedContent = await optimizeHtml(content);
                await fs.writeFile(filePath, optimizedContent);
                console.log(`✅ Optimized ${file}`);
            } catch (error) {
                console.error(`❌ Failed to optimize ${file}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ HTML optimization failed:', error);
        throw error;
    }
}

if (require.main === module) {
    processHtmlFiles().catch(console.error);
}

module.exports = { processHtmlFiles }; 