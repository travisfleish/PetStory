'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function AnalysisPage() {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [analyzedPhotos, setAnalyzedPhotos] = useState([]);

  useEffect(() => {
    // Check if we have session data
    const sessionId = sessionStorage.getItem('petTales_sessionId');
    const photosJson = sessionStorage.getItem('petTales_photos');

    if (!sessionId || !photosJson) {
      router.push('/upload');
      return;
    }

    const photos = JSON.parse(photosJson);

    // Start analysis with progress simulation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 5;
      });
    }, 1000);

    // Analyze the photos
    analyzePhotos(photos)
      .then(() => {
        clearInterval(progressInterval);
        setProgress(100);
        setIsAnalyzing(false);
      })
      .catch(err => {
        clearInterval(progressInterval);
        console.error('Analysis error:', err);
        setError('Failed to analyze photos. Please try again.');
        setIsAnalyzing(false);
      });

    return () => clearInterval(progressInterval);
  }, [router]);

  const analyzePhotos = async (photos) => {
    try {
      const response = await axios.post('/api/analyze-photos', { photos });

      if (response.data.success) {
        // Store analyzed photos and themes in session storage
        sessionStorage.setItem('petTales_analyzedPhotos', JSON.stringify(response.data.analyzedPhotos));
        sessionStorage.setItem('petTales_themes', JSON.stringify(response.data.themes));

        setThemes(response.data.themes);
        setAnalyzedPhotos(response.data.analyzedPhotos);

        // Auto-select the first theme if available
        if (response.data.themes.length > 0) {
          setSelectedTheme(response.data.themes[0]);
        }
      } else {
        throw new Error(response.data.error || 'Failed to analyze photos');
      }
    } catch (error) {
      console.error('Error analyzing photos:', error);
      throw error;
    }
  };

  const handleThemeSelect = (theme) => {
    setSelectedTheme(theme);
  };

  const handleContinue = () => {
    if (!selectedTheme) {
      setError('Please select a theme to continue');
      return;
    }

    // Store selected theme in session storage
    sessionStorage.setItem('petTales_selectedTheme', JSON.stringify(selectedTheme));

    // Navigate to story generation page
    router.push('/story-editor');
  };

  // Helper function to display rich theme details
  const renderThemeDetails = (theme) => {
    const details = [];

    // Show location & activity
    details.push(`Location: ${theme.location}, Activity: ${theme.mainActivity}`);

    // Add holiday if present
    if (theme.holiday) {
      details.push(`Holiday: ${theme.holiday}`);
    }

    // Add occasion if present
    if (theme.occasion) {
      details.push(`Occasion: ${theme.occasion}`);
    }

    // Add context description if present
    if (theme.context) {
      details.push(theme.context);
    }

    return details.join(' • ');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-4">Analyzing Your Pet Photos</h1>

      {isAnalyzing ? (
        <div className="max-w-md mx-auto text-center">
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-600">{progress}% complete</p>
          </div>

          <p className="text-gray-700">
            Our AI is analyzing your pet photos and identifying themes...
          </p>

          <div className="mt-8 flex flex-col items-center space-y-4">
            <div className="animate-pulse w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              Discovering rich contexts like holidays, special occasions, and creating a storybook...
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {error ? (
            <div className="text-center p-8 bg-red-50 rounded-lg">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => router.push('/upload')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-6">We found these themes in your photos:</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {themes.map(theme => (
                  <div
                    key={theme.id}
                    onClick={() => handleThemeSelect(theme)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md
                      ${selectedTheme?.id === theme.id 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-50' 
                        : 'border-gray-200'}`}
                  >
                    <h3 className="text-lg font-medium mb-2">{theme.name}</h3>

                    {/* Enhanced theme details display */}
                    <p className="text-gray-600 text-sm mb-3">
                      {renderThemeDetails(theme)}
                    </p>

                    <div className="flex overflow-x-auto space-x-2 py-2">
                      {theme.photos.slice(0, 3).map((photo, index) => (
                        <div key={index} className="flex-shrink-0 w-20 h-20 relative rounded-md overflow-hidden">
                          <img
                            src={photo.originalImage}
                            alt={`Theme photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {theme.photos.length > 3 && (
                        <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center">
                          <span className="text-gray-500 font-medium">+{theme.photos.length - 3}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {themes.length === 0 && (
                  <div className="col-span-2 text-center p-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">No themes detected. Please try uploading different photos.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => router.push('/upload')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Back to Upload
                </button>
                <button
                  onClick={handleContinue}
                  disabled={!selectedTheme}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue with {selectedTheme?.name || 'Selected Theme'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}