import dynamic from 'next/dynamic';
import type { LightroomSettings } from '@/lib/presetUtils';

const CompareImage = dynamic(() => import('react-compare-image'), { ssr: false });

interface PresetCardProps {
  originalImageUrl: string | null;
  preset: {
    xmp: string;
    displaySettings: string;
    originalFilename: string;
    generatedAt: string;
    settings: LightroomSettings;
  };
}

export default function PresetCard({ originalImageUrl, preset }: PresetCardProps) {
  // Build CSS filter string from AI-generated settings
  const settings = preset.settings;
  const filters: string[] = [];
  if (settings.exposure !== undefined) {
    const b = settings.exposure * 0.1 + 1;
    filters.push(`brightness(${b.toFixed(2)})`);
  }
  if (settings.contrast !== undefined) {
    const c = settings.contrast / 100 + 1;
    filters.push(`contrast(${c.toFixed(2)})`);
  }
  if (settings.saturation !== undefined) {
    const s = settings.saturation / 100 + 1;
    filters.push(`saturate(${s.toFixed(2)})`);
  }
  if (settings.tint !== undefined) {
    filters.push(`hue-rotate(${settings.tint}deg)`);
  }
  const filterStyle = filters.join(' ');

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
            rightImageCss={{ filter: filterStyle }}
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