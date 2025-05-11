import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PhotoAnalysisResult {
  petType: string;
  petBreed?: string;
  location: string;
  activity: string;
  people?: string;
  objects?: string;
  [key: string]: any;
}

interface AnalyzedPhoto extends PhotoAnalysisResult {
  id: string;
  originalImage: string;
  error?: string;
}

interface Theme {
  id: string;
  name: string;
  location: string;
  mainActivity: string;
  photos: AnalyzedPhoto[];
}

/**
 * Analyzes a photo using OpenAI's Vision model to detect:
 * - Pet presence and details
 * - Location/setting
 * - Activities
 */
export const analyzePhoto = async (imageBase64: string): Promise<PhotoAnalysisResult> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this pet photo. Detect: 1) Pet type and breed if visible, 2) Location/setting (e.g., park, beach, home), 3) Activity (e.g., playing, sleeping, eating), 4) Any people present, 5) Notable objects/props. Return as JSON with these keys: petType, petBreed, location, activity, people, objects."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content) as PhotoAnalysisResult;
  } catch (error) {
    console.error("Error analyzing photo:", error);
    throw new Error(`Failed to analyze photo: ${(error as Error).message}`);
  }
};

/**
 * Groups analyzed photos into thematic clusters
 */
export const groupPhotosByTheme = (analyzedPhotos: AnalyzedPhoto[]): Theme[] => {
  // Create initial groupings by location
  const locationGroups: Record<string, AnalyzedPhoto[]> = {};

  analyzedPhotos.forEach(photo => {
    const location = photo.location.toLowerCase();
    if (!locationGroups[location]) {
      locationGroups[location] = [];
    }
    locationGroups[location].push(photo);
  });

  // Convert to themed groups with friendly names
  const themes: Theme[] = [];

  for (const [location, photos] of Object.entries(locationGroups)) {
    // Generate theme name based on location and most common activity
    const activities = photos.map(p => p.activity.toLowerCase());
    const mostCommonActivity = findMostCommon(activities);

    let themeName = "";

    switch (location) {
      case "park":
      case "garden":
      case "backyard":
        themeName = "Park Adventure";
        break;
      case "beach":
      case "ocean":
      case "sea":
        themeName = "Beach Day";
        break;
      case "home":
      case "house":
      case "apartment":
        themeName = "Home Sweet Home";
        break;
      case "car":
      case "vehicle":
        themeName = "Road Trip";
        break;
      case "orchard":
      case "farm":
        themeName = "Farm Visit";
        break;
      default:
        themeName = `${capitalizeFirstLetter(location)} Adventure`;
    }

    themes.push({
      id: generateThemeId(themeName),
      name: themeName,
      location: location,
      mainActivity: mostCommonActivity,
      photos: photos
    });
  }

  return themes;
};

// Helper functions
function findMostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  let maxCount = 0;
  let mostCommon = arr[0];

  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostCommon = item;
    }
  }

  return mostCommon;
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function generateThemeId(themeName: string): string {
  return themeName.toLowerCase().replace(/\s+/g, '-');
}

export default {
  analyzePhoto,
  groupPhotosByTheme
};