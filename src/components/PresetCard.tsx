import dynamic from 'next/dynamic';

const CompareImage = dynamic(() => import('react-compare-image'), { ssr: false });

interface PresetCardProps {
  originalImageUrl: string | null;
  preset: {
    xmp: string;
    displaySettings: string;
    originalFilename: string;
    generatedAt: string;
    settings: any; // retained for typing but not used
  };
}

export default function PresetCard({ originalImageUrl, preset }: PresetCardProps) {
  // Handler to download the XMP sidecar file
  const downloadXMP = () => {
    const blob = new Blob([preset.xmp], { type: 'application/xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeFilename = preset.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    link.download = `${safeFilename}_ai_preset.xmp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="bg-gray-700 bg-opacity-70 rounded-xl shadow-2xl p-6 animate-fadeInUp">
      <h3 className="text-xl font-semibold text-center text-purple-300 mb-4">
        {preset.originalFilename}
      </h3>

      <div className="relative mb-4">
        {originalImageUrl && (
          <CompareImage
            leftImage={originalImageUrl}
            rightImage={originalImageUrl}
            sliderLineColor="#ffffff"
          />
        )}
      </div>

      <div className="text-center">
        <button
          onClick={downloadXMP}
          className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
        >
          Download .XMP Preset File
        </button>
      </div>
    </div>
  );
} 