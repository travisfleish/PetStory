import { NextResponse } from 'next/server';
import { stylizeImage, STYLE_OPTIONS } from '@/lib/imageStylizer';

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

    // Process images in parallel with a concurrency limit
    const concurrencyLimit = 2; // Process 2 images at a time to avoid rate limits
    const stylizedImages = [];

    for (let i = 0; i < images.length; i += concurrencyLimit) {
      const batch = images.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async (image) => {
        try {
          // Extract base64 data part only
          const base64Data = image.base64.split(',')[1];
          const stylizedBase64 = await stylizeImage(base64Data, style, petInfo || {});

          return {
            id: image.id,
            originalImage: image.base64,
            stylizedImage: `data:image/jpeg;base64,${stylizedBase64}`
          };
        } catch (error) {
          console.error(`Error stylizing image ${image.id}:`, error);
          return {
            id: image.id,
            error: `Failed to stylize: ${error.message}`,
            originalImage: image.base64,
            stylizedImage: null
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      stylizedImages.push(...batchResults);
    }

    return NextResponse.json({
      success: true,
      stylizedImages
    });
  } catch (error) {
    console.error('Error in stylize-images API:', error);

    return NextResponse.json(
      { error: `Failed to stylize images: ${error.message}` },
      { status: 500 }
    );
  }
}