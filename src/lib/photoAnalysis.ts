import { analyzeImageWithVision } from '@/lib/services/openai-service';

interface PhotoAnalysisResult {
  // Basic pet information
  petType: string;
  petBreed?: string;

  // Core scene elements
  location: string;
  activity: string;
  people?: string;
  objects?: string;

  // Enhanced contextual elements
  holiday?: string;      // Christmas, Halloween, Thanksgiving, etc.
  season?: string;       // Winter, Summer, etc.
  occasion?: string;     // Birthday, Wedding, Graduation, etc.
  timeOfDay?: string;    // Morning, Evening, etc.
  mood?: string;         // Happy, Relaxed, Playful, etc.
  outfit?: string;       // Matching sweaters, Costumes, etc.
  weatherCondition?: string; // Snowy, Sunny, Rainy, etc.

  // Free-form scene description for more creative storytelling
  sceneDescription?: string;

  // Catch-all for unexpected but valuable context
  additionalContext?: Record<string, string>;

  // Error handling
  error?: string;

  // Allow other properties
  [key: string]: any;
}

interface AnalyzedPhoto extends PhotoAnalysisResult {
  id: string;
  originalImage: string;
}

interface Theme {
  id: string;
  name: string;
  location: string;
  mainActivity: string;
  context?: string;      // Added rich thematic context
  occasion?: string;    // Added special occasion
  holiday?: string;     // Added holiday if present
  photos: AnalyzedPhoto[];
}

/**
 * Analyzes a photo using OpenAI Vision with a much more open-ended prompt
 * to capture rich contextual information
 */
export const analyzePhoto = async (imageBase64: string): Promise<PhotoAnalysisResult> => {
  try {
    // Much more explicit prompt with formatting instructions
    const prompt = `
      Analyze this photo comprehensively and return detailed information about the scene, focusing on the pet and context.
      
      Please identify as many relevant contextual elements as possible, including but not limited to:
      - Pet type, breed, and what it's doing
      - Location/setting details (be specific - e.g. "living room with Christmas tree" rather than just "home")
      - Activity happening in the scene
      - People present and their relationship to the pet
      - Notable objects, props, decorations 
      - Holiday context if any (Christmas, Halloween, etc.)
      - Special occasion or event (birthday, wedding, etc.)
      - Season or time of year
      - Weather conditions if visible
      - Time of day
      - Mood or atmosphere of the scene
      - Clothing or outfits (especially matching or themed outfits)
      - Anything unusual or particularly noteworthy
      
      Also include a brief, evocative description of the overall scene that could be used in a storybook.
      
      IMPORTANT: Return ONLY raw JSON with these keys (at minimum):
      petType, petBreed, location, activity, people, objects, holiday, occasion, season, mood, outfit, sceneDescription.
      
      Do not include any explanations, markdown formatting, or code blocks.
      Your entire response should be valid JSON that can be directly parsed.
    `;

    console.log('Starting comprehensive photo analysis...');
    const result = await analyzeImageWithVision(imageBase64, prompt);

    return result;

  } catch (error) {
    console.error("Error analyzing photo:", error);

    // Return basic fallback data
    return {
      petType: "pet",
      location: "unknown",
      activity: "posing",
      people: "",
      objects: "",
      error: error.message,
      sceneDescription: "A pet in an everyday scene"
    };
  }
};

/**
 * Groups analyzed photos into rich thematic clusters based on multiple contextual elements
 */
