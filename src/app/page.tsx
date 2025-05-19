'use client';

import { useState, useRef, ChangeEvent, FormEvent } from 'react';

// P2: Add a loading spinner icon
// import { ArrowPathIcon } from '@heroicons/react/24/solid'; // Or your preferred icon library
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface GeneratedPresetData {
  xmp: string;
  displaySettings: string;
  originalFilename: string;
  generatedAt: string;
}

export default function HomePage() {
  const [primaryPhoto, setPrimaryPhoto] = useState<File | null>(null);
  const [inspirationPhotos, setInspirationPhotos] = useState<File[]>([]);
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [generatedPreset, setGeneratedPreset] = useState<GeneratedPresetData | null>(null);
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-2.0-flash'); // Default to Gemini 2.0 Flash
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const inspirationInputRef = useRef<HTMLInputElement>(null);

  const handlePrimaryPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setPrimaryPhoto(event.target.files[0]);
      setGeneratedPreset(null);
      setFeedbackMessage('');
    }
  };

  const handleInspirationPhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setInspirationPhotos(filesArray);
      setGeneratedPreset(null);
      event.target.value = '';
    }
  };

  const handleTextPromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setTextPrompt(event.target.value);
    setGeneratedPreset(null);
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!primaryPhoto) {
      setFeedbackMessage('Please upload a primary photo.');
      return;
    }
    setIsLoading(true);
    setFeedbackMessage('🤖 Generating your masterpiece... This might take a few moments.');
    setGeneratedPreset(null);

    const formData = new FormData();
    formData.append('primaryPhoto', primaryPhoto);
    if (inspirationPhotos.length > 0) {
      inspirationPhotos.forEach((file, index) => {
        formData.append(`inspirationPhoto_${index}`, file);
      });
    }
    formData.append('textPrompt', textPrompt);
    formData.append('selectedAiModel', selectedAiModel);

    try {
      const response = await fetch('/api/generate-preset', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (response.ok) {
        setFeedbackMessage(`✅ Success: ${result.message}`);
        setGeneratedPreset(result as GeneratedPresetData);
      } else {
        setFeedbackMessage(`❌ Error: ${result.error || 'Something went wrong.'}`);
      }
    } catch (error) {
      console.error('Submission error:', error);
      setFeedbackMessage('Network Error: Could not connect. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
      setPrimaryPhoto(null);
      setInspirationPhotos([]);
      if (primaryInputRef.current) primaryInputRef.current.value = '';
      if (inspirationInputRef.current) inspirationInputRef.current.value = '';
    }
  };

  const handleDownloadXMP = () => {
    if (generatedPreset) {
      const blob = new Blob([generatedPreset.xmp], { type: 'application/xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeFilename = generatedPreset.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      link.download = `${safeFilename}_ai_preset.xmp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }
  };

  const removePrimaryPhoto = () => {
    setPrimaryPhoto(null);
    setGeneratedPreset(null);
    setFeedbackMessage('');
    if (primaryInputRef.current) primaryInputRef.current.value = '';
  };

  const removeInspirationPhoto = (index: number) => {
    setInspirationPhotos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-12 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-gray-100 font-sans">
      <div className="w-full max-w-3xl bg-gray-800 bg-opacity-60 shadow-2xl rounded-xl p-6 md:p-10 backdrop-blur-md">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 animate-pulse-slow">
            AI Lightroom Preset Generator
          </h1>
          <p className="mt-3 text-gray-300 text-sm md:text-base">
            Craft stunning photo edits with the power of AI. Upload your photo, describe your vision, and let{'s'} create magic!
          </p>
        </header>

        <form id="preset-form" onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-10">
          {/* Section 1: Primary Photo */}
          <section className="p-6 bg-gray-700 bg-opacity-50 rounded-lg shadow-lg transition-all duration-300 hover:shadow-purple-500/30">
            <h2 className="text-2xl font-semibold mb-5 text-purple-300 border-b border-purple-700 pb-3">1. Upload Your Primary Photo</h2>
            <label htmlFor="primaryPhotoInput" className="sr-only">Primary Photo</label>
            <input
              id="primaryPhotoInput"
              type="file"
              accept="image/*,.dng,.cr2,.nef,.arw,.rw2,.orf,.raf,.srw,.pef,.x3f"
              onChange={handlePrimaryPhotoChange}
              disabled={isLoading}
              ref={primaryInputRef}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {primaryPhoto && (
              <p className="mt-3 text-xs md:text-sm text-green-400 flex items-center">
                ✓ {primaryPhoto.name}
                <button type="button" onClick={removePrimaryPhoto} className="ml-2 text-red-400 hover:text-red-600">×</button>
              </p>
            )}
          </section>

          {/* Section 2: Inspiration Photos */}
          <section className="p-6 bg-gray-700 bg-opacity-50 rounded-lg shadow-lg transition-all duration-300 hover:shadow-pink-500/30">
            <h2 className="text-2xl font-semibold mb-5 text-pink-300 border-b border-pink-700 pb-3">2. Add Inspiration (Optional)</h2>
            <label htmlFor="inspirationPhotos" className="block text-sm font-medium text-gray-300 mb-3">
              Upload 1-3 reference images for style guidance:
            </label>
            <input
              id="inspirationPhotos"
              type="file"
              accept="image/*,.dng,.cr2,.nef,.arw,.rw2,.orf,.raf,.srw,.pef,.x3f"
              multiple
              disabled={isLoading}
              onChange={handleInspirationPhotosChange}
              ref={inspirationInputRef}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-500 file:text-white hover:file:bg-pink-600 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            {/* Selected inspiration images */}
            {inspirationPhotos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {inspirationPhotos.map((file, idx) => (
                  <span key={idx} className="inline-flex items-center bg-pink-600 bg-opacity-80 text-white text-xs px-3 py-1 rounded-full">
                    {file.name}
                    <button type="button" onClick={() => removeInspirationPhoto(idx)} className="ml-2 text-red-200 hover:text-red-400">×</button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Text Prompt */}
          <section className="p-6 bg-gray-700 bg-opacity-50 rounded-lg shadow-lg transition-all duration-300 hover:shadow-teal-500/30">
            <h2 className="text-2xl font-semibold mb-5 text-teal-300 border-b border-teal-700 pb-3">3. Describe Your Vision (Optional)</h2>
            <label htmlFor="textPromptInput" className="sr-only">Text Prompt</label>
            <textarea
              id="textPromptInput"
              rows={4}
              value={textPrompt}
              onChange={handleTextPromptChange}
              placeholder="e.g., 'moody cinematic with teal and orange', 'bright and airy minimalist', 'dramatic black and white portrait'"
              disabled={isLoading}
              className="w-full p-4 bg-gray-600 bg-opacity-70 border border-gray-500 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-gray-400 text-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </section>

          {/* Section 4: AI Model Selection */}
          <section className="p-6 bg-gray-700 bg-opacity-50 rounded-lg shadow-lg transition-all duration-300 hover:shadow-indigo-500/30">
            <h2 className="text-2xl font-semibold mb-5 text-indigo-300 border-b border-indigo-700 pb-3">4. Choose Your AI Engine</h2>
            <label htmlFor="aiModelSelect" className="sr-only">Select AI Model</label>
            <select 
              id="aiModelSelect"
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value)}
              disabled={isLoading}
              className="w-full p-4 bg-gray-600 bg-opacity-70 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="gemini-2.0-flash">Gemini 2.0 Flash (Base Model)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Advanced Model)</option>
            </select>
          </section>

          {/* Submit Button */}
          <section className="text-center pt-6">
            <button
              type="submit"
              disabled={isLoading || !primaryPhoto}
              className={`px-10 py-4 font-bold rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-lg shadow-xl focus:outline-none focus:ring-4 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-60 
                ${isLoading 
                  ? 'bg-gray-500 text-gray-300 animate-pulse' 
                  : 'bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white'}
                disabled:from-gray-500 disabled:to-gray-600`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  {/* Placeholder for an actual spinner icon if you add one */}
                  {/* <ArrowPathIcon className="animate-spin h-5 w-5 mr-3" /> */}
                  <ArrowPathIcon className="animate-spin h-5 w-5 mr-3" />
                  Generating...
                </span>
              ) : '✨ Generate Preset ✨'}
            </button>
          </section>
        </form>

        {/* Feedback Message */} 
        {feedbackMessage && (
          <section className={`text-center p-4 my-8 rounded-lg shadow-md text-base transition-all duration-500 ease-in-out transform ${feedbackMessage.startsWith('✅') ? 'bg-green-600 bg-opacity-80 text-green-100 scale-100' : feedbackMessage.startsWith('❌') ? 'bg-red-600 bg-opacity-80 text-red-100 scale-100' : 'bg-blue-600 bg-opacity-80 text-blue-100 scale-95 opacity-0'} ${feedbackMessage && !isLoading ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            {feedbackMessage}
          </section>
        )}

        {/* Generated Preset Display */}
        {generatedPreset && (
          <section className="mt-12 p-6 md:p-8 bg-gray-700 bg-opacity-70 rounded-xl shadow-2xl animate-fadeInUp">
            <h2 className="text-3xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-teal-400">
              Your Custom Preset is Ready!
            </h2>
            
            <div className="text-center mb-8">
              <button
                onClick={handleDownloadXMP}
                className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-purple-500 focus:ring-opacity-50"
              >
                Download .XMP Preset File
              </button>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-purple-300">Manual Settings Preview:</h3>
              <pre className="bg-gray-900 bg-opacity-80 p-4 rounded-md text-sm text-gray-200 whitespace-pre-wrap overflow-x-auto max-h-96 ring-1 ring-gray-700">
                {generatedPreset.displaySettings}
              </pre>
            </div>
            <p className="text-xs text-gray-400 mt-6 text-center">Generated for {generatedPreset.originalFilename} at: {new Date(generatedPreset.generatedAt).toLocaleString()}</p>
          </section>
        )}
      </div>
    </main>
  );
}

// The animation styles previously here have been moved to globals.css
