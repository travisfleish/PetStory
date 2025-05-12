'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function BookPreviewPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isStylizing, setIsStylizing] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  const [story, setStory] = useState(null);
  const [originalImages, setOriginalImages] = useState([]);
  const [stylizedImages, setStylizedImages] = useState({});
  const [selectedStyle, setSelectedStyle] = useState('original');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  // Toggle debug mode with key combination: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowDebug(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    // Load data from session storage
    const storyJson = sessionStorage.getItem('petTales_story');
    const themeJson = sessionStorage.getItem('petTales_selectedTheme');

    if (!storyJson || !themeJson) {
      router.push('/upload');
      return;
    }

    try {
      const loadedStory = JSON.parse(storyJson);
      const loadedTheme = JSON.parse(themeJson);

      setStory(loadedStory);

      // Use original images from the theme
      if (loadedTheme && loadedTheme.photos && loadedTheme.photos.length > 0) {
        const photos = loadedTheme.photos.map(photo => ({
          id: photo.id,
          originalImage: photo.originalImage
        }));
        setOriginalImages(photos);
        console.log(`Loaded ${photos.length} original images from theme`);
      } else {
        console.warn('No photos found in theme');
      }
    } catch (err) {
      console.error('Error parsing session data:', err);
      setError('Error loading story data. Please try again.');
    }

    setIsLoading(false);
  }, [router]);

  const handleStyleChange = async (style) => {
    if (style === 'original') {
      setSelectedStyle('original');
      return;
    }

    setSelectedStyle(style);
    setIsStylizing(true);
    setError('');
    setDebugInfo(null);

    // Only make the API call if we haven't already generated this style
    if (stylizedImages[style] && stylizedImages[style].length > 0) {
      console.log(`Using cached ${style} images`);
      setIsStylizing(false);
      return;
    }

    try {
      console.log(`Starting stylization for style: ${style}`);
      const petInfoJson = sessionStorage.getItem('petTales_petInfo');
      const petInfo = petInfoJson ? JSON.parse(petInfoJson) : {};

      // Prepare image data for API request - use the original images directly
      const imageRequests = originalImages.map(img => ({
        id: img.id || `img-${Math.random().toString(36).substr(2, 9)}`,
        base64: img.originalImage
      }));

      console.log(`Sending ${imageRequests.length} images for stylization in ${style} style`);

      // Call the API
      const response = await axios.post('/api/stylize-images', {
        images: imageRequests,
        style: style,
        petInfo: petInfo
      });

      console.log(`Received API response: status=${response.status}, success=${response.data.success}`);

      if (response.data.success) {
        // Store the stylized images
        const newStyleImages = response.data.stylizedImages;
        console.log(`Received ${newStyleImages.length} stylized images`);

        // Log example of first image for debugging
        if (newStyleImages.length > 0) {
          const firstImage = newStyleImages[0];
          console.log(`First stylized image: id=${firstImage.id}, hasStylized=${!!firstImage.stylizedImage}`);
          if (firstImage.stylizedImage) {
            console.log(`Image starts with: ${firstImage.stylizedImage.substring(0, 30)}...`);
          }
        }

        // Update state with the new stylized images
        setStylizedImages(prev => ({
          ...prev,
          [style]: newStyleImages.map(img => ({
            id: img.id,
            stylizedImage: img.stylizedImage
          }))
        }));

        // Set debug info
        setDebugInfo({
          style,
          originalCount: originalImages.length,
          requestSent: imageRequests.length,
          responsesReceived: newStyleImages.length,
          successfulStyled: newStyleImages.filter(img => img.stylizedImage).length
        });
      } else {
        throw new Error(response.data.error || 'API returned unsuccessful response');
      }
    } catch (error) {
      console.error('Error stylizing images:', error);
      setError(`Failed to stylize images: ${error.message}`);
      setDebugInfo({
        error: error.message,
        response: error.response?.data
      });
    } finally {
      setIsStylizing(false);
    }
  };

  const getDisplayImage = (index) => {
    if (selectedStyle === 'original') {
      return originalImages[index]?.originalImage || null;
    } else {
      // Find the stylized image for this index
      const styleImages = stylizedImages[selectedStyle] || [];
      const image = styleImages.find(img => img.id === originalImages[index]?.id);
      return image?.stylizedImage || null;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Preparing your storybook...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Your Pet Storybook</h1>

      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Debug info section */}
        {showDebug && (
          <div className="mb-6 p-4 bg-gray-100 rounded-md">
            <h3 className="font-bold mb-2">Debug Information:</h3>
            <div className="text-sm mb-2">
              <p>Selected Style: {selectedStyle}</p>
              <p>Original Images: {originalImages.length}</p>
              <p>Available Styled Types: {Object.keys(stylizedImages).join(', ') || 'none'}</p>
              {selectedStyle !== 'original' && stylizedImages[selectedStyle] && (
                <p>Current Style Images: {stylizedImages[selectedStyle].length || 0}</p>
              )}
            </div>
            {debugInfo && (
              <pre className="text-xs bg-gray-200 p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-center">{story?.title}</h2>

          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Choose Style:</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleStyleChange('original')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedStyle === 'original'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Original Photos
              </button>
              <button
                onClick={() => handleStyleChange('cartoon')}
                disabled={isStylizing}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedStyle === 'cartoon'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${isStylizing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isStylizing && selectedStyle === 'cartoon' ? 'Generating...' : 'Cartoon Style'}
              </button>
              <button
                onClick={() => handleStyleChange('watercolor')}
                disabled={isStylizing}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedStyle === 'watercolor'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${isStylizing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isStylizing && selectedStyle === 'watercolor' ? 'Generating...' : 'Watercolor'}
              </button>
              <button
                onClick={() => handleStyleChange('ghibli')}
                disabled={isStylizing}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedStyle === 'ghibli'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${isStylizing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isStylizing && selectedStyle === 'ghibli' ? 'Generating...' : 'Ghibli Style'}
              </button>
            </div>
          </div>

          {isStylizing && (
            <div className="mb-6 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-600">Generating {selectedStyle} style images...</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {story?.pages.map((page, index) => {
              const displayImage = getDisplayImage(index);

              return (
                <div key={index} className="border rounded-lg overflow-hidden">
                  {displayImage ? (
                    <div className="aspect-video relative">
                      <img
                        src={displayImage}
                        alt={`Page ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <p className="text-gray-500">
                        {isStylizing ? 'Generating image...' : 'Image not available'}
                      </p>
                    </div>
                  )}

                  <div className="p-4">
                    <p className="text-gray-700">{page.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => router.push('/story-editor')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Back to Editor
            </button>
          </div>
        </div>

        {/* Debug toggle */}
        <div className="text-center mt-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-500 hover:underline"
          >
            {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
          <p className="text-xs text-gray-400 mt-1">Or press Ctrl+Shift+D</p>
        </div>
      </div>
    </div>
  );
}