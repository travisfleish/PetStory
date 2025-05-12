// src/app/api/stylize-with-variation/route.ts
import { NextResponse } from 'next/server';
import { STYLE_OPTIONS } from '@/lib/imageStylizer';
import { OpenAI } from 'openai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Sharp from 'sharp';

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

export async function POST(request: Request) {
  // Create a temporary directory for our files
  const tempDir = path.join(os.tmpdir(), `pet-stylize-${Date.now()}`);
  try {
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log(`Created temp directory: ${tempDir}`);

    const data = await request.json();
    const { image, style, petInfo } = data;

    if (!image || !image.base64) {
      throw new Error('No image provided or invalid format');
    }

    if (!style || !Object.values(STYLE_OPTIONS).includes(style)) {
      throw new Error('Invalid or missing style parameter');
    }

    // Extract base64 data
    let base64Data = image.base64;
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }

    // Create a buffer from the base64 data
    const imageBuffer = Buffer.from(base64Data, 'base64');
    console.log(`Image buffer size: ${Math.round(imageBuffer.length / 1024)}KB`);

    // Process the image to ensure it's square (required by variation API)
    const processedBuffer = await Sharp(imageBuffer)
      .resize({
        width: 1024,
        height: 1024,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    console.log(`Processed image size: ${Math.round(processedBuffer.length / 1024)}KB`);

    // Write the image to a temporary file
    const tempFilePath = path.join(tempDir, 'input-image.png');
    fs.writeFileSync(tempFilePath, processedBuffer);
    console.log(`Saved image to temporary file: ${tempFilePath}`);

    try {
      console.log('Attempting image variation...');

      // Create a read stream for the API
      const imageFileStream = fs.createReadStream(tempFilePath);

      // Use the OpenAI variation API with a file stream
      const variationResponse = await openai.images.createVariation({
        image: imageFileStream,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      });

      console.log('Variation request successful!');

      if (variationResponse.data && variationResponse.data[0] && variationResponse.data[0].b64_json) {
        const result = {
          success: true,
          stylizedImage: `data:image/jpeg;base64,${variationResponse.data[0].b64_json}`,
          method: 'variation'
        };

        // Clean up temp files
        fs.unlinkSync(tempFilePath);
        fs.rmdirSync(tempDir);

        return NextResponse.json(result);
      } else {
        throw new Error('Variation API returned invalid response structure');
      }
    } catch (variationError) {
      console.error('Variation API error:', variationError.message);

      // Fallback to DALL-E generation with a prompt
      try {
        console.log('Falling back to DALL-E generation...');

        // Create style-specific prompt
        let promptText = '';
        switch(style) {
          case 'cartoon':
            promptText = 'A cute cartoon illustration of a pet dog in Disney or Pixar style. The dog has light brown fur and is sitting in a living room with wooden walls.';
            break;
          case 'watercolor':
            promptText = 'A soft watercolor illustration of a pet dog with light brown fur sitting in a living room with wooden walls.';
            break;
          case 'ghibli':
            promptText = 'A Studio Ghibli style illustration of a pet dog with light brown fur, in the style of "My Neighbor Totoro", sitting in a cozy living room.';
            break;
          default:
            promptText = 'A cute illustration of a pet dog with light brown fur sitting in a living room.';
        }

        // Add pet details if available
        if (petInfo?.name || petInfo?.type) {
          promptText += ` The ${petInfo.type || 'dog'} ${petInfo.name ? `named ${petInfo.name}` : ''} has a friendly expression.`;
        }

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: promptText,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        });

        console.log('DALL-E generation successful!');

        if (response.data && response.data[0] && response.data[0].b64_json) {
          const result = {
            success: true,
            stylizedImage: `data:image/jpeg;base64,${response.data[0].b64_json}`,
            method: 'generation'
          };

          // Clean up temp files
          fs.unlinkSync(tempFilePath);
          fs.rmdirSync(tempDir);

          return NextResponse.json(result);
        } else {
          throw new Error('DALL-E API returned invalid response structure');
        }
      } catch (dalleError) {
        console.error('DALL-E generation also failed:', dalleError.message);

        // Clean up temp files
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);

        return NextResponse.json({
          success: false,
          error: `Failed to stylize image: ${variationError.message}`,
          fallbackError: dalleError.message
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Error in stylize-with-variation API:', error);

    // Clean up temp dir if it exists
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return NextResponse.json({
      success: false,
      error: `Failed to process image: ${error.message}`
    }, { status: 500 });
  }
}