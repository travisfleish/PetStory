'use client';

import { useState } from 'react';

interface PhotoDebugViewProps {
  analysisData: any;
  imageUrl: string;
}

const PhotoDebugView: React.FC<PhotoDebugViewProps> = ({ analysisData, imageUrl }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out internal properties and nested objects for simple view
  const simpleProperties = Object.entries(analysisData || {})
    .filter(([key, value]) =>
      typeof value !== 'object' &&
      key !== 'id' &&
      key !== 'originalImage' &&
      key !== 'error'
    );

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 mb-4">
      <div className="flex items-center justify-between p-3 bg-gray-100 cursor-pointer"
           onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="text-sm font-medium">AI Detection Results {isExpanded ? '▼' : '▶'}</h3>
        <span className="text-xs text-blue-600 underline">
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </span>
      </div>

      {isExpanded && (
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Image preview */}
            <div className="w-full md:w-1/3 max-w-xs">
              <img
                src={imageUrl}
                alt="Analyzed photo"
                className="w-full h-auto rounded-md"
              />
            </div>

            {/* Analysis results */}
            <div className="w-full md:w-2/3">
              <h4 className="font-semibold mb-2">What the AI detected:</h4>

              {/* Simple key-value section */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {simpleProperties.map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-medium text-gray-700 mr-2">{key}:</span>
                    <span className="text-gray-900">{String(value || 'Not detected')}</span>
                  </div>
                ))}
              </div>

              {/* Scene description */}
              {analysisData?.sceneDescription && (
                <div className="mb-4">
                  <h4 className="font-semibold">Scene Description:</h4>
                  <p className="text-gray-800 italic bg-blue-50 p-2 rounded">
                    "{analysisData.sceneDescription}"
                  </p>
                </div>
              )}

              {/* Raw JSON for complete data */}
              <div className="mt-4">
                <h4 className="font-semibold mb-1">Complete Raw Data:</h4>
                <pre className="bg-gray-800 text-gray-200 p-3 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(analysisData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoDebugView;