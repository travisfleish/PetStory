import { NextResponse } from 'next/server';
import { analyzePhoto } from '@/lib/photoAnalysis';

export async function POST(request: Request) {
  try {
    console.log('Single photo analysis API called for debugging');

    const data = await request.json();
    const { photo } = data;

    if (!photo || !photo.base64) {
      return NextResponse.json(
        { error: 'No photo provided or invalid format' },
        { status: 400 }
      );
    }

    console.log(`Analyzing single photo ${photo.id} for debugging purposes`);

    try {
      // Process the base64 string to get the data part
      const base64Data = photo.base64.split(',')[1] || photo.base64;

      // Analyze the photo with full details
      const result = await analyzePhoto(base64Data);

      console.log('Debug analysis complete with full details');
      console.log('==== DETAILED PHOTO ANALYSIS ====');
      console.log(JSON.stringify(result, null, 2));
      console.log('=================================');

      // Add the ID to the result
      const analyzedPhoto = {
        ...result,
        id: photo.id
      };

      return NextResponse.json({
        success: true,
        analyzedPhoto
      });

    } catch (error) {
      console.error(`Error analyzing photo for debug:`, error);
      console.error('Error stack:', error.stack);

      return NextResponse.json({
        success: false,
        error: `Analysis failed: ${error.message}`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in analyze-photo debug API:', error);
    console.error('Error stack:', error.stack);

    return NextResponse.json(
      { error: `Failed to analyze photo: ${error.message}` },
      { status: 500 }
    );
  }
}