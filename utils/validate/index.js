const validateHTML = require('./html');
const validateBEM = require('./bem');
const validateStyles = require('./styles');
const validateImages = require('./images');
const validateStructure = require('./structure');

async function runValidation() {
    console.log('\n🔍 Starting validation...\n');

    try {
        // Run all validators
        const [htmlErrors, bemErrors, stylesErrors, imagesErrors, structureErrors] = await Promise.all([
            validateHTML(),
            validateBEM(),
            validateStyles(),
            validateImages(),
            validateStructure()
        ]);

        // Combine all errors
        const allErrors = [
            ...htmlErrors,
            ...bemErrors,
            ...stylesErrors,
            ...imagesErrors,
            ...structureErrors
        ];

        if (allErrors.length > 0) {
            console.log('❌ Validation failed with the following errors:\n');
            console.log(allErrors.join('\n'));
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