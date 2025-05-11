import { NextResponse } from 'next/server';
import { generateStory, editStoryStyle } from '@/lib/storyGenerator';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { theme, petInfo, ownerInfo } = data;

    if (!theme) {
      return NextResponse.json(
        { error: 'No theme provided' },
        { status: 400 }
      );
    }

    // Generate story based on theme and pet info
    const story = await generateStory(theme, petInfo || {}, ownerInfo || {});

    return NextResponse.json({
      success: true,
      story
    });
  } catch (error) {
    console.error('Error in generate-story API:', error);

    return NextResponse.json(
      { error: `Failed to generate story: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const { storyText, style } = data;

    if (!storyText) {
      return NextResponse.json(
        { error: 'No story text provided' },
        { status: 400 }
      );
    }

    // Edit the story with the requested style
    const editedText = await editStoryStyle(storyText, style || 'more engaging');

    return NextResponse.json({
      success: true,
      editedText
    });
  } catch (error) {
    console.error('Error in edit-story API:', error);

    return NextResponse.json(
      { error: `Failed to edit story: ${error.message}` },
      { status: 500 }
    );
  }
}