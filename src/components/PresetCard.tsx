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
  const [settings, setSettings] = useState<LightroomSettings>(preset.settings);
  const [open, setOpen] = useState(false);

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
        {/* Before/After slider */}
        {originalImageUrl && (
          <CompareImage
            leftImage={originalImageUrl}
            rightImage={originalImageUrl}
            sliderLineColor="#ffffff"
          />
        )}
        {/* Live filter overlay */}
        {originalImageUrl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ filter: filterStyle }}
          />
        )}
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
              className="w-full"
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
              className="w-full"
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
              className="w-full"
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
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
} 