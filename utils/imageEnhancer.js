import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Basic preprocessing for invoice images
 * Applies grayscale, normalization, sharpening, and thresholding
 * @param {string} imagePath - Path to the input image
 * @param {string} outputPath - Optional path for output image (defaults to 'processed-invoice.png')
 * @returns {Promise<string>} Path to the processed image
 */
async function preprocessInvoice(imagePath, outputPath = 'processed-invoice.png') {
    try {
        await sharp(imagePath)
            // Convert to grayscale
            .grayscale()
            // Increase contrast
            .normalize()
            // Sharpen
            .sharpen({
                sigma: 1.5,
                m1: 0.5,
                m2: 0.5,
                x1: 2,
                y1: 10
            })
            // Enhance clarity
            .linear(1.2, 0) // Increase brightness/contrast
            // Convert to binary (threshold)
            .threshold(128, { grayscale: false })
            // Output
            .toFile(outputPath);
        
        console.log(`Image processed successfully: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

/**
 * Advanced preprocessing with denoising
 * Applies more aggressive processing including median filtering for noise reduction
 * @param {string} imagePath - Path to the input image
 * @param {string} outputPath - Optional path for output image (defaults to 'output.png')
 * @returns {Promise<Buffer>} Buffer containing the processed image data
 */
async function advancedPreprocess(imagePath, outputPath = 'output.png') {
    try {
        const buffer = await sharp(imagePath)
            .grayscale()
            .normalize() // Auto-adjust contrast
            .sharpen({
                sigma: 2,
                m1: 1,
                m2: 0.2,
                x1: 3,
                y1: 10
            })
            .median(3) // Denoise (similar to fastNlMeansDenoising)
            .toBuffer();
        
        // Apply custom threshold
        await sharp(buffer)
            .threshold(120)
            .toFile(outputPath);
        
        console.log(`Advanced preprocessing completed: ${outputPath}`);
        return buffer;
    } catch (error) {
        console.error('Error in advanced preprocessing:', error);
        throw error;
    }
}

/**
 * Enhanced image processing with configurable options
 * @param {string} imagePath - Path to the input image
 * @param {Object} options - Processing options
 * @param {boolean} options.grayscale - Apply grayscale conversion (default: true)
 * @param {boolean} options.normalize - Apply normalization (default: true)
 * @param {boolean} options.sharpen - Apply sharpening (default: true)
 * @param {number} options.brightness - Brightness adjustment factor (default: 1.2)
 * @param {number} options.threshold - Threshold value 0-255 (default: 128)
 * @param {number} options.denoise - Median filter size for denoising (default: 0, disabled)
 * @param {string} options.outputPath - Output file path
 * @returns {Promise<string>} Path to the processed image
 */
async function enhanceImage(imagePath, options = {}) {
    const {
        grayscale = true,
        normalize = true,
        sharpen = true,
        brightness = 1.2,
        threshold = 128,
        denoise = 0,
        outputPath = `enhanced-${path.basename(imagePath)}`
    } = options;

    try {
        let pipeline = sharp(imagePath);

        // Apply grayscale
        if (grayscale) {
            pipeline = pipeline.grayscale();
        }

        // Apply normalization
        if (normalize) {
            pipeline = pipeline.normalize();
        }

        // Apply sharpening
        if (sharpen) {
            pipeline = pipeline.sharpen({
                sigma: 1.5,
                m1: 0.5,
                m2: 0.5,
                x1: 2,
                y1: 10
            });
        }

        // Apply denoising if specified
        if (denoise > 0) {
            pipeline = pipeline.median(denoise);
        }

        // Apply brightness adjustment
        if (brightness !== 1.0) {
            pipeline = pipeline.linear(brightness, 0);
        }

        // Apply threshold
        if (threshold > 0) {
            pipeline = pipeline.threshold(threshold, { grayscale: false });
        }

        // Save to file
        await pipeline.toFile(outputPath);

        console.log(`Image enhanced successfully: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error('Error enhancing image:', error);
        throw error;
    }
}

/**
 * Batch process multiple images
 * @param {string[]} imagePaths - Array of image paths to process
 * @param {Object} options - Processing options (same as enhanceImage)
 * @param {string} options.outputDir - Directory for output images (default: current directory)
 * @returns {Promise<string[]>} Array of output file paths
 */
async function batchEnhanceImages(imagePaths, options = {}) {
    const { outputDir = '.', ...processingOptions } = options;

    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });

        const results = [];
        for (const imagePath of imagePaths) {
            const filename = path.basename(imagePath);
            const outputPath = path.join(outputDir, `enhanced-${filename}`);
            
            const result = await enhanceImage(imagePath, {
                ...processingOptions,
                outputPath
            });
            
            results.push(result);
        }

        console.log(`Batch processing completed: ${results.length} images processed`);
        return results;
    } catch (error) {
        console.error('Error in batch processing:', error);
        throw error;
    }
}

/**
 * Get image metadata and quality information
 * @param {string} imagePath - Path to the image
 * @returns {Promise<Object>} Image metadata
 */
async function getImageInfo(imagePath) {
    try {
        const metadata = await sharp(imagePath).metadata();
        return {
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            space: metadata.space,
            channels: metadata.channels,
            depth: metadata.depth,
            density: metadata.density,
            hasAlpha: metadata.hasAlpha,
            size: metadata.size
        };
    } catch (error) {
        console.error('Error getting image info:', error);
        throw error;
    }
}

export {
    preprocessInvoice,
    advancedPreprocess,
    enhanceImage,
    batchEnhanceImages,
    getImageInfo
};
