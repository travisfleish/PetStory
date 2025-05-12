import { NextResponse } from 'next/server';
import { analyzePhoto, groupPhotosByTheme } from '@/lib/photoAnalysis';

export async function POST(request: Request) {
  try {
    console.log('Analyze photos API called');

    const data = await request.json();
    const { photos } = data;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos provided or invalid format' },
        { status: 400 }
      );
    }

    console.log(`Analyzing ${photos.length} photos...`);

    // Process photos in parallel with a concurrency limit
    const concurrencyLimit = 2; // Process 2 photos at a time to avoid rate limits
    const analyzedPhotos = [];

    for (let i = 0; i < photos.length; i += concurrencyLimit) {
      const batch = photos.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async (photo) => {
        try {
          // Log the incoming photo data
          console.log(`Processing photo ${photo.id}, base64 prefix:`,
            photo.base64.substring(0, 20) + '...');

          // Properly extract base64 data
          let base64Data;
          if (photo.base64.includes(',')) {
            base64Data = photo.base64.split(',')[1];
          } else {
            base64Data = photo.base64;
          }

          // Ensure the data looks valid
          if (!base64Data || base64Data.length < 100) {
            console.error(`Photo ${photo.id} has invalid base64 data (too short)`);
            throw new Error('Invalid image data');
          }

          // Analyze the photo
          const result = await analyzePhoto(base64Data);

          return {
            ...result,
            id: photo.id,
            originalImage: photo.base64
          };
        } catch (error) {
          console.error(`Error analyzing photo ${photo.id}:`, error);
          return {
            id: photo.id,
            error: `Failed to analyze: ${error.message}`,
            petType: "pet",
            location: "unknown",
            activity: "posing",
            originalImage: photo.base64
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      analyzedPhotos.push(...batchResults);
    }

    // Group photos into themes
    const themes = groupPhotosByTheme(analyzedPhotos);

    console.log(`Analysis complete: ${analyzedPhotos.length} photos processed, ${themes.length} themes identified`);

    return NextResponse.json({
      success: true,
      analyzedPhotos,
      themes
    });
  } catch (error) {
    console.error('Error in analyze-photos API:', error);

    return NextResponse.json(
      { error: `Failed to analyze photos: ${error.message}` },
      { status: 500 }
    );
  }
}