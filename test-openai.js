// test-openai.js
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
try {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    Object.entries(envConfig).forEach(([key, value]) => {
      process.env[key] = value;
    });
    console.log('✅ Loaded environment variables from .env.local');
  } else {
    console.warn('⚠️ No .env.local file found');
  }
} catch (error) {
  console.error('❌ Error loading .env.local:', error);
}

// Test function for text completion
async function testCompletion() {
  console.log('\n🔍 Testing Chat Completion API...');
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`📝 Using API key: ${process.env.OPENAI_API_KEY.substring(0, 7)}...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello, how are you?" }],
      max_tokens: 50
    });

    console.log('✅ Chat Completion API test successful!');
    console.log('📊 Response:', completion.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('❌ Chat Completion API test failed:', error.message);
    if (error.response) {
      console.error('📋 Error details:', error.response.data);
    }
    return false;
  }
}

// Test function for image generation (DALL-E)
async function testImageGeneration() {
  console.log('\n🔍 Testing Image Generation API...');
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: "A small cute puppy sitting in a garden",
      n: 1,
      size: "1024x1024",
      response_format: "url" // Use "b64_json" for base64 instead of URL
    });

    console.log('✅ Image Generation API test successful!');
    console.log('🖼️ Image URL:', response.data[0].url);
    return true;
  } catch (error) {
    console.error('❌ Image Generation API test failed:', error.message);
    if (error.response) {
      console.error('📋 Error details:', error.response.data);
    }
    return false;
  }
}

// Test function for vision API
async function testVisionAPI() {
  console.log('\n🔍 Testing Vision API...');
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Base64 string of a small 1x1 pixel transparent PNG for demonstration
    // In real usage, you would use actual image data
    const sampleImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==";

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image? (Note: This is a minimal test with a blank image)" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${sampleImageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 50
    });

    console.log('✅ Vision API test successful!');
    console.log('📊 Response:', response.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('❌ Vision API test failed:', error.message);
    if (error.response) {
      console.error('📋 Error details:', error.response.data);
    }
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting OpenAI API Tests...');
  console.log('==============================');

  // Check if API key exists
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is missing!');
    return;
  }

  console.log(`ℹ️ API Key format check: ${process.env.OPENAI_API_KEY.startsWith('sk-') ? 'Valid prefix' : 'Invalid prefix'}`);

  // Run all tests
  const completionSuccess = await testCompletion();
  const imageSuccess = await testImageGeneration();
  const visionSuccess = await testVisionAPI();

  console.log('\n📋 Test Results Summary:');
  console.log('==============================');
  console.log(`Chat Completion API: ${completionSuccess ? '✅ Passed' : '❌ Failed'}`);
  console.log(`Image Generation API: ${imageSuccess ? '✅ Passed' : '❌ Failed'}`);
  console.log(`Vision API: ${visionSuccess ? '✅ Passed' : '❌ Failed'}`);

  if (completionSuccess && imageSuccess && visionSuccess) {
    console.log('\n🎉 All tests passed! Your OpenAI API key is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the error messages above.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Unexpected error during tests:', error);
});