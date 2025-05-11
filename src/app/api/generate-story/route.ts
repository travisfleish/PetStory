import { NextResponse } from 'next/server';
import { generateStoryWithFallback, editStoryStyleWithFallback } from '@/lib/services/openai-service';

export async function POST(request: Request) {
  try {
    console.log('generate-story API called with enhanced contextual storytelling');

    const data = await request.json();
    const { theme, petInfo, ownerInfo } = data;

    if (!theme) {
      return NextResponse.json(
        { error: 'No theme provided' },
        { status: 400 }
      );
    }

    console.log('Generating contextually rich story based on theme:', {
      themeName: theme.name,
      location: theme.location,
      holiday: theme.holiday,
      occasion: theme.occasion,
      photoCount: theme.photos?.length
    });

    // Generate story based on theme and pet info using enhanced context
    const story = await generateStoryWithFallback(theme, petInfo || {}, ownerInfo || {});

    console.log('Story generation successful:', {
      title: story.title,
      pageCount: story.pages?.length
    });

    return NextResponse.json({
      success: true,
      story
    });
  } catch (error) {
    console.error('Error in generate-story API:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

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

    console.log(`Editing story style to: ${style || 'more engaging'}`);

    // Edit the story with the requested style using enhanced style editing
    const editedText = await editStoryStyleWithFallback(storyText, style || 'more engaging');

    return NextResponse.json({
      success: true,
      editedText
    });
  } catch (error) {
    console.error('Error in edit-story API:', error);
    console.error('Error stack:', error.stack);

    return NextResponse.json(
      { error: `Failed to edit story: ${error.message}` },
      { status: 500 }
    );
  }
}