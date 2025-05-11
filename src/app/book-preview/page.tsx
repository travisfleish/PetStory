'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function BookPreviewPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [story, setStory] = useState(null);
  const [images, setImages] = useState([]);
  const [stylizedImages, setStylizedImages] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('original');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    // Load data from session storage
    const storyJson = sessionStorage.getItem('petTales_story');
    const themeJson = sessionStorage.getItem('petTales_selectedTheme');

    if (!storyJson || !themeJson) {
      router.push('/upload');
      return;
    }

    const loadedStory = JSON.parse(storyJson);
    const loadedTheme = JSON.parse(themeJson);

    setStory(loadedStory);

    // Use original images from the theme
    if (loadedTheme && loadedTheme.photos) {
      const originalImages = loadedTheme.photos.map(photo => photo.originalImage);
      setImages(originalImages);
    }

    setIsLoading(false);
  }, [router]);

  const handleStyleChange = async (style) => {
    if (style === 'original') {
      setSelectedStyle('original');
      return;
    }

    setSelectedStyle(style);
    setIsLoading(true);

    // Only make the API call if we haven't already generated this style
    if (stylizedImages[style]) {
      setIsLoading(false);
      return;
    }

    try {
      const petInfoJson = sessionStorage.getItem('petTales_petInfo');
      const petInfo = petInfoJson ? JSON.parse(petInfoJson) : {};

      const imageRequests = images.map((image, index) => ({
        id: `image-${index}`,
        base64: image
      }));

      const response = await axios.post('/api/stylize-images', {
        images: imageRequests,
        style: style,
        petInfo: petInfo
      });

      if (response.data.success) {
        const newStylizedImages = { ...stylizedImages };
        newStylizedImages[style] = response.data.stylizedImages.map(img => img.stylizedImage);
        setStylizedImages(newStylizedImages);
      } else {
        throw new Error(response.data.error || 'Failed to stylize images');
      }
    } catch (error) {
      console.error('Error stylizing images:', error);
      setError('Failed to stylize images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    setError('');

    try {
      const selectedImages = selectedStyle === 'original' ? images : stylizedImages[selectedStyle];

      const response = await axios.post('/api/generate-pdf', {
        story: story,
        images: selectedImages
      }, {
        responseType: 'blob'
      });

      // Create a URL for the blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setPdfUrl(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${story.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedStyle === 'cartoon'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cartoon Style
              </button>
              <button
                onClick={() => handleStyleChange('watercolor')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedStyle === 'watercolor'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Watercolor
              </button>
              <button
                onClick={() => handleStyleChange('ghibli')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedStyle === 'ghibli'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Ghibli Style
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {story?.pages.map((page, index) => {
              const displayImage = selectedStyle === 'original'
                ? images[index]
                : (stylizedImages[selectedStyle] && stylizedImages[selectedStyle][index]);

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
                      <p className="text-gray-500">Image not available</p>
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
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Back to Editor
            </button>

            <button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isGeneratingPdf ? 'Generating PDF...' : 'Generate PDF'}
            </button>

            {pdfUrl && (
              <button
                onClick={handleDownloadPdf}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Download PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}