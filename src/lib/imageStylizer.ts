import { stylizeImageWithFallback } from '@/lib/services/openai-service';

/**
 * Style options for the pet illustrations
 */
export const STYLE_OPTIONS = {
  CARTOON: 'cartoon',
  WATERCOLOR: 'watercolor',
  GHIBLI: 'ghibli',
  FLAT_ILLUSTRATION: 'flat-illustration'
};

interface PetInfo {
  name?: string;
  type?: string;
}

/**
 * Stylize a pet photo using AI
 */
export const stylizeImage = async (imageBase64: string, style: string, petInfo: PetInfo = {}): Promise<string> => {
  try {
    // Create appropriate prompt based on style
    let prompt: string;

    switch (style) {
      case STYLE_OPTIONS.CARTOON:
        prompt = `Transform this pet photo into a cute cartoon children's book illustration. Style of Disney or Pixar animation. Keep the pet's expression and position the same.`;
        break;
      case STYLE_OPTIONS.WATERCOLOR:
        prompt = `Transform this pet photo into a soft watercolor children's book illustration with gentle colors and outlines. Keep the pet's position and expression the same.`;
        break;
      case STYLE_OPTIONS.GHIBLI:
        prompt = `Transform this pet photo into a Studio Ghibli style illustration, as if from "My Neighbor Totoro" or "Kiki's Delivery Service". Keep the pet's position and expression the same.`;
        break;
      case STYLE_OPTIONS.FLAT_ILLUSTRATION:
        prompt = `Transform this pet photo into a modern, flat vector-style illustration with simple shapes and bright colors. Keep the pet's position and expression the same.`;
        break;
      default:
        prompt = `Transform this pet photo into a cute children's book illustration. Keep the pet's position and expression the same.`;
    }

    // Add pet info to prompt if available
    if (petInfo.name || petInfo.type) {
      prompt += ` The ${petInfo.type || 'pet'} ${petInfo.name ? `named ${petInfo.name}` : ''} should be the main focus.`;
    }

    return await stylizeImageWithFallback(imageBase64, style, prompt);

  } catch (error) {
    console.error("Error stylizing image:", error);
    throw new Error(`Failed to stylize image: ${error.message}`);
  }
};

export default {
  stylizeImage,
  STYLE_OPTIONS
};