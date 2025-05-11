import { generateStoryWithFallback, editStoryStyleWithFallback } from '@/lib/services/openai-service';

interface StoryPage {
  text: string;
}

interface Story {
  title: string;
  pages: StoryPage[];
}

interface Theme {
  id: string;
  name: string;
  location: string;
  mainActivity: string;
  photos: any[];
}

interface PetInfo {
  name: string;
  type?: string;
}

interface OwnerInfo {
  name?: string;
}

/**
 * Generate a storybook narrative based on grouped photos and their analysis
 */
export const generateStory = async (theme: Theme, petInfo: PetInfo, ownerInfo: OwnerInfo): Promise<Story> => {
  try {
    // Prepare the context for the story
    const photoDescriptions = theme.photos.map((photo, index) => {
      return `Photo ${index + 1}: ${photo.petType} ${photo.petBreed || ''} ${photo.activity} at ${photo.location}. People present: ${photo.people || 'none'}. Objects: ${photo.objects || 'none'}.`;
    }).join('\n');

    const prompt = `
      Write a children's storybook narrative about a pet's adventure.
      
      Pet info:
      - Name: ${petInfo.name}
      - Type: ${petInfo.type || theme.photos[0].petType}
      
      Owner info:
      - Name: ${ownerInfo.name || 'the owner'}
      
      Theme: ${theme.name}
      Location: ${theme.location}
      Main activity: ${theme.mainActivity}
      
      Photo descriptions:
      ${photoDescriptions}
      
      Create a storybook with:
      1. A title in the format "[Pet Name]'s [Adventure Type]" (e.g., "Luka's Apple Orchard Adventure")
      2. One page of narrative text per photo (about 1-2 short sentences each, suitable for a children's book)
      3. A brief conclusion
      
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

    return await generateStoryWithFallback(prompt);

  } catch (error) {
    console.error("Error generating story:", error);

    // Return a basic fallback story
    return {
      title: `${petInfo.name}'s Adventure`,
      pages: [
        { text: `${petInfo.name} is having a wonderful day.` },
        { text: `${petInfo.name} explores and has fun.` },
        { text: `${petInfo.name} returns home happy.` }
      ]
    };
  }
};

/**
 * Stylize a story description or edit an existing story
 */
export const editStoryStyle = async (storyText: string, style: string): Promise<string> => {
  try {
    return await editStoryStyleWithFallback(storyText, style);
  } catch (error) {
    console.error("Error editing story style:", error);
    return storyText; // Return original text if editing fails
  }
};

export default {
  generateStory,
  editStoryStyle
};