import OpenAI from 'openai';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Initialize OpenAI client once
let openaiInstance: OpenAI | null = null;

// Constants for API limits
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB max for DALL-E
const MAX_BASE64_LENGTH = MAX_IMAGE_SIZE_BYTES * 1.37; // Base64 is ~1.37x larger than binary

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('Initializing OpenAI client with API key:',
      apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : 'MISSING');

    if (!apiKey) {
      console.error('CRITICAL ERROR: OpenAI API key is missing');
      throw new Error('OpenAI API key is not configured');
    }

    if (!apiKey.startsWith('sk-')) {
      console.error('CRITICAL ERROR: OpenAI API key has invalid format');
      throw new Error('OpenAI API key has invalid format');
    }

    openaiInstance = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openaiInstance;
}

/**
 * Checks if the image is too large and logs a warning
 */
function checkImageSize(imageBase64: string): boolean {
  const isTooLarge = imageBase64.length > MAX_BASE64_LENGTH;

  if (isTooLarge) {
    const sizeMB = Math.round(imageBase64.length / 1024 / 1024 * 100) / 100;
    console.warn(`Image size (${sizeMB}MB) exceeds OpenAI's recommended limit of 4MB. This may cause failures or timeouts.`);
  }

  return isTooLarge;
}

/**
 * Compress image in browser environment
 */
function compressImageInBrowser(imageData: string, maxWidth = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');

        // Calculate dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Get compressed data
        const compressed = canvas.toDataURL('image/jpeg', quality);

        // Extract base64 part if needed
        if (compressed.includes('base64,')) {
          resolve(compressed.split('base64,')[1]);
        } else {
          resolve(compressed);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for compression'));

      // Set image source
      if (imageData.includes('data:image')) {
        img.src = imageData;
      } else {
        img.src = `data:image/jpeg;base64,${imageData}`;
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Enhanced Vision analysis with improved error handling and JSON parsing
 */
export async function analyzeImageWithVision(imageBase64: string, prompt: string) {
  try {
    console.log('Starting vision analysis, image base64 length:', imageBase64.length);

    // Check size and log warning if too large
    checkImageSize(imageBase64);

    const openai = getOpenAIClient();

    // Try models in order of preference
    const modelsToTry = ["gpt-4o", "gpt-4-vision-preview", "gpt-4-turbo"];

    for (const model of modelsToTry) {
      try {
        console.log(`Attempting vision analysis with model: ${model}`);

        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: "You are an expert photo analyzer. Respond with clean JSON only, no markdown formatting, no explanation, no code blocks."
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.2
        });

        console.log(`Model ${model} responded successfully`);
        console.log('Response content length:', response.choices[0].message.content?.length || 0);
        console.log('First 100 chars of response:', response.choices[0].message.content?.substring(0, 100) || '');

        // Get the raw content
        const rawContent = response.choices[0].message.content || "";

        // Try to extract JSON from the content (handling code blocks)
        try {
          // Handle content wrapped in code blocks (```json ... ```)
          let jsonContent = rawContent;

          // Remove markdown code block markers if present
          if (jsonContent.includes('```')) {
            const jsonMatch = jsonContent.match(/```(?:json)?\s*([^`]+)```/s);
            if (jsonMatch && jsonMatch[1]) {
              jsonContent = jsonMatch[1].trim();
            }
          }

          const parsedResponse = JSON.parse(jsonContent);
          console.log('Successfully parsed JSON response');
          return parsedResponse;
        } catch (parseError) {
          console.warn(`Failed to parse response as JSON:`, parseError);
          console.log('Raw response:', rawContent);

          // Create a more intelligent extraction method that handles both text and code blocks
          let extractedData = {
            petType: "pet",
            location: "unknown",
            activity: "posing",
            people: "",
            objects: "",
            holiday: "",
            occasion: "",
            sceneDescription: "A pet in an everyday scene"
          };

          // Try to extract JSON from code blocks first
          if (rawContent.includes('```')) {
            const jsonMatch = rawContent.match(/```(?:json)?\s*({[^`]+})```/s);
            if (jsonMatch && jsonMatch[1]) {
              try {
                const jsonData = JSON.parse(jsonMatch[1].trim());
                // If we successfully parse JSON from the code block, use it
                extractedData = {
                  ...extractedData,
                  ...jsonData
                };
                console.log('Extracted JSON from code block successfully');
                return extractedData;
              } catch (e) {
                console.warn('Failed to parse JSON from code block', e);
              }
            }
          }

          // If we get here, fall back to extracting fields from text
          console.log('Falling back to text field extraction');
          extractedData = {
            petType: extractField(rawContent, "petType", "pet") || "pet",
            petBreed: extractField(rawContent, "petBreed", "") || "",
            location: extractField(rawContent, "location", "unknown") || "unknown",
            activity: extractField(rawContent, "activity", "posing") || "posing",
            people: extractField(rawContent, "people", "") || "",
            objects: extractField(rawContent, "objects", "") || "",
            holiday: extractField(rawContent, "holiday", "") || "",
            occasion: extractField(rawContent, "occasion", "") || "",
            season: extractField(rawContent, "season", "") || "",
            mood: extractField(rawContent, "mood", "") || "",
            sceneDescription: extractField(rawContent, "sceneDescription",
              "A pet in an everyday scene") || "A pet in an everyday scene"
          };

          console.log('Extracted data from text response:', extractedData);
          return extractedData;
        }
      } catch (modelError) {
        console.error(`Model ${model} failed:`, modelError);
        // Continue to next model
      }
    }

    // If all models failed
    throw new Error('All models failed for vision analysis');

  } catch (error) {
    console.error('Vision analysis error:', error);
    throw error;
  }
}

// Improved field extraction that handles JSON syntax
function extractField(text, field, defaultValue) {
  if (!text) return defaultValue;

  // Check for direct JSON patterns first
  const jsonPatterns = [
    new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'),  // "field": "value"
    new RegExp(`"${field}"\\s*:\\s*([^",\\s]+)`, 'i')  // "field": value
  ];

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fall back to more general patterns
  const generalPatterns = [
    new RegExp(`${field}[:\\s]+"([^"]*)"`, 'i'),
    new RegExp(`${field}[:\\s]+([^,\\n.]*)`, 'i')
  ];

  for (const pattern of generalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return defaultValue;
}

/**
 * Generate an enhanced story based on richer contextual information
 */
export async function generateStoryWithFallback(theme, petInfo, ownerInfo) {
  const openai = getOpenAIClient();

  // Try models in order
  const modelsToTry = ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];

  // Create a rich context-aware prompt using all available thematic information
  const contextualTheme = theme.holiday || theme.occasion || theme.context || theme.name;

  const photoDescriptions = theme.photos.map((photo, index) => {
    // Include rich contextual elements in the photo descriptions
    let description = `Photo ${index + 1}: ${photo.petType} ${photo.petBreed || ''} ${photo.activity} at ${photo.location}.`;

    if (photo.holiday) description += ` Holiday: ${photo.holiday}.`;
    if (photo.occasion) description += ` Occasion: ${photo.occasion}.`;
    if (photo.mood) description += ` Mood: ${photo.mood}.`;
    if (photo.outfit) description += ` Outfit: ${photo.outfit}.`;
    if (photo.people) description += ` People: ${photo.people}.`;
    if (photo.objects) description += ` Objects: ${photo.objects}.`;
    if (photo.sceneDescription) description += ` Scene: ${photo.sceneDescription}`;

    return description;
  }).join('\n');

  const prompt = `
    Write a rich, detailed children's storybook narrative about a pet's adventure.
    
    Pet info:
    - Name: ${petInfo.name}
    - Type: ${petInfo.type || theme.photos[0].petType}
    
    Owner info:
    - Name: ${ownerInfo.name || 'the owner'}
    
    Theme: ${contextualTheme}
    Main location: ${theme.location}
    Main activity: ${theme.mainActivity}
    ${theme.holiday ? `Holiday: ${theme.holiday}` : ''}
    ${theme.occasion ? `Special occasion: ${theme.occasion}` : ''}
    
    Photo details:
    ${photoDescriptions}
    
    Create a storybook with:
    1. A title that captures the theme (e.g., "${petInfo.name}'s Christmas Adventure" or "${petInfo.name}'s Birthday Celebration")
    2. One page of narrative text per photo (about 1-2 short sentences each, suitable for a children's book)
    3. A brief conclusion
    
    Make maximum use of the contextual details provided. If holiday elements like Christmas trees, presents, or decorations are mentioned, incorporate them into the story. If there are special outfits or costumes, mention them. Create a rich, immersive world based on all the details provided.
    
    Return as JSON with this structure:
    {
      "title": "Story title",
      "pages": [
        { "text": "Page 1 text" },
        { "text": "Page 2 text" },
        ...
      ]
    }
    
    Make the story cute, simple, and engaging for children, written in present tense. Use the pet's name frequently.
  `;

  for (const model of modelsToTry) {
    try {
      console.log(`Attempting enhanced story generation with model: ${model}`);

      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a children's book author specializing in creating rich, immersive stories about pets. You excel at incorporating contextual details like holidays, seasons, and special occasions into your narratives."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      // Try to parse as JSON
      try {
        // Get the raw content
        const rawContent = response.choices[0].message.content || "";

        // Handle content wrapped in code blocks
        let jsonContent = rawContent;

        // Remove markdown code block markers if present
        if (jsonContent.includes('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([^`]+)```/s);
          if (jsonMatch && jsonMatch[1]) {
            jsonContent = jsonMatch[1].trim();
          }
        }

        return JSON.parse(jsonContent);
      } catch (parseError) {
        // Handle non-JSON responses
        console.warn(`Response not in JSON format from ${model}, attempting to parse manually`);

        const content = response.choices[0].message.content || "";

        // Extract title and pages (basic version)
        const title = content.match(/title["']?\s*:\s*["']([^"']+)["']/i)?.[1] || `${petInfo.name}'s Adventure`;

        // Extract text blocks that look like pages
        const pageMatches = Array.from(content.matchAll(/text["']?\s*:\s*["']([^"']+)["']/gi));
        const pages = pageMatches.map(match => ({ text: match[1] }));

        if (pages.length === 0) {
          // Fallback if no pages found
          const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
          return {
            title: title,
            pages: paragraphs.map(p => ({ text: p }))
          };
        }

        return { title, pages };
      }

    } catch (error) {
      console.warn(`Model ${model} failed for enhanced story generation:`, error.message);

      // Only continue trying if it seems model-related
      if (!error.message.includes('404') && !error.message.includes('not supported')) {
        throw error;
      }
    }
  }

  // If all models failed, return a minimal story
  console.error("All models failed for enhanced story generation");
  return {
    title: `${petInfo.name}'s ${theme.name || 'Adventure'}`,
    pages: [
      { text: `Once upon a time, there was a ${petInfo.type || 'pet'} named ${petInfo.name} who went on an adventure.` },
      { text: `${petInfo.name} had a wonderful time exploring and playing.` },
      { text: `At the end of the day, ${petInfo.name} returned home, happy and tired.` }
    ]
  };
}

/**
 * Create a PNG file from base64 data for the variation API
 */
async function createImageFileForVariation(base64Data: string): Promise<string> {
  try {
    // Create a temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `image-variation-${Date.now()}.png`);

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Write to file
    fs.writeFileSync(tempFilePath, imageBuffer);

    console.log(`Created temporary file for variation API: ${tempFilePath} (${Math.round(imageBuffer.length / 1024)}KB)`);

    return tempFilePath;
  } catch (error) {
    console.error('Error creating file for variation API:', error);
    throw error;
  }
}

/**
 * Enhanced image stylization using proper file handling for Variation API
 */
export async function stylizeImageWithFallback(imageBase64: string, style: string, prompt: string) {
  try {
    console.log(`Starting image stylization for style: ${style}`);
    const sizeMB = Math.round(imageBase64.length / 1024 / 1024 * 100) / 100;
    console.log(`Original image data length: ${imageBase64.length} chars (${sizeMB}MB)`);

    // Check if image is too large
    const isTooLarge = checkImageSize(imageBase64);

    // Try to compress in browser environment if needed and possible
    if (isTooLarge && typeof window !== 'undefined') {
      try {
        console.log('Attempting to compress large image in browser...');
        const compressedImage = await compressImageInBrowser(imageBase64);
        console.log(`Compressed image size: ${Math.round(compressedImage.length / 1024 / 1024 * 100) / 100}MB`);
        imageBase64 = compressedImage;
      } catch (compressError) {
        console.warn('Failed to compress image in browser:', compressError.message);
        // Continue with original image
      }
    }

    // Extract the base64 data without prefix if needed
    if (imageBase64.includes('base64,')) {
      imageBase64 = imageBase64.split('base64,')[1];
      console.log(`Extracted base64 data, new length: ${imageBase64.length} chars`);
    }

    // Ensure we have valid data
    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error('Invalid or empty image data provided');
    }

    // Create appropriate prompt based on style
    let promptText: string;

    switch (style) {
      case 'cartoon':
        promptText = `Transform this EXACT pet photo into a cute cartoon children's book illustration. Style of Disney or Pixar animation. Faithfully preserve the pet's exact appearance, coloration, and setting from the original photo.`;
        break;
      case 'watercolor':
        promptText = `Transform this EXACT pet photo into a soft watercolor children's book illustration with gentle colors and outlines. Faithfully preserve the pet's exact appearance, coloration, and setting from the original photo.`;
        break;
      case 'ghibli':
        promptText = `Transform this EXACT pet photo into a Studio Ghibli style illustration, as if from "My Neighbor Totoro" or "Kiki's Delivery Service". Faithfully preserve the pet's exact appearance, coloration, and setting from the original photo.`;
        break;
      case 'flat-illustration':
        promptText = `Transform this EXACT pet photo into a modern, flat vector-style illustration with simple shapes and bright colors. Faithfully preserve the pet's exact appearance, coloration, and setting from the original photo.`;
        break;
      default:
        promptText = `Transform this EXACT pet photo into a cute children's book illustration. Faithfully preserve the pet's exact appearance, coloration, and setting from the original photo.`;
    }

    // Add the custom prompt if provided
    if (prompt) {
      promptText += ` ${prompt}`;
    }

    // Add explicit instructions to use the exact photo
    promptText += ` IMPORTANT: DO NOT use generic placeholder images. Use ONLY the exact pet photo I'm uploading.`;

    // Initialize OpenAI client
    const openai = getOpenAIClient();

    // Make shorter prompts for better success rate
    const shortenedPrompt = promptText.substring(0, 300);
    console.log(`Using prompt: "${shortenedPrompt}..."`);

    // Set up a timeout promise for 60 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DALL-E API request timed out after 60 seconds')), 60000);
    });

    // Try using image variation first
    try {
      console.log('Attempting image variation with OpenAI API...');

      // Convert base64 to buffer - this is the key fix for the 413 error
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      // Record buffer size for debugging
      const bufferSizeKB = Math.round(imageBuffer.length / 1024);
      console.log(`Image buffer size: ${bufferSizeKB}KB`);

      // Use the variation API with proper buffer format
      const variationPromise = openai.images.createVariation({
        image: imageBuffer,  // Pass buffer directly, not base64 string
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      });

      // Race the variation API call against the timeout
      const variationResponse = await Promise.race([variationPromise, timeoutPromise]);

      if (variationResponse.data && variationResponse.data[0] && variationResponse.data[0].b64_json) {
        console.log('Successfully created image variation');
        return variationResponse.data[0].b64_json;
      } else {
        throw new Error('Variation API returned invalid response structure');
      }
    } catch (variationError) {
      console.error('Image variation failed:', variationError.message);
      console.log('Falling back to standard DALL-E generation...');

      // Fall back to standard DALL-E3 generation if variation fails
      try {
        console.log('Attempting image generation with DALL-E-3...');

        // Try DALL-E 3 with a timeout
        const responsePromise = openai.images.generate({
          model: "dall-e-3",
          prompt: shortenedPrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        });

        // Race the API call against the timeout
        const response = await Promise.race([responsePromise, timeoutPromise]);

        if (response.data && response.data[0] && response.data[0].b64_json) {
          console.log('Successfully generated image with DALL-E-3');
          return response.data[0].b64_json;
        } else {
          throw new Error('DALL-E API returned invalid response structure');
        }

      } catch (dalleError) {
        console.error('DALL-E-3 generation failed:', dalleError.message);

        // Try DALL-E 2 as fallback
        try {
          console.log('Falling back to DALL-E-2...');

          const response = await openai.images.generate({
            model: "dall-e-2",
            prompt: shortenedPrompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
          });

          if (response.data && response.data[0] && response.data[0].b64_json) {
            console.log('Successfully generated image with DALL-E-2');
            return response.data[0].b64_json;
          } else {
            throw new Error('DALL-E-2 API returned invalid response structure');
          }

        } catch (dalle2Error) {
          console.error('DALL-E-2 generation also failed:', dalle2Error.message);

          // Provide more helpful error messages based on error type
          if (variationError.message.includes('billing') || dalleError.message.includes('billing') || dalle2Error.message.includes('billing')) {
            throw new Error('OpenAI billing verification required. Please check your account status.');
          } else if (variationError.message.includes('quota') || dalleError.message.includes('quota') || dalle2Error.message.includes('quota')) {
            throw new Error('OpenAI API quota exceeded. Please check your usage limits.');
          } else if (variationError.message.includes('rate limit') || dalleError.message.includes('rate limit') || dalle2Error.message.includes('rate limit')) {
            throw new Error('OpenAI API rate limit reached. Please try again in a few minutes.');
          } else if (variationError.message.includes('content') || dalleError.message.includes('content') || dalle2Error.message.includes('content')) {
            throw new Error('Content policy violation. The image may contain inappropriate content.');
          } else if (variationError.message.includes('size') || dalleError.message.includes('size') || dalle2Error.message.includes('size')) {
            throw new Error('Image is too large. Please use a smaller image (under 4MB).');
          } else {
            // Re-throw the original error
            throw variationError;
          }
        }
      }
    }
  } catch (error) {
    console.error("Critical error stylizing image:", error);
    throw error;
  }
}

/**
 * Edit story style with fallback
 */
export async function editStoryStyleWithFallback(storyText: string, style: string) {
  const openai = getOpenAIClient();

  // Try models in order
  const modelsToTry = ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];

  for (const model of modelsToTry) {
    try {
      console.log(`Attempting story style editing with model: ${model}`);

      const prompt = `
        Edit this children's story text to make it ${style}:
        
        "${storyText}"
        
        Keep approximately the same length and maintain child-friendly language.
      `;

      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0].message.content || storyText;

    } catch (error) {
      console.warn(`Model ${model} failed for story editing:`, error.message);

      // Only continue trying if it seems model-related
      if (!error.message.includes('404') && !error.message.includes('not supported')) {
        throw error;
      }
    }
  }

  // If all models failed, return the original text
  console.error("All models failed for story editing");
  return storyText;
}

export default {
  analyzeImageWithVision,
  generateStoryWithFallback,
  stylizeImageWithFallback,
  editStoryStyleWithFallback
};