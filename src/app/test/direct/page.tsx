'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DirectTestPage() {
  const [originalImage, setOriginalImage] = useState(null);
  const [compressedImage, setCompressedImage] = useState(null);
  const [stylizedImage, setStylizedImage] = useState(null);
  const [isStylizing, setIsStylizing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [style, setStyle] = useState('cartoon');
  const [compressionSettings, setCompressionSettings] = useState({
    maxWidth: 1024,
    quality: 0.7
  });

  useEffect(() => {
    // Check session storage for the first image from theme
    const themeJson = sessionStorage.getItem('petTales_selectedTheme');

    if (themeJson) {
      try {
        const theme = JSON.parse(themeJson);
        if (theme.photos && theme.photos.length > 0) {
          setOriginalImage(theme.photos[0].originalImage);
          addLog(`Loaded image from session storage, length: ${theme.photos[0].originalImage.length}`);

          // Auto-compress on load
          compressImage(theme.photos[0].originalImage, compressionSettings.maxWidth, compressionSettings.quality);
        }
      } catch (err) {
        console.error('Error loading image from session:', err);
      }
    }
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message); // Also log to console for easier debugging
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setOriginalImage(result);
      addLog(`Loaded image from file: ${file.name}, size: ${(file.size / 1024).toFixed(2)} KB`);

      // Auto-compress when new file is selected
      compressImage(result, compressionSettings.maxWidth, compressionSettings.quality);
    };
    reader.readAsDataURL(file);
  };

  const compressImage = async (dataUrl, maxWidth = 1024, quality = 0.7) => {
    if (!dataUrl) return;

    setIsCompressing(true);
    addLog(`Starting image compression: maxWidth=${maxWidth}, quality=${quality}`);

    try {
      const img = new Image();

      // Create a promise to handle the image loading
      const imageLoaded = new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      // Set the image source to trigger loading
      img.src = dataUrl;

      // Wait for the image to load
      await imageLoaded;

      // Create a canvas element to resize the image
      const canvas = document.createElement('canvas');

      // Calculate new dimensions while maintaining aspect ratio
      const width = Math.min(maxWidth, img.width);
      const height = (img.height * width) / img.width;

      canvas.width = width;
      canvas.height = height;

      // Draw the image with new dimensions
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Get the compressed image as a data URL
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      // Update state with the compressed image
      setCompressedImage(compressedDataUrl);

      // Log the compression results
      const originalSize = dataUrl.length;
      const compressedSize = compressedDataUrl.length;
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

      addLog(`Compression complete:
        - Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB
        - Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB
        - Reduction: ${compressionRatio}%
        - Dimensions: ${width}x${height}
      `);
    } catch (err) {
      console.error('Error compressing image:', err);
      addLog(`Error compressing image: ${err.message}`);
      setError(`Image compression failed: ${err.message}`);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCompressionChange = (type: 'quality' | 'maxWidth', value: number) => {
    setCompressionSettings(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const handleRecompress = () => {
    if (!originalImage) return;
    compressImage(originalImage, compressionSettings.maxWidth, compressionSettings.quality);
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStyle(e.target.value);
  };

  const handleStylize = async () => {
    if (!compressedImage) {
      setError('Please wait for image compression to complete');
      return;
    }

    setIsStylizing(true);
    setStylizedImage(null);
    setError('');
    addLog(`Starting stylization with style: ${style}`);

    try {
      // Get pet info from session if available
      const petInfoJson = sessionStorage.getItem('petTales_petInfo');
      const petInfo = petInfoJson ? JSON.parse(petInfoJson) : { name: 'pet', type: 'animal' };

      addLog(`Using pet info: ${JSON.stringify(petInfo)}`);
      addLog(`Sending compressed image: ${(compressedImage.length / 1024 / 1024).toFixed(2)} MB`);

      const response = await axios.post('/api/stylize-images', {
        images: [
          {
            id: 'test-image',
            base64: compressedImage
          }
        ],
        style,
        petInfo
      }, {
        timeout: 120000, // 2 minute timeout to handle long processing
        headers: { 'Content-Type': 'application/json' }
      });

      addLog(`Received API response, status: ${response.status}`);

      if (response.data.success && response.data.stylizedImages?.[0]?.stylizedImage) {
        const stylized = response.data.stylizedImages[0].stylizedImage;
        setStylizedImage(stylized);
        addLog(`Stylization successful, image length: ${stylized.length} chars`);
      } else {
        throw new Error(response.data.error || 'No stylized image in response');
      }
    } catch (err) {
      console.error('Error during stylization:', err);
      setError(`Stylization failed: ${err.message}`);
      addLog(`ERROR: ${err.message}`);

      if (err.response) {
        addLog(`Status: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
      }
    } finally {
      setIsStylizing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Direct Stylization Test</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-medium mb-3">Original Image</h2>

          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mb-2"
            />
          </div>

          <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-md overflow-hidden mb-4">
            {originalImage ? (
              <img
                src={originalImage}
                alt="Original"
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-gray-500">No image selected</p>
            )}
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Compression Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1">Max Width: {compressionSettings.maxWidth}px</label>
                <input
                  type="range"
                  min="256"
                  max="2048"
                  step="64"
                  value={compressionSettings.maxWidth}
                  onChange={(e) => handleCompressionChange('maxWidth', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Quality: {compressionSettings.quality}</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={compressionSettings.quality}
                  onChange={(e) => handleCompressionChange('quality', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            <button
              onClick={handleRecompress}
              disabled={!originalImage || isCompressing}
              className="mt-2 px-4 py-1 bg-gray-200 text-gray-800 rounded-md text-sm hover:bg-gray-300 disabled:opacity-50"
            >
              {isCompressing ? 'Compressing...' : 'Recompress Image'}
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Style</label>
            <select
              value={style}
              onChange={handleStyleChange}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="cartoon">Cartoon</option>
              <option value="watercolor">Watercolor</option>
              <option value="ghibli">Ghibli</option>
              <option value="flat-illustration">Flat Illustration</option>
            </select>
          </div>

          <button
            onClick={handleStylize}
            disabled={!compressedImage || isStylizing || isCompressing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isStylizing ? 'Stylizing...' : 'Stylize Image'}
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-medium mb-3">Stylized Result</h2>

          <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-md overflow-hidden mb-4">
            {isStylizing ? (
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                <p className="text-gray-600">Generating image...</p>
              </div>
            ) : isCompressing ? (
              <div className="flex flex-col items-center justify-center">
                <div className="animate-pulse w-10 h-10 bg-blue-300 rounded-full mb-2"></div>
                <p className="text-gray-600">Compressing image...</p>
              </div>
            ) : stylizedImage ? (
              <img
                src={stylizedImage}
                alt="Stylized"
                className="w-full h-full object-contain"
              />
            ) : compressedImage ? (
              <div className="flex flex-col items-center justify-center">
                <img
                  src={compressedImage}
                  alt="Compressed"
                  className="w-full h-full object-contain opacity-50"
                />
                <p className="text-gray-600 absolute">Ready for stylization</p>
              </div>
            ) : (
              <p className="text-gray-500">No image processed yet</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Log:</h3>
            <div className="bg-gray-100 p-3 rounded-md h-60 overflow-auto text-xs">
              {logs.length > 0 ? logs.map((log, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap">{log}</div>
              )) : (
                <p className="text-gray-500">No logs yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-medium mb-3">Data Analysis</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Original Image Info:</h3>
            <div className="bg-gray-100 p-2 rounded-md text-xs h-24 overflow-auto">
              {originalImage ? (
                <>
                  <div>Length: {originalImage.length} chars</div>
                  <div>Size: ~{(originalImage.length / 1024 / 1024).toFixed(2)} MB</div>
                  <div>Format: {originalImage.substring(0, 30)}...</div>
                  <div>Is data URL: {originalImage.includes('data:') ? 'Yes' : 'No'}</div>
                </>
              ) : (
                <p>No image loaded</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">Compressed Image Info:</h3>
            <div className="bg-gray-100 p-2 rounded-md text-xs h-24 overflow-auto">
              {compressedImage ? (
                <>
                  <div>Length: {compressedImage.length} chars</div>
                  <div>Size: ~{(compressedImage.length / 1024 / 1024).toFixed(2)} MB</div>
                  <div>Format: {compressedImage.substring(0, 30)}...</div>
                  <div>Is data URL: {compressedImage.includes('data:') ? 'Yes' : 'No'}</div>
                  {originalImage && (
                    <div>Compression Ratio: {((1 - compressedImage.length / originalImage.length) * 100).toFixed(2)}%</div>
                  )}
                </>
              ) : (
                <p>No compressed image yet</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">Stylized Image Info:</h3>
            <div className="bg-gray-100 p-2 rounded-md text-xs h-24 overflow-auto">
              {stylizedImage ? (
                <>
                  <div>Length: {stylizedImage.length} chars</div>
                  <div>Size: ~{(stylizedImage.length / 1024 / 1024).toFixed(2)} MB</div>
                  <div>Format: {stylizedImage.substring(0, 30)}...</div>
                  <div>Is data URL: {stylizedImage.includes('data:') ? 'Yes' : 'No'}</div>
                </>
              ) : (
                <p>No stylized image yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}