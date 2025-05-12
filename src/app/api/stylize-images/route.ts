// src/app/api/stylize-images/route.ts
import { NextResponse } from 'next/server';
import { stylizeImage, STYLE_OPTIONS } from '@/lib/imageStylizer';
import Sharp from 'sharp';

// Constants for API limits
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB max for DALL-E
const MAX_BASE64_LENGTH = MAX_IMAGE_SIZE_BYTES * 1.37; // Base64 is ~1.37x larger than binary

/**
 * Server-side image compression using Sharp
 */
async function compressImage(base64Image: string): Promise<string> {
  try {
    console.log('Starting server-side image compression');

    // Extract the base64 data without prefix if needed
    let base64Data = base64Image;
    if (base64Image.includes('base64,')) {
      base64Data = base64Image.split('base64,')[1];
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Get image metadata
    const metadata = await Sharp(buffer).metadata();
    console.log(`Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

    // Calculate dimensions
    const maxDimension = 1024;
    let width = metadata.width || 1024;
    let height = metadata.height || 1024;

    let resizeNeeded = false;
    if (width > maxDimension || height > maxDimension) {
      resizeNeeded = true;
      if (width > height) {
        height = Math.round(height * (maxDimension / width));
        width = maxDimension;
      } else {
        width = Math.round(width * (maxDimension / height));
        height = maxDimension;
      }
    }

    // Create a processing pipeline
    let imageProcess = Sharp(buffer);

    // Resize if needed
    if (resizeNeeded) {
      console.log(`Resizing image to ${width}x${height}`);
      imageProcess = imageProcess.resize(width, height);
    }

    // Compress
    const compressedBuffer = await imageProcess
      .jpeg({ quality: 80 })
      .toBuffer();

    // Convert back to base64
    const compressedBase64 = compressedBuffer.toString('base64');

    console.log(`Compression complete: ${buffer.length} bytes → ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length / buffer.length) * 100)}% reduction)`);

    return compressedBase64;
  } catch (error) {
    console.error('Error during server-side compression:', error);
    // Return original if compression fails
    return base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
  }
}

/**
 * Convert base64 image to PNG buffer format needed for variation API
 */
async function prepareImageForVariationAPI(base64Image: string): Promise<Buffer> {
  try {
    // Extract base64 data if needed
    let base64Data = base64Image;
    if (base64Image.includes('base64,')) {
      base64Data = base64Image.split('base64,')[1];
    }

    // Convert to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Convert to square PNG (required by variation API)
    const metadata = await Sharp(buffer).metadata();

    // The image must be square with dimensions between 512x512 and 1024x1024
    const targetSize = 1024;

    // Create a square image with proper dimensions
    const squareBuffer = await Sharp(buffer)
      .resize({
        width: targetSize,
        height: targetSize,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    console.log(`Prepared image for variation API: ${buffer.length} bytes → ${squareBuffer.length} bytes, dimensions: ${targetSize}x${targetSize}`);

    return squareBuffer;
  } catch (error) {
    console.error('Error preparing image for variation API:', error);
    throw new Error(`Failed to prepare image for variation API: ${error.message}`);
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { images, style, petInfo } = data;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided or invalid format' },
        { status: 400 }
      );
    }

    if (!style || !Object.values(STYLE_OPTIONS).includes(style)) {
      return NextResponse.json(
        { error: 'Invalid or missing style parameter' },
        { status: 400 }
      );
    }

    console.log(`Starting stylization of ${images.length} images in "${style}" style`);

    // Process images one by one to avoid rate limits
    const stylizedImages = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      console.log(`Processing image ${i+1}/${images.length} (ID: ${image.id})`);

      try {
        // Verify image data exists and has reasonable length
        if (!image.base64 || image.base64.length < 100) {
          throw new Error(`Invalid image data for image ${i+1}: too short or missing`);
        }

        // Extract base64 data part only if needed
        let base64Data = image.base64;
        if (base64Data.includes(',')) {
          console.log(`Image ${i+1} contains data URL prefix, extracting base64 part`);
          base64Data = base64Data.split(',')[1];
        }

        // Check if image is too large
        if (base64Data.length > MAX_BASE64_LENGTH) {
          console.log(`Image ${i+1} is too large (${Math.round(base64Data.length / 1024 / 1024 * 100) / 100}MB), compressing...`);
          try {
            base64Data = await compressImage(base64Data);
            console.log(`Compression successful, new size: ${Math.round(base64Data.length / 1024 / 1024 * 100) / 100}MB`);
          } catch (compressError) {
            console.warn(`Compression failed for image ${i+1}:`, compressError);
            // Continue with original image
          }
        }

        console.log(`Image ${i+1} base64 length after processing: ${base64Data.length}`);

        // Stylize the image with a timeout
        const stylizePromise = stylizeImage(base64Data, style, petInfo || {});
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Stylization timed out after 90 seconds')), 90000);
        });

        const stylizedBase64 = await Promise.race([stylizePromise, timeoutPromise]);

        // Ensure we have the data:image prefix for the result
        const stylizedImageWithPrefix = stylizedBase64.includes('data:image')
          ? stylizedBase64
          : `data:image/jpeg;base64,${stylizedBase64}`;

        // Log information about the result
        console.log(`Successfully stylized image ${i+1}, result length: ${stylizedImageWithPrefix.length}`);

        stylizedImages.push({
          id: image.id,
          originalImage: image.base64,
          stylizedImage: stylizedImageWithPrefix
        });

        // Add a delay between processing images to avoid rate limits
        if (i < images.length - 1) {
          console.log('Adding delay before next image...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error stylizing image ${i+1}:`, error);

        // Add the original image with error information
        stylizedImages.push({
          id: image.id,
          originalImage: image.base64,
          stylizedImage: null,
          error: `Failed to stylize: ${error.message}`
        });
      }
    }

    // Check how many images were successfully stylized
    const successCount = stylizedImages.filter(img => img.stylizedImage).length;
    console.log(`Stylization complete: ${successCount}/${images.length} images successfully processed`);

    return NextResponse.json({
      success: true,
      stylizedImages,
      stats: {
        total: images.length,
        successful: successCount,
        failed: images.length - successCount
      }
    });

  } catch (error) {
    console.error('Error in stylize-images API:', error);

    return NextResponse.json(
      { error: `Failed to stylize images: ${error.message}` },
      { status: 500 }
    );
  }
}