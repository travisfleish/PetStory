'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function StoryEditorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const [story, setStory] = useState(null);
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState([]);

  const [theme, setTheme] = useState(null);
  const [petInfo, setPetInfo] = useState({});
  const [ownerInfo, setOwnerInfo] = useState({});

  useEffect(() => {
    // Load data from session storage
    const themeJson = sessionStorage.getItem('petTales_selectedTheme');
    const petInfoJson = sessionStorage.getItem('petTales_petInfo');
    const ownerInfoJson = sessionStorage.getItem('petTales_ownerInfo');

    if (!themeJson || !petInfoJson) {
      router.push('/upload');
      return;
    }

    const loadedTheme = JSON.parse(themeJson);
    const loadedPetInfo = JSON.parse(petInfoJson);
    const loadedOwnerInfo = ownerInfoJson ? JSON.parse(ownerInfoJson) : {};

    setTheme(loadedTheme);
    setPetInfo(loadedPetInfo);
    setOwnerInfo(loadedOwnerInfo);

    // Check if we already have a generated story
    const storyJson = sessionStorage.getItem('petTales_story');

    if (storyJson) {
      // Use cached story
      const loadedStory = JSON.parse(storyJson);
      setStory(loadedStory);
      setTitle(loadedStory.title);
      setPages(loadedStory.pages);
      setIsLoading(false);
    } else {
      // Generate a new story
      generateStory(loadedTheme, loadedPetInfo, loadedOwnerInfo);
    }
  }, [router]);

  const generateStory = async (theme, petInfo, ownerInfo) => {
    setIsGenerating(true);
    setError('');

    try {
      const response = await axios.post('/api/generate-story', {
        theme,
        petInfo,
        ownerInfo
      });

      if (response.data.success) {
        const generatedStory = response.data.story;

        setStory(generatedStory);
        setTitle(generatedStory.title);
        setPages(generatedStory.pages);

        // Cache the story in session storage
        sessionStorage.setItem('petTales_story', JSON.stringify(generatedStory));
      } else {
        throw new Error(response.data.error || 'Failed to generate story');
      }
    } catch (error) {
      console.error('Error generating story:', error);
      setError('Failed to generate story. Please try again.');
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const handleTitleChange = (e) => {
    setTitle(e.target.value);

    // Update story object
    const updatedStory = { ...story, title: e.target.value };
    setStory(updatedStory);

    // Update in session storage
    sessionStorage.setItem('petTales_story', JSON.stringify(updatedStory));
  };

  const handlePageTextChange = (index, newText) => {
    const updatedPages = [...pages];
    updatedPages[index] = { ...updatedPages[index], text: newText };
    setPages(updatedPages);

    // Update story object
    const updatedStory = { ...story, pages: updatedPages };
    setStory(updatedStory);

    // Update in session storage
    sessionStorage.setItem('petTales_story', JSON.stringify(updatedStory));
  };

  const handleRegenerateStory = () => {
    if (theme && petInfo) {
      generateStory(theme, petInfo, ownerInfo);
    }
  };

  const handleContinue = () => {
    // Make sure we have a complete story
    if (!title || pages.some(page => !page.text)) {
      setError('Please complete all pages before continuing');
      return;
    }

    // Store the final story
    const finalStory = { title, pages };
    sessionStorage.setItem('petTales_story', JSON.stringify(finalStory));

    // Navigate to style selector
    router.push('/book-preview');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">
            {isGenerating ? 'Creating your pet story...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Edit Your Pet Story</h1>

      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="storyTitle" className="block text-lg font-medium text-gray-700 mb-2">
            Story Title
          </label>
          <input
            type="text"
            id="storyTitle"
            value={title}
            onChange={handleTitleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            placeholder="Your pet's adventure title"
          />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-700 mb-4">Story Pages</h2>

          {pages.map((page, index) => (
            <div key={index} className="mb-6 p-4 border border-gray-200 rounded-md">
              <div className="flex items-center mb-2">
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                  Page {index + 1}
                </span>
              </div>

              {theme?.photos[index] && (
                <div className="mb-3 max-w-xs mx-auto">
                  <img
                    src={theme.photos[index].originalImage}
                    alt={`Page ${index + 1} preview`}
                    className="w-full h-auto rounded-md"
                  />
                </div>
              )}

              <textarea
                value={page.text}
                onChange={(e) => handlePageTextChange(index, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                placeholder={`Page ${index + 1} text...`}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={handleRegenerateStory}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Regenerate Story
          </button>

          <button
            onClick={() => router.push('/analysis')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Back to Themes
          </button>

          <button
            onClick={handleContinue}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Create Book
          </button>
        </div>
      </div>
    </div>
  );
}