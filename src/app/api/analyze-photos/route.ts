import { NextResponse } from 'next/server';
import { analyzePhoto, groupPhotosByTheme } from '@/lib/photoAnalysis';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { photos } = data;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos provided or invalid format' },
        { status: 400 }
      );
    }

    // Analyze each photo
    const analysisPromises = photos.map(async (photo) => {
      try {
        const result = await analyzePhoto(photo.base64.split(',')[1]);
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
          originalImage: photo.base64,
          // Fallback values
          petType: 'pet',
          location: 'unknown',
          activity: 'posing',
          people: '',
          objects: ''
        };
      }
    });

    const analyzedPhotos = await Promise.all(analysisPromises);

    // Group photos by theme
    const themes = groupPhotosByTheme(analyzedPhotos);

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