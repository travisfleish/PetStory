import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

interface Photo {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
  uploaded: boolean;
}

interface PhotoUploaderProps {
  onPhotosSelected: (photos: Photo[]) => void;
}

const PhotoUploader = ({ onPhotosSelected }: PhotoUploaderProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsLoading(true);

    // Process the files
    const newPhotos = acceptedFiles.map(file => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      uploaded: false
    }));

    setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
    setIsLoading(false);

    if (onPhotosSelected) {
      onPhotosSelected([...photos, ...newPhotos]);
    }
  }, [photos, onPhotosSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const removePhoto = (id: string) => {
    const updatedPhotos = photos.filter(photo => photo.id !== id);
    setPhotos(updatedPhotos);

    if (onPhotosSelected) {
      onPhotosSelected(updatedPhotos);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
      >
        <input {...getInputProps()} />

        {isDragActive ? (
          <p className="text-lg text-blue-600 font-medium">Drop your pet photos here!</p>
        ) : (
          <div>
            <p className="text-lg text-gray-700 font-medium mb-2">
              Drag and drop your pet photos here, or click to select files
            </p>
            <p className="text-sm text-gray-500">
              Supported formats: JPG, PNG, HEIC (max size: 10MB)
            </p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="mt-4 text-center">
          <p className="text-blue-600">Uploading photos...</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">Selected Photos ({photos.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map(photo => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square overflow-hidden rounded-lg">
                  <img
                    src={photo.preview}
                    alt={photo.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUploader;