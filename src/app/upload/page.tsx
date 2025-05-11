'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoUploader from '@/components/PhotoUploader';
import { v4 as uuidv4 } from 'uuid';

interface Photo {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
  uploaded: boolean;
}

export default function UploadPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('dog');
  const [ownerName, setOwnerName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handlePhotosSelected = (selectedPhotos: Photo[]) => {
    setPhotos(selectedPhotos);
  };

  // Helper function to compress images
  const compressImage = (file: File, options: {maxWidth: number, maxHeight: number, quality: number}): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > options.maxWidth) {
            height = Math.round(height * options.maxWidth / width);
            width = options.maxWidth;
          }
          if (height > options.maxHeight) {
            width = Math.round(width * options.maxHeight / height);
            height = options.maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => resolve(blob!),
            file.type,
            options.quality
          );
        };
        img.src = event.target!.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const convertPhotosToBase64 = async (photos: Photo[]) => {
    const base64Photos = [];

    for (const photo of photos) {
      try {
        // Create a smaller version of the image for storage
        const compressedImage = await compressImage(photo.file, {
          maxWidth: 800,   // Reduce dimensions
          maxHeight: 800,
          quality: 0.7     // Reduce quality (0.7 = 70% quality)
        });

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(compressedImage);
        });

        base64Photos.push({
          id: photo.id,
          base64
        });
      } catch (error) {
        console.error('Error compressing image:', error);
        // If compression fails, try to use the original but with lower quality
        try {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(photo.file);
          });

          base64Photos.push({
            id: photo.id,
            base64
          });
        } catch (fallbackError) {
          console.error('Error reading original image:', fallbackError);
          // Skip this image if both methods fail
        }
      }
    }

    return base64Photos;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (photos.length === 0) {
      setError('Please upload at least one photo');
      return;
    }

    if (!petName) {
      setError('Please enter your pet\'s name');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Convert photos to compressed base64
      const base64Photos = await convertPhotosToBase64(photos);

      if (base64Photos.length === 0) {
        throw new Error('Failed to process any photos');
      }

      // Create session ID to track this storybook creation
      const sessionId = uuidv4();

      // Save data to session storage
      sessionStorage.setItem('petTales_sessionId', sessionId);
      sessionStorage.setItem('petTales_petInfo', JSON.stringify({
        name: petName,
        type: petType
      }));
      sessionStorage.setItem('petTales_ownerInfo', JSON.stringify({
        name: ownerName
      }));

      // Try to store all photos, but if that fails, store them in batches
      try {
        sessionStorage.setItem('petTales_photos', JSON.stringify(base64Photos));
      } catch (storageError) {
        console.error('Error storing all photos at once, trying batch storage:', storageError);

        // Store only the first 3 photos if we can't store all
        if (base64Photos.length > 3) {
          const reducedPhotos = base64Photos.slice(0, 3);
          sessionStorage.setItem('petTales_photos', JSON.stringify(reducedPhotos));
          setError('Only the first 3 photos could be processed due to storage limitations.');
        } else {
          throw storageError; // Re-throw if we have few photos but still can't store them
        }
      }

      // Redirect to analysis page
      router.push('/analysis');
    } catch (error) {
      console.error('Error preparing upload:', error);
      setError('Failed to process photos. Please try again with fewer or smaller photos.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Create Your Pet Storybook</h1>

      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Step 1: Tell us about your pet</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="petName" className="block text-sm font-medium text-gray-700 mb-1">
                  Pet's Name
                </label>
                <input
                  type="text"
                  id="petName"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Buddy, Luna, Max"
                  required
                />
              </div>

              <div>
                <label htmlFor="petType" className="block text-sm font-medium text-gray-700 mb-1">
                  Pet Type
                </label>
                <select
                  id="petType"
                  value={petType}
                  onChange={(e) => setPetType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="bird">Bird</option>
                  <option value="rabbit">Rabbit</option>
                  <option value="hamster">Hamster</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name (optional)
                </label>
                <input
                  type="text"
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Sarah, John"
                />
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Step 2: Upload pet photos</h2>
            <p className="text-gray-600 mb-4">
              Upload 3-10 photos of your pet in different settings (park, home, beach, etc.)
            </p>
            <p className="text-sm text-gray-500 mb-4">
              For best results, use smaller images (under 2MB each) and limit to 10 photos.
            </p>

            <PhotoUploader onPhotosSelected={handlePhotosSelected} />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isUploading ? 'Processing...' : 'Create My Storybook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}