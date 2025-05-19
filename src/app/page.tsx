'use client';

import { useState, ChangeEvent, FormEvent } from 'react';

interface GeneratedPresetData {
  xmp: string;
  displaySettings: string;
  originalFilename: string;
  generatedAt: string;
}

export default function HomePage() {
  const [primaryPhoto, setPrimaryPhoto] = useState<File | null>(null);
  const [inspirationPhotos, setInspirationPhotos] = useState<FileList | null>(null);
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [generatedPreset, setGeneratedPreset] = useState<GeneratedPresetData | null>(null);
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-2.0-flash'); // Default to Gemini 2.0 Flash

  const handlePrimaryPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setPrimaryPhoto(event.target.files[0]);
      setGeneratedPreset(null); // Reset previous result when photo changes
      setFeedbackMessage('');
    }
  };

  const handleInspirationPhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInspirationPhotos(event.target.files);
    setGeneratedPreset(null);
  };

  const handleTextPromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setTextPrompt(event.target.value);
    setGeneratedPreset(null);
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('[ handleSubmit ] Form submitted');

    if (!primaryPhoto) {
      setFeedbackMessage('Please upload a primary photo.');
      console.log('[ handleSubmit ] Primary photo missing');
      return;
    }

    setIsLoading(true);
    setFeedbackMessage('Generating your preset... This may take a moment.');
    setGeneratedPreset(null);
    console.log('[ handleSubmit ] setIsLoading(true), primaryPhoto:', primaryPhoto);

    const formData = new FormData();
    formData.append('primaryPhoto', primaryPhoto);

    if (inspirationPhotos) {
      Array.from(inspirationPhotos).forEach((file, index) => {
        formData.append(`inspirationPhoto_${index}`, file);
      });
    }
    formData.append('textPrompt', textPrompt);
    formData.append('selectedAiModel', selectedAiModel);
    console.log('[ handleSubmit ] FormData prepared:', formData);
    for (const [key, value] of formData.entries()) {
      console.log(`[ handleSubmit ] FormData entry: ${key}:`, value);
    }

    try {
      console.log('[ handleSubmit ] Calling fetch to /api/generate-preset');
      const response = await fetch('/api/generate-preset', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setFeedbackMessage(`Success: ${result.message}`);
        setGeneratedPreset(result as GeneratedPresetData);
        console.log('API Response:', result);
      } else {
        setFeedbackMessage(`Error: ${result.error || 'Something went wrong.'}`);
        console.error('[ handleSubmit ] API error response:', result);
      }
    } catch (error) {
      console.error('Submission error:', error);
      setFeedbackMessage('Error: Could not connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadXMP = () => {
    if (generatedPreset) {
      const blob = new Blob([generatedPreset.xmp], { type: 'application/xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      // Sanitize filename for download
      const safeFilename = generatedPreset.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      link.download = `${safeFilename}_ai_preset.xmp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8 bg-gray-900 text-white">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-8 md:mb-10 text-purple-400">
          AI Lightroom Preset Generator
        </h1>

        {/* Form Sections */}
        <form id="preset-form" onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-8">
          <section className="p-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-purple-300">1. Upload Your Primary Photo</h2>
            <input
              type="file"
              accept="image/*, .dng, .cr2, .nef, .arw, .rw2, .orf"
              onChange={handlePrimaryPhotoChange}
              disabled={isLoading}
              className="block w-full text-sm text-gray-400
                         file:mr-4 file:py-2 file:px-4
                         file:rounded-full file:border-0
                         file:text-sm file:font-semibold
                         file:bg-purple-600 file:text-purple-50
                         hover:file:bg-purple-700 disabled:opacity-50 cursor-pointer"
            />
            {primaryPhoto && <p className="mt-2 text-xs md:text-sm text-gray-400">Selected: {primaryPhoto.name}</p>}
          </section>

          <section className="p-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-purple-300">2. Add Inspiration (Optional)</h2>
            <label htmlFor="inspirationPhotos" className="block text-sm font-medium text-gray-300 mb-2">
              Upload 1-3 inspiration images (JPEG, PNG, etc.):
            </label>
            <input
              id="inspirationPhotos"
              type="file"
              accept="image/*, .dng, .cr2, .nef, .arw, .rw2, .orf"
              multiple
              disabled={isLoading}
              onChange={handleInspirationPhotosChange}
              className="block w-full text-sm text-gray-400
                           file:mr-4 file:py-2 file:px-4
                           file:rounded-full file:border-0
                           file:text-sm file:font-semibold
                           file:bg-purple-600 file:text-purple-50
                           hover:file:bg-purple-700 disabled:opacity-50 cursor-pointer"
            />
            {inspirationPhotos && inspirationPhotos.length > 0 && (
              <p className="mt-2 text-xs md:text-sm text-gray-400">
                Selected: {Array.from(inspirationPhotos).map(file => file.name).join(', ')}
              </p>
            )}
          </section>

          <section className="p-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-purple-300">3. Describe Your Vision (Optional)</h2>
            <textarea
              rows={4}
              value={textPrompt}
              onChange={handleTextPromptChange}
              placeholder="e.g., 'warm and airy', 'vintage film look', 'desaturated greens with strong contrast'"
              disabled={isLoading}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 placeholder-gray-500 text-white disabled:opacity-50"
            />
          </section>

          <div className="mb-8">
            <label htmlFor="aiModelSelect" className="block mb-2 text-sm font-medium text-gray-300">4. Select AI Model</label>
            <select 
              id="aiModelSelect"
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value)}
              className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="gemini-2.0-flash">Base Model (Gemini 2.0 Flash)</option>
              <option value="gemini-2.5-flash">Advanced Model (Gemini 2.5 Flash)</option>
            </select>
          </div>

          <section className="text-center mt-8 mb-6">
            <button
              type="submit"
              onClick={() => console.log('[ button ] clicked')}
              disabled={isLoading || !primaryPhoto}
              className="px-8 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors duration-150 text-lg shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating...' : 'Generate Preset'}
            </button>
          </section>
        </form>

        {feedbackMessage && (
          <section className={`text-center p-4 mb-6 rounded-md text-white ${feedbackMessage.startsWith('Error') ? 'bg-red-600' : 'bg-blue-600'}`}>
            {feedbackMessage}
          </section>
        )}

        {generatedPreset && (
          <section className="mt-10 p-6 bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-center text-green-400">Your Custom Preset is Ready!</h2>
            
            <div className="text-center mb-6">
              <button
                onClick={handleDownloadXMP}
                className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors duration-150 shadow-md"
              >
                Download .XMP Preset File
              </button>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 text-purple-300">Manual Settings (for Lightroom Mobile, etc.):</h3>
              <pre className="bg-gray-700 p-4 rounded-md text-sm text-gray-200 whitespace-pre-wrap overflow-x-auto">
                {generatedPreset.displaySettings}
              </pre>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">Generated at: {new Date(generatedPreset.generatedAt).toLocaleString()}</p>
          </section>
        )}
      </div>
    </main>
  );
}
