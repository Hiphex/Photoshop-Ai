import { useState } from 'react';
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
  // Initialize only the editable settings with defaults to avoid undefined
  const initialSettings: LightroomSettings = {
    exposure: preset.settings.exposure ?? 0,
    contrast: preset.settings.contrast ?? 0,
    saturation: preset.settings.saturation ?? 0,
    tint: preset.settings.tint ?? 0,
  };
  const [settings, setSettings] = useState<LightroomSettings>(initialSettings);
  const [open, setOpen] = useState(false);

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

  // Build CSS filter string from key settings
  const filters: string[] = [];
  if (settings.exposure !== undefined) {
    // Map stops (-5 to +5) to brightness multiplier (0.5 to 1.5)
    const b = settings.exposure * 0.1 + 1;
    filters.push(`brightness(${b.toFixed(2)})`);
  }
  if (settings.contrast !== undefined) {
    // Map -100..100 to 0..2
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

      <div className="text-center mb-4">
        <button
          onClick={downloadXMP}
          className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
        >
          Download .XMP Preset File
        </button>
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="w-full mb-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
      >
        {open ? 'Hide Tweaks' : 'Show Tweaks'}
      </button>

      {open && (
        <div className="space-y-4">
          {/* Exposure */}
          <div>
            <label className="block text-gray-200">Exposure: {settings.exposure}</label>
            <input
              type="range"
              min={-5}
              max={5}
              step={0.1}
              value={settings.exposure ?? 0}
              onChange={(e) =>
                setSettings({ ...settings, exposure: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-gray-600 rounded-lg cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Contrast */}
          <div>
            <label className="block text-gray-200">Contrast: {settings.contrast}</label>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={settings.contrast ?? 0}
              onChange={(e) =>
                setSettings({ ...settings, contrast: parseInt(e.target.value, 10) })
              }
              className="w-full h-2 bg-gray-600 rounded-lg cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Saturation */}
          <div>
            <label className="block text-gray-200">Saturation: {settings.saturation}</label>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={settings.saturation ?? 0}
              onChange={(e) =>
                setSettings({ ...settings, saturation: parseInt(e.target.value, 10) })
              }
              className="w-full h-2 bg-gray-600 rounded-lg cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Tint */}
          <div>
            <label className="block text-gray-200">Tint (Hue-rotate): {settings.tint}</label>
            <input
              type="range"
              min={-150}
              max={150}
              step={1}
              value={settings.tint ?? 0}
              onChange={(e) =>
                setSettings({ ...settings, tint: parseInt(e.target.value, 10) })
              }
              className="w-full h-2 bg-gray-600 rounded-lg cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
} 