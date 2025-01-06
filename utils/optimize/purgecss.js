const fs = require('fs').promises;
const path = require('path');
const { PurgeCSS } = require('purgecss');
const { execSync } = require('child_process');
const { 
    WORKING_DIR,
    resolveWorkingPath,
    resolveAssetsPath,
    ensureDirectoryExists 
} = require('../paths');

async function purgeStyles() {
    try {
        console.log('🔍 Starting CSS purging process...');
        
        // Get all HTML files from working directory
        const files = await fs.readdir(WORKING_DIR);
        const htmlFiles = files
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(WORKING_DIR, file));

        if (htmlFiles.length === 0) {
            console.log('⚠️ No HTML files found for CSS purging');
            return;
        }

        // Ensure assets directory exists
        const assetsStylesDir = resolveAssetsPath('styles');
        await ensureDirectoryExists(assetsStylesDir);

        // Compile SCSS to CSS first
        console.log('📦 Compiling SCSS to CSS...');
        const scssFile = resolveWorkingPath('styles/style.scss');
        const cssFile = path.join(assetsStylesDir, 'style.css');
        
        try {
            await fs.access(scssFile);
        } catch (error) {
            console.log('⚠️ style.scss not found');
            return;
        }

        // Compile SCSS to CSS using sass command from package.json
        execSync(`sass ${scssFile} ${cssFile}`, { stdio: 'inherit' });
        console.log('✅ SCSS compiled successfully');

        console.log('📦 Processing CSS with PurgeCSS...');

        // Run PurgeCSS on the compiled CSS
        const result = await new PurgeCSS().purge({
            content: htmlFiles,
            css: [cssFile],
            safelist: {
                standard: [
                    /^is-/, // Common state classes
                    /^has-/,
                    /^js-/, // JavaScript hooks
                    /^active$/,
                    /^show$/,
                    /^hide$/,
                    /^open$/,
                    /^close$/,
                    /^figure$/, // Basic HTML elements
                    /^img$/,
                    /^a$/,
                    /^p$/,
                    /^h[1-6]$/,
                    /^ul$/,
                    /^ol$/,
                    /^li$/,
                    /^table$/,
                    /^tr$/,
                    /^td$/,
                    /^th$/,
                    /^input$/,
                    /^textarea$/,
                    /^button$/,
                    /^form$/,
                    /^header$/,
                    /^footer$/,
                    /^nav$/,
                    /^main$/,
                    /^section$/,
                    /^article$/,
                    /^aside$/,
                    /^dialog$/,
                    /^summary$/,
                    /^details$/,
                    /^caption$/,
                    /^label$/,
                    /^legend$/,
                    /^fieldset$/,
                    /^form-control__input$/, // Form controls
                    /^form-control$/
                ],
                deep: [
                    /focus/,
                    /hover/, 
                    /active/, 
                    /disabled/,
                    /checked/,
                    /first-child/,
                    /last-child/,
                    /nth-child/,
                    /nth-of-type/,
                    /only-child/,
                    /only-of-type/,
                    /placeholder/,
                    /selection/,
                    /::-webkit-[a-zA-Z-]+/, // Vendor prefixes
                    /:-webkit-[a-zA-Z-]+/,
                    /:-moz-[a-zA-Z-]+/,
                    /::-moz-[a-zA-Z-]+/,
                    /:-ms-[a-zA-Z-]+/,
                    /:-o-[a-zA-Z-]+/,
                    /::?-[a-zA-Z-]+/ // Any vendor prefix
                ],
                greedy: [
                    /^nav-/,  // Navigation elements
                    /^btn-/,  // Button variations
                    /^icon-/, // Icon classes
                    /^modal-/, // Modal classes
                    /^form-control/, // Form controls (greedy match)
                    /^title$/, // Common single classes
                    /^text$/,
                    /^link$/,
                    /^button$/,
                    /^wrapper$/,
                    /^container$/,
                    /^header$/,
                    /^footer$/,
                    /^content$/,
                    /^sidebar$/,
                    /^main$/,
                    /^section$/,
                    /^block$/,
                    /^item$/,
                    /^card$/,
                    /^image$/,
                    /^logo$/,
                    /^menu$/,
                    /^list$/,
                    /^form$/,
                    /^input$/,
                    /^field$/,
                    /^label$/,
                    /^error$/,
                    /^success$/,
                    /^warning$/,
                    /^info$/,
                    /^hidden$/,
                    /^visible$/,
                    /^active$/,
                    /^disabled$/,
                    /^selected$/,
                    /^loading$/,
                    /^center$/,
                    /^left$/,
                    /^right$/
                ]
            },
            // Сохраняем одиночные селекторы
            defaultExtractor: content => {
                // Находим все классы
                const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
                const broadMatchesWithoutDigits = content.match(/[^<>"'`\s]*[^<>"'`\s:0-9]/g) || [];
                const singleClasses = content.match(/\.[a-zA-Z][a-zA-Z0-9-_]*(?![^\{]*\})/g) || [];
                
                return [...broadMatches, ...broadMatchesWithoutDigits, ...singleClasses];
            }
        });

        if (result.length > 0) {
            const purgedContent = result[0].css;
            
            // Save purged content back to the files
            await fs.writeFile(cssFile, purgedContent);
            
            // Create minified version using clean-css-cli
            execSync(`cleancss -o ${path.join(assetsStylesDir, 'style.min.css')} ${cssFile}`, { stdio: 'inherit' });

            console.log('✅ Created purged CSS files:');
            console.log('   - assets/styles/style.css');
            console.log('   - assets/styles/style.min.css');
        }

        console.log('✨ CSS purging completed successfully!');
    } catch (error) {
        console.error('❌ Error during CSS purging:', error.message);
        throw error;
    }
}

if (require.main === module) {
    purgeStyles().catch(console.error);
}

module.exports = { purgeStyles }; 