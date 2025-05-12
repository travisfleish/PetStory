import OpenAI from 'openai';

// Initialize OpenAI client once
let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('Initializing OpenAI client with API key:', 
      apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : 'MISSING');
    
    openaiInstance = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openaiInstance;
}

/**
 * Enhanced Vision analysis with improved error handling and JSON parsing
 */
export async function analyzeImageWithVision(imageBase64: string, prompt: string) {
  try {
    console.log('Starting vision analysis, image base64 length:', imageBase64.length);
    
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
  generateStoryWithFallback,
  stylizeImageWithFallback,
  editStoryStyleWithFallback
};