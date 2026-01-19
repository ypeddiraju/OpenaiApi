import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enhanceImage, getImageInfo } from './utils/imageEnhancer.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process all images from the images folder and save to pro_images folder
 */
async function processImagesFolder() {
    const inputDir = path.join(__dirname, 'images');
    const outputDir = path.join(__dirname, 'pro_images');

    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`Output directory created/verified: ${outputDir}`);

        // Read all files from images folder
        const files = await fs.readdir(inputDir);
        console.log(`Found ${files.length} files in images folder`);

        // Filter for image files
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
        });

        console.log(`Processing ${imageFiles.length} image files...`);

        if (imageFiles.length === 0) {
            console.log('No image files found in the images folder.');
            return;
        }

        // Process each image
        const results = [];
        for (let i = 0; i < imageFiles.length; i++) {
            const filename = imageFiles[i];
            const inputPath = path.join(inputDir, filename);
            const outputFilename = `enhanced-${filename}`;
            const outputPath = path.join(outputDir, outputFilename);

            try {
                console.log(`\n[${i + 1}/${imageFiles.length}] Processing: ${filename}`);
                
                // Get image info
                const info = await getImageInfo(inputPath);
                console.log(`  - Dimensions: ${info.width}x${info.height}`);
                console.log(`  - Format: ${info.format}`);

                // Enhance the image
                await enhanceImage(inputPath, {
                    grayscale: true,
                    normalize: true,
                    sharpen: true,
                    brightness: 1.2,
                    threshold: 128,
                    denoise: 3,
                    outputPath: outputPath
                });

                results.push({
                    input: filename,
                    output: outputFilename,
                    status: 'success'
                });

                console.log(`  ✓ Saved to: ${outputFilename}`);
            } catch (error) {
                console.error(`  ✗ Error processing ${filename}:`, error.message);
                results.push({
                    input: filename,
                    output: null,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        // Summary
        console.log('\n========== PROCESSING SUMMARY ==========');
        const successful = results.filter(r => r.status === 'success').length;
        const failed = results.filter(r => r.status === 'failed').length;
        console.log(`Total images: ${results.length}`);
        console.log(`Successful: ${successful}`);
        console.log(`Failed: ${failed}`);
        console.log(`Output directory: ${outputDir}`);
        console.log('========================================\n');

        return results;

    } catch (error) {
        console.error('Error processing images folder:', error);
        throw error;
    }
}

// Run if executed directly
processImagesFolder()
    .then(() => {
        console.log('Image processing completed!');
    })
    .catch(error => {
        console.error('Failed to process images:', error);
        process.exit(1);
    });

export { processImagesFolder };