export const groupPhotosByTheme = (analyzedPhotos: AnalyzedPhoto[]): Theme[] => {
  // Create initial contextual groupings with priority hierarchy
  const groups: Record<string, AnalyzedPhoto[]> = {};

  // First attempt to group by holiday/occasion which are strongest contexts
  const holidayPhotos = analyzedPhotos.filter(p => p.holiday);
  const occasionPhotos = analyzedPhotos.filter(p => p.occasion && !p.holiday);

  // Then group remaining photos by location
  const remainingPhotos = analyzedPhotos.filter(p => !p.holiday && !p.occasion);

  // Log the grouping decisions for debugging
  console.log(`Grouping photos by context: ${analyzedPhotos.length} total photos`);
  console.log(`- ${holidayPhotos.length} holiday photos`);
  console.log(`- ${occasionPhotos.length} occasion photos`);
  console.log(`- ${remainingPhotos.length} location-based photos`);

  // Process holiday-based groups
  holidayPhotos.forEach(photo => {
    const holiday = photo.holiday?.toLowerCase() || 'unknown';
    if (!groups[`holiday-${holiday}`]) {
      groups[`holiday-${holiday}`] = [];
    }
    groups[`holiday-${holiday}`].push(photo);
  });

  // Process occasion-based groups
  occasionPhotos.forEach(photo => {
    const occasion = photo.occasion?.toLowerCase() || 'unknown';
    if (!groups[`occasion-${occasion}`]) {
      groups[`occasion-${occasion}`] = [];
    }
    groups[`occasion-${occasion}`].push(photo);
  });

  // Process location-based groups for remaining photos
  remainingPhotos.forEach(photo => {
    const location = photo.location.toLowerCase();
    if (!groups[`location-${location}`]) {
      groups[`location-${location}`] = [];
    }
    groups[`location-${location}`].push(photo);
  });

  // Convert to themed groups with rich naming
  const themes: Theme[] = [];

  for (const [groupKey, photos] of Object.entries(groups)) {
    // Generate theme name based on context hierarchy
    let themeName = "";
    let contextualDescription = "";
    let mainLocation = "";
    let mainActivity = "";
    let holiday = undefined;
    let occasion = undefined;

    // Determine main location and activity
    const locations = photos.map(p => p.location.toLowerCase());
    const activities = photos.map(p => p.activity.toLowerCase());
    mainLocation = findMostCommon(locations);
    mainActivity = findMostCommon(activities);

    // Determine if there's a consistent holiday
    const holidays = photos.map(p => p.holiday?.toLowerCase()).filter(Boolean) as string[];
    if (holidays.length > 0) {
      holiday = findMostCommon(holidays);
    }

    // Determine if there's a consistent occasion
    const occasions = photos.map(p => p.occasion?.toLowerCase()).filter(Boolean) as string[];
    if (occasions.length > 0) {
      occasion = findMostCommon(occasions);
    }

    // Determine if there's consistent mood/atmosphere
    const moods = photos.map(p => p.mood?.toLowerCase()).filter(Boolean) as string[];
    const commonMood = moods.length > 0 ? findMostCommon(moods) : null;

    // Determine if there are consistent outfits
    const outfits = photos.map(p => p.outfit?.toLowerCase()).filter(Boolean) as string[];
    const commonOutfit = outfits.length > 0 ? findMostCommon(outfits) : null;

    // Log theme generation decisions for debugging
    console.log(`\nGenerating theme for ${groupKey} with ${photos.length} photos:`);
    console.log(`- Location: ${mainLocation}`);
    console.log(`- Activity: ${mainActivity}`);
    if (holiday) console.log(`- Holiday: ${holiday}`);
    if (occasion) console.log(`- Occasion: ${occasion}`);
    if (commonMood) console.log(`- Mood: ${commonMood}`);
    if (commonOutfit) console.log(`- Outfit: ${commonOutfit}`);

    // Generate rich theme name based on context
    if (groupKey.startsWith('holiday-')) {
      const holidayName = capitalizeFirstLetter(holiday || 'Holiday');
      themeName = `${holidayName} Celebration`;
      contextualDescription = `${holidayName} celebration${commonOutfit ? ' with ' + commonOutfit : ''}`;
      console.log(`→ Created holiday theme: "${themeName}"`);
    }
    else if (groupKey.startsWith('occasion-')) {
      const occasionName = capitalizeFirstLetter(occasion || 'Special Occasion');
      themeName = `${occasionName} Event`;
      contextualDescription = `${occasionName} celebration${commonOutfit ? ' with ' + commonOutfit : ''}`;
      console.log(`→ Created occasion theme: "${themeName}"`);
    }
    else {
      // Location-based theme with enrichment
      switch (mainLocation) {
        case "home":
        case "house":
        case "living room":
        case "apartment":
          themeName = "Home Sweet Home";
          break;
        case "park":
        case "garden":
        case "backyard":
          themeName = "Outdoor Adventure";
          break;
        case "beach":
        case "ocean":
        case "sea":
          themeName = "Beach Day";
          break;
        default:
          themeName = `${capitalizeFirstLetter(mainLocation)} Adventure`;
      }

      // Enhance with mood/atmosphere if available
      if (commonMood) {
        contextualDescription = `A ${commonMood} time at the ${mainLocation}`;
      } else {
        contextualDescription = `Time spent at the ${mainLocation}`;
      }
      console.log(`→ Created location theme: "${themeName}"`);
    }

    themes.push({
      id: generateThemeId(themeName),
      name: themeName,
      location: mainLocation,
      mainActivity: mainActivity,
      context: contextualDescription,
      holiday: holiday,
      occasion: occasion,
      photos: photos
    });
  }

  console.log(`\nGenerated ${themes.length} unique themes from ${analyzedPhotos.length} photos`);
  return themes;
};

// Helper functions
function findMostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  let maxCount = 0;
  let mostCommon = arr[0] || 'unknown';

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