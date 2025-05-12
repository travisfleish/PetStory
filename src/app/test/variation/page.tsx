'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function VariationTestPage() {
  const [originalImage, setOriginalImage] = useState(null);
  const [stylizedImage, setStylizedImage] = useState(null);
  const [isStylizing, setIsStylizing] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [style, setStyle] = useState('cartoon');
  const [method, setMethod] = useState('');

  // Load image from file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read the file as data URL
    const reader = new FileReader();
    reader.onload = () => {
      setOriginalImage(reader.result);
      addLog(`Loaded image: ${file.name}, size: ${Math.round(file.size / 1024)}KB`);
    };
    reader.readAsDataURL(file);
  };

  // Log messages with timestamp
  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Handle stylizing with variation API
  const handleStylize = async () => {
    if (!originalImage) {
      setError('Please select an image first');
      return;
    }

    setIsStylizing(true);
    setStylizedImage(null);
    setError('');
    setMethod('');
    addLog(`Starting stylization with style: ${style}`);

    try {
      // Call the specialized variation endpoint
      const response = await axios.post('/api/stylize-with-variation', {
        image: {
          base64: originalImage
        },
        style,
        petInfo: {
          name: 'Buddy',
          type: 'dog'
        }
      });

      if (response.data.success) {
        setStylizedImage(response.data.stylizedImage);
        setMethod(response.data.method);
        addLog(`Stylization successful using method: ${response.data.method}`);
      } else {
        throw new Error(response.data.error || 'Stylization failed with unknown error');
      }
    } catch (err) {
      console.error('Stylization error:', err);
      setError(`Failed to stylize image: ${err.message}`);
      addLog(`ERROR: ${err.message}`);

      if (err.response?.data?.error) {
        addLog(`API error: ${err.response.data.error}`);
      }
    } finally {
      setIsStylizing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Image Variation Test</h1>

      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-md">
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
            <label className="block text-sm font-medium mb-1">Style</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="cartoon">Cartoon</option>
              <option value="watercolor">Watercolor</option>
              <option value="ghibli">Ghibli</option>
            </select>
          </div>

          <button
            onClick={handleStylize}
            disabled={!originalImage || isStylizing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isStylizing ? 'Stylizing...' : 'Stylize Image'}
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-medium mb-3">
            Stylized Result
            {method && <span className="text-sm font-normal ml-2 text-gray-500">({method})</span>}
          </h2>

          <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-md overflow-hidden mb-4">
            {isStylizing ? (
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                <p className="text-gray-600">Generating image...</p>
              </div>
            ) : stylizedImage ? (
              <img
                src={stylizedImage}
                alt="Stylized"
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-gray-500">No stylized image yet</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Log:</h3>
            <div className="bg-gray-100 p-3 rounded-md h-40 overflow-auto text-xs">
              {logs.length > 0 ? logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              )) : (
                <p className="text-gray-500">No logs yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}