const validateHTML = require('./html');
const validateW3C = require('./w3c');
const validateBEM = require('./bem');
const validateStyles = require('./styles');
const validateImages = require('./images');
const validateStructure = require('./structure');
const validateSemanticStyles = require('./semantic-styles');

async function runValidation() {
    console.log('\n🔍 Starting validation...\n');

    try {
        // Run all validators
        const [
            htmlErrors, 
            w3cErrors, 
            bemErrors, 
            stylesErrors, 
            imagesErrors, 
            structureErrors,
            semanticStylesErrors
        ] = await Promise.all([
            validateHTML(),
            validateW3C(),
            validateBEM(),
            validateStyles(),
            validateImages(),
            validateStructure(),
            validateSemanticStyles()
        ]);

        const hasErrors = htmlErrors.length > 0 || 
                         w3cErrors.length > 0 || 
                         bemErrors.length > 0 || 
                         stylesErrors.length > 0 || 
                         imagesErrors.length > 0 || 
                         structureErrors.length > 0 ||
                         semanticStylesErrors.length > 0;

        if (hasErrors) {
            // Add summary report
            console.log('\n📊 Validation Summary:');
            console.log('─'.repeat(50));
            
            const errorsByType = {
                'HTML Errors': htmlErrors.length,
                'W3C Errors': w3cErrors.length,
                'BEM Naming Errors': bemErrors.length,
                'Style Errors': stylesErrors.length,
                'Image Errors': imagesErrors.length,
                'Structure Errors': structureErrors.length,
                'Semantic Style Errors': semanticStylesErrors.length
            };

            for (const [type, count] of Object.entries(errorsByType)) {
                if (count > 0) {
                    console.log(`• ${type}: ${count}`);
                }
            }

            console.log('─'.repeat(50));
            console.log(`Total Errors: ${
                htmlErrors.length + 
                w3cErrors.length + 
                bemErrors.length + 
                stylesErrors.length + 
                imagesErrors.length + 
                structureErrors.length +
                semanticStylesErrors.length
            }`);
            
            process.exit(1);
        } else {
            console.log('✅ All validations passed successfully!');
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Validation failed with error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runValidation();
}

module.exports = runValidation; 