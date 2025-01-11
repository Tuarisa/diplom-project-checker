const Typograf = require('typograf');
const fs = require('fs').promises;
const { WORKING_DIR, resolveWorkingPath } = require('../paths');

// Create Typograf instance with English as primary language
const tp = new Typograf({ 
    locale: ['en-US'],
    htmlEntity: { type: 'digit' },
    safeTags: [
        ['<!DOCTYPE>', '</!DOCTYPE>'],
        ['<\\?xml', '\\?>'],
        ['<meta>', '</meta>'],
        ['<link>', '</link>'],
        ['<script>', '</script>'],
        ['<style>', '</style>'],
        ['<pre>', '</pre>'],
        ['<code>', '</code>'],
        ['<template>', '</template>'],
        ['<no-typography>', '</no-typography>'],
        ['="', '"'],
        ['=\'', '\''],
        ['class="', '"'],
        ['id="', '"'],
        ['href="', '"'],
        ['src="', '"'],
        ['alt="', '"'],
        ['title="', '"']
    ]
});

// Enable English typography rules
tp.enableRule('common/space/afterPunctuation');
tp.enableRule('common/space/beforeBracket');
tp.enableRule('common/space/afterBracket');
tp.enableRule('common/punctuation/quote');
tp.enableRule('common/space/delTrailingBlanks');
tp.enableRule('common/space/trimLeft');
tp.enableRule('common/space/trimRight');
tp.enableRule('common/number/fraction');
tp.enableRule('common/number/mathSigns');
tp.enableRule('common/number/times');
tp.enableRule('common/other/repeatWord');
tp.enableRule('en-US/dash/main');
tp.enableRule('en-US/punctuation/quote');
tp.enableRule('en-US/punctuation/apostrophe');
tp.enableRule('en-US/typo/quotation');

// Disable HTML-specific rules that might cause issues
tp.disableRule('common/html/stripTags');
tp.disableRule('common/html/escape');
tp.disableRule('common/html/url');

async function processTypography(content) {
    console.log('Processing typography...');
    
    // Process the entire HTML content
    let processedContent = tp.execute(content);
    
    // Fix any double-encoded entities
    processedContent = processedContent
        .replace(/&amp;nbsp;/g, '&nbsp;')
        .replace(/&amp;mdash;/g, '&mdash;')
        .replace(/&amp;ndash;/g, '&ndash;')
        .replace(/&amp;laquo;/g, '&laquo;')
        .replace(/&amp;raquo;/g, '&raquo;')
        .replace(/&amp;copy;/g, '&copy;')
        .replace(/&amp;reg;/g, '&reg;')
        .replace(/&amp;trade;/g, '&trade;')
        .replace(/&amp;hellip;/g, '&hellip;')
        .replace(/&amp;bull;/g, '&bull;')
        .replace(/&amp;#x2F;/g, '&#x2F;')
        .replace(/&amp;rsquo;/g, '&rsquo;')
        .replace(/&amp;ldquo;/g, '&ldquo;')
        .replace(/&amp;rdquo;/g, '&rdquo;');
    
    return processedContent;
}

async function processHtmlFiles() {
    try {
        console.log('🔄 Applying typography rules to HTML files...');
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files.filter(file => file.endsWith('.html'));

        if (htmlFiles.length === 0) {
            console.log('⚠️ No HTML files found to process');
            return;
        }

        for (const file of htmlFiles) {
            try {
                console.log(`\n📄 Processing ${file}...`);
                const filePath = resolveWorkingPath(file);
                const content = await fs.readFile(filePath, 'utf8');
                const processedContent = await processTypography(content);
                await fs.writeFile(filePath, processedContent);
                console.log(`✅ Typography applied to ${file}`);
            } catch (error) {
                console.error(`❌ Failed to process typography in ${file}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Typography processing failed:', error);
        throw error;
    }
}

if (require.main === module) {
    processHtmlFiles().catch(console.error);
}

module.exports = { processHtmlFiles }; 