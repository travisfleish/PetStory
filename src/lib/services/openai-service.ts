import OpenAI from 'openai';

// Initialize OpenAI client once
let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

/**
 * Enhanced Vision analysis with fallback models and improved context detection
 */
export async function analyzeImageWithVision(imageBase64: string, prompt: string) {
  const openai = getOpenAIClient();

  // Try models in order of preference
  const modelsToTry = ["gpt-4o", "gpt-4-turbo", "gpt-4"];

  for (const model of modelsToTry) {
    try {
      console.log(`Attempting enhanced vision analysis with model: ${model}`);

      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are an expert image analyzer specializing in detecting rich contextual elements like holidays, occasions, moods, and detailed scene descriptions. Focus on identifying elements that would create meaningful themes for storytelling. Always be thorough in identifying contextual details."
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
        temperature: 0.2 // Lower temperature for more consistent analysis
      });

      // For non-JSON output models, parse the text
      try {
        return JSON.parse(response.choices[0].message.content || "{}");
      } catch (parseError) {
        console.warn(`Response not in JSON format from ${model}, attempting to parse manually`);

        // Try to extract key information from text response
        const content = response.choices[0].message.content || "";

        // Extract key-value pairs using regex
        const extractedData: Record<string, string> = {};
        const patterns = {
          petType: /pet\s*(?:type|breed)?:\s*([^,\n.]+)/i,
          location: /location:\s*([^,\n.]+)/i,
          activity: /activity:\s*([^,\n.]+)/i,
          holiday: /holiday:\s*([^,\n.]+)/i,
          occasion: /occasion:\s*([^,\n.]+)/i,
          people: /people:\s*([^,\n.]+)/i,
          objects: /objects:\s*([^,\n.]+)/i,
          mood: /mood:\s*([^,\n.]+)/i,
          season: /season:\s*([^,\n.]+)/i,
          timeOfDay: /time of day:\s*([^,\n.]+)/i,
          outfit: /outfit:\s*([^,\n.]+)/i,
          sceneDescription: /scene description:?\s*([^\n]+(?:\n[^\n]+)*)/i
        };

        for (const [key, pattern] of Object.entries(patterns)) {
          const match = content.match(pattern);
          if (match && match[1]) {
            extractedData[key] = match[1].trim();
          }
        }

        // Add a fallback scene description if none was found
        if (!extractedData.sceneDescription) {
          const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
          if (paragraphs.length > 0) {
            extractedData.sceneDescription = paragraphs[paragraphs.length - 1].trim();
          } else {
            extractedData.sceneDescription = "A pet in an everyday scene.";
          }
        }

        // Ensure minimum required fields
        return {
          petType: extractedData.petType || "pet",
          location: extractedData.location || "unknown",
          activity: extractedData.activity || "posing",
          people: extractedData.people || "",
          objects: extractedData.objects || "",
          holiday: extractedData.holiday || "",
          occasion: extractedData.occasion || "",
          mood: extractedData.mood || "",
          season: extractedData.season || "",
          outfit: extractedData.outfit || "",
          sceneDescription: extractedData.sceneDescription || "A pet in an everyday scene"
        };
      }

    } catch (error) {
      console.warn(`Model ${model} failed for vision:`, error.message);

      // Only continue trying if it seems model-related
      if (!error.message.includes('404') && !error.message.includes('not supported')) {
        throw error;
      }
    }
  }

  // If all models failed, return a basic fallback
  console.error("All models failed for enhanced vision analysis");
  return {
    petType: "pet",
    location: "unknown",
    activity: "posing",
    people: "",
    objects: "",
    sceneDescription: "A pet in an everyday scene"
  };
}

/**
 * Vision API with fallback models
 */
export async function callVisionAPI(imageBase64: string, prompt: string) {
  // This is an alias for analyzeImageWithVision for backward compatibility
  return await analyzeImageWithVision(imageBase64, prompt);
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
        return JSON.parse(response.choices[0].message.content || "{}");
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
 * Style image with fallback
 */
export async function stylizeImageWithFallback(imageBase64: string, style: string, prompt: string) {
  const openai = getOpenAIClient();

  try {
    console.log(`Attempting image stylization with style: ${style}`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json"
    });

    return response.data[0].b64_json;
  } catch (error) {
    console.error("Error stylizing image:", error);
    throw new Error(`Failed to stylize image: ${error.message}`);
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
  callVisionAPI,
  generateStoryWithFallback,
  stylizeImageWithFallback,
  editStoryStyleWithFallback
};