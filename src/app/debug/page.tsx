'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function DebugPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState([]);
  const [analyzedPhotos, setAnalyzedPhotos] = useState([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    // Load photos from session storage
    const photosJson = sessionStorage.getItem('petTales_photos');
    const analyzedJson = sessionStorage.getItem('petTales_analyzedPhotos');

    if (!photosJson) {
      setError('No photos found. Please upload photos first.');
      setIsLoading(false);
      return;
    }

    try {
      const loadedPhotos = JSON.parse(photosJson);
      setPhotos(loadedPhotos);

      // Load previously analyzed photos if available
      if (analyzedJson) {
        setAnalyzedPhotos(JSON.parse(analyzedJson));
      }

      setIsLoading(false);
    } catch (err) {
      setError('Error loading photos: ' + err.message);
      setIsLoading(false);
    }
  }, []);

  const analyzeCurrentPhoto = async () => {
    if (selectedPhotoIndex < 0 || selectedPhotoIndex >= photos.length) {
      setError('Invalid photo selection');
      return;
    }

    const photo = photos[selectedPhotoIndex];
    setIsAnalyzing(true);

    try {
      const response = await axios.post('/api/analyze-photo', {
        photo: {
          id: photo.id,
          base64: photo.base64
        }
      });

      if (response.data.success) {
        // Update the analyzed photos array
        const newAnalyzedPhotos = [...analyzedPhotos];
        newAnalyzedPhotos[selectedPhotoIndex] = {
          ...response.data.analyzedPhoto,
          originalImage: photo.base64
        };

        setAnalyzedPhotos(newAnalyzedPhotos);
      } else {
        setError('Analysis failed: ' + response.data.error);
      }
    } catch (err) {
      setError('Error during analysis: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCurrentPhotoAnalysis = () => {
    if (analyzedPhotos.length <= selectedPhotoIndex || !analyzedPhotos[selectedPhotoIndex]) {
      return null;
    }
    return analyzedPhotos[selectedPhotoIndex];
  };

  const formatPrettyJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return 'Could not format JSON';
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AI Vision Analysis Debug</h1>
        <button
          onClick={() => router.push('/analysis')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          Back to Analysis
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {photos.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Photo selection and display */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Photo Selection</h2>

            {/* Navigation controls */}
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => setSelectedPhotoIndex(prev => Math.max(0, prev - 1))}
                disabled={selectedPhotoIndex === 0}
                className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Previous
              </button>

              <span className="text-sm">
                Photo {selectedPhotoIndex + 1} of {photos.length}
              </span>

              <button
                onClick={() => setSelectedPhotoIndex(prev => Math.min(photos.length - 1, prev + 1))}
                disabled={selectedPhotoIndex === photos.length - 1}
                className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Next
              </button>
            </div>

            {/* Current photo */}
            <div className="mb-4">
              <div className="aspect-square w-full relative overflow-hidden rounded-lg bg-gray-100">
                {photos[selectedPhotoIndex]?.base64 && (
                  <img
                    src={photos[selectedPhotoIndex].base64}
                    alt={`Photo ${selectedPhotoIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>

            {/* Analysis button */}
            <button
              onClick={analyzeCurrentPhoto}
              disabled={isAnalyzing}
              className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze This Photo'}
            </button>
          </div>

          {/* Analysis results */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">AI Vision Analysis Results</h2>

            {!getCurrentPhotoAnalysis() ? (
              <div className="text-center py-12 text-gray-500">
                <p>No analysis data available for this photo.</p>
                <p className="text-sm">Click "Analyze This Photo" to generate results.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Key fields */}
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(getCurrentPhotoAnalysis())
                    .filter(([key, value]) =>
                      typeof value !== 'object' &&
                      key !== 'id' &&
                      key !== 'originalImage' &&
                      key !== 'error'
                    )
                    .map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-2 rounded">
                        <div className="font-medium text-gray-700">{key}:</div>
                        <div className="text-gray-900">{String(value || 'Not detected')}</div>
                      </div>
                    ))
                  }
                </div>

                {/* Scene description */}
                {getCurrentPhotoAnalysis()?.sceneDescription && (
                  <div className="mt-4 bg-blue-50 p-3 rounded-md">
                    <h3 className="font-medium text-blue-800 mb-1">Scene Description:</h3>
                    <p className="text-gray-800 italic">
                      "{getCurrentPhotoAnalysis().sceneDescription}"
                    </p>
                  </div>
                )}

                {/* Raw JSON */}
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">Raw Analysis Data:</h3>
                  </div>
                  <div className="bg-gray-800 rounded-md overflow-hidden">
                    <pre className="p-4 text-gray-200 overflow-auto text-xs max-h-60">
                      {formatPrettyJson(getCurrentPhotoAnalysis())}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-lg">
          <p className="text-xl text-gray-600 mb-4">No photos available</p>
          <button
            onClick={() => router.push('/upload')}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Upload Photos
          </button>
        </div>
      )}
    </div>
  );
}