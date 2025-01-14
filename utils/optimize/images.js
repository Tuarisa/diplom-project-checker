const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const SVGSpriter = require('svg-sprite');
const { 
    resolveWorkingPath,
    resolveImagesPath,
    resolveAssetsPath,
    ensureDirectoryExists 
} = require('../paths');

async function optimizeImages() {
    try {
        console.log('🔄 Optimizing images...');
        const imagesDir = resolveImagesPath();
        const outputDir = path.join(resolveAssetsPath(), 'images', 'content');
        
        // Create necessary directories
        await ensureDirectoryExists(imagesDir);
        await ensureDirectoryExists(outputDir);

        // Recursive reading of all files in the images directory
        async function readDirRecursive(dir) {
            const files = await fs.readdir(dir, { withFileTypes: true });
            const paths = [];
            
            for (const file of files) {
                const fullPath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    paths.push(...(await readDirRecursive(fullPath)));
                } else if (file.isFile() && /\.(jpg|jpeg|png)$/i.test(file.name)) {
                    paths.push(fullPath);
                }
            }
            
            return paths;
        }

        const imageFiles = await readDirRecursive(imagesDir);

        if (imageFiles.length === 0) {
            console.log('⚠️ No images found to optimize');
            return;
        }

        for (const filePath of imageFiles) {
            try {
                const relativePath = path.relative(imagesDir, filePath);
                const fileInfo = path.parse(relativePath);
                
                // Convert all images to WebP
                const webpPath = path.join(outputDir, `${fileInfo.name}.webp`);
                await sharp(filePath)
                    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 70 })
                    .toFile(webpPath);

                console.log(`✅ Converted ${relativePath} to WebP`);
            } catch (error) {
                console.error(`❌ Failed to optimize ${filePath}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Image optimization failed:', error.message);
    }
}

async function createSvgSprite() {
    try {
        console.log('🔄 Creating SVG sprite...');
        const iconsDir = path.join(resolveImagesPath(), 'icons');
        const assetsDir = path.join(resolveAssetsPath(), 'images', 'icons');
        
        // Create output directory
        await ensureDirectoryExists(assetsDir);
        
        // Configure spriter
        const spriter = new SVGSpriter({
            dest: assetsDir,
            mode: {
                symbol: {
                    inline: true,
                    sprite: 'sprite.svg',
                    example: false
                }
            },
            shape: {
                transform: [{
                    svgo: {
                        plugins: [
                            {
                                name: 'preset-default',
                                params: {
                                    overrides: {
                                        removeViewBox: false,
                                        removeUselessStrokeAndFill: false,
                                        cleanupIDs: false
                                    }
                                }
                            }
                        ]
                    }
                }],
                id: {
                    generator: 'icon-%s'
                }
            },
            svg: {
                xmlDeclaration: false,
                doctypeDeclaration: false
            }
        });
        
        // Read SVG files
        const files = await fs.readdir(iconsDir);
        const svgFiles = files.filter(file => file.endsWith('.svg'));
        
        if (svgFiles.length === 0) {
            console.log('⚠️ No SVG files found to sprite');
            return;
        }
        
        // Add each SVG to the spriter
        for (const file of svgFiles) {
            const filePath = path.join(iconsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            console.log(`Processing icon: ${file}`);
            spriter.add(
                path.resolve(filePath),
                file,
                content
            );
        }
        
        // Compile the sprite
        const result = await new Promise((resolve, reject) => {
            spriter.compile((error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
        
        // Save the sprite
        await fs.writeFile(
            path.join(assetsDir, 'sprite.svg'),
            result.symbol.sprite.contents
        );
        
        console.log(`✅ Created sprite with ${svgFiles.length} icons`);
    } catch (error) {
        console.error('❌ SVG sprite creation failed:', error.message);
    }
}

async function optimizeAllImages() {
    await optimizeImages();
    await createSvgSprite();
}

if (require.main === module) {
    optimizeAllImages().catch(console.error);
}

module.exports = { optimizeAllImages }; 