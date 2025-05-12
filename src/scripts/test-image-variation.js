// src/scripts/test-image-variation.js

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable is not set');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKey
});

async function compressImage(inputPath, outputPath, maxWidth = 1024, quality = 80) {
  const Sharp = require('sharp');

  try {
    const image = Sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

    // Resize if larger than maxWidth
    if (metadata.width > maxWidth) {
      const aspectRatio = metadata.width / metadata.height;
      const newHeight = Math.round(maxWidth / aspectRatio);

      console.log(`Resizing to ${maxWidth}x${newHeight}`);

      await image
        .resize(maxWidth, newHeight)
        .jpeg({ quality: quality })
        .toFile(outputPath);

      const stats = fs.statSync(inputPath);
      const newStats = fs.statSync(outputPath);

      console.log(`Compression complete:
        - Original: ${(stats.size / 1024 / 1024).toFixed(2)} MB
        - Compressed: ${(newStats.size / 1024 / 1024).toFixed(2)} MB
        - Reduction: ${(100 - (newStats.size / stats.size * 100)).toFixed(2)}%
      `);

      return outputPath;
    } else {
      console.log('Image is already smaller than max width, copying as-is');
      fs.copyFileSync(inputPath, outputPath);
      return outputPath;
    }
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

async function testImageVariation(imagePath) {
  try {
    console.log(`Testing image variation with: ${imagePath}`);

    // Compress the image first
    const compressedPath = path.join(path.dirname(imagePath), 'compressed-' + path.basename(imagePath));
    await compressImage(imagePath, compressedPath);

    console.log('Creating image variation...');
    const response = await openai.images.createVariation({
      image: fs.createReadStream(compressedPath),
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json'
    });

    if (response.data && response.data[0] && response.data[0].b64_json) {
      console.log('Successfully created image variation!');

      // Save the result
      const outputPath = path.join(path.dirname(imagePath), 'variation-' + path.basename(imagePath));
      fs.writeFileSync(outputPath, Buffer.from(response.data[0].b64_json, 'base64'));

      console.log(`Saved result to: ${outputPath}`);
      return true;
    } else {
      console.error('API returned invalid response structure:', response);
      return false;
    }
  } catch (error) {
    console.error('Error creating image variation:', error);
    console.error('Error details:', error.response?.data || error.message);
    return false;
  }
}

// Run the test
if (process.argv.length < 3) {
  console.error('Usage: node test-image-variation.js <path-to-image>');
  process.exit(1);
}

const imagePath = process.argv[2];
if (!fs.existsSync(imagePath)) {
  console.error(`Error: Image file not found: ${imagePath}`);
  process.exit(1);
}

testImageVariation(imagePath)
  .then(success => {
    console.log(`Test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });