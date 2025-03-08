import { useState, useEffect } from 'react';
import { Volume2, Monitor, Zap, Maximize } from 'lucide-react';

interface GameSettingsProps {
  initialSettings?: {
    volume?: number;
    graphicsQuality?: string;
    musicEnabled?: boolean;
    sfxEnabled?: boolean;
    fullscreen?: boolean;
  };
  onSave: (settings: any) => void;
  onClose: () => void;
}

export function GameSettings({ initialSettings, onSave, onClose }: GameSettingsProps) {
  const [volume, setVolume] = useState(initialSettings?.volume || 50);
  const [graphicsQuality, setGraphicsQuality] = useState(initialSettings?.graphicsQuality || 'medium');
  const [musicEnabled, setMusicEnabled] = useState(initialSettings?.musicEnabled !== undefined ? initialSettings.musicEnabled : true);
  const [sfxEnabled, setSfxEnabled] = useState(initialSettings?.sfxEnabled !== undefined ? initialSettings.sfxEnabled : true);
  const [fullscreen, setFullscreen] = useState(initialSettings?.fullscreen || false);

  useEffect(() => {
    // Apply fullscreen mode if enabled
    if (fullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.error('Error attempting to exit fullscreen:', err);
        });
      }
    }
  }, [fullscreen]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(e.target.value));
  };

  const handleQualityChange = (quality: string) => {
    setGraphicsQuality(quality);
  };

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  const saveSettings = () => {
    // Save settings
    onSave({
      volume,
      graphicsQuality,
      musicEnabled,
      sfxEnabled,
      fullscreen
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
      <h2 className="text-xl font-bold text-white mb-6">Game Settings</h2>
      
      {/* Volume */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-white flex items-center">
            <Volume2 className="mr-2" size={18} />
            Volume
          </label>
          <span className="text-gray-300">{volume}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      {/* Graphics Quality */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <Monitor className="mr-2" size={18} />
          <label className="text-white">Graphics Quality</label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['low', 'medium', 'high'].map((quality) => (
            <button
              key={quality}
              onClick={() => handleQualityChange(quality)}
              className={`py-2 px-3 rounded-md capitalize ${
                graphicsQuality === quality
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {quality}
            </button>
          ))}
        </div>
      </div>
      
      {/* Sound Toggles */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-white flex items-center">
            <Zap className="mr-2" size={18} />
            Music
          </label>
          <div className="relative inline-block w-12 h-6">
            <input
              type="checkbox"
              className="opacity-0 w-0 h-0"
              checked={musicEnabled}
              onChange={() => setMusicEnabled(!musicEnabled)}
            />
            <span 
              className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full ${
                musicEnabled ? 'bg-indigo-600' : 'bg-gray-600'
              }`}
            >
              <span 
                className={`absolute h-4 w-4 rounded-full bg-white top-1 ${
                  musicEnabled ? 'right-1' : 'left-1'
                } transition-all duration-200`}
              ></span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <label className="text-white flex items-center">
            <Volume2 className="mr-2" size={18} />
            Sound Effects
          </label>
          <div className="relative inline-block w-12 h-6">
            <input
              type="checkbox"
              className="opacity-0 w-0 h-0"
              checked={sfxEnabled}
              onChange={() => setSfxEnabled(!sfxEnabled)}
            />
            <span 
              className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full ${
                sfxEnabled ? 'bg-indigo-600' : 'bg-gray-600'
              }`}
            >
              <span 
                className={`absolute h-4 w-4 rounded-full bg-white top-1 ${
                  sfxEnabled ? 'right-1' : 'left-1'
                } transition-all duration-200`}
              ></span>
            </span>
          </div>
        </div>
        
        {/* Fullscreen Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-white flex items-center">
            <Maximize className="mr-2" size={18} />
            Fullscreen
          </label>
          <div className="relative inline-block w-12 h-6">
            <input
              type="checkbox"
              className="opacity-0 w-0 h-0"
              checked={fullscreen}
              onChange={toggleFullscreen}
            />
            <span 
              className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full ${
                fullscreen ? 'bg-indigo-600' : 'bg-gray-600'
              }`}
            >
              <span 
                className={`absolute h-4 w-4 rounded-full bg-white top-1 ${
                  fullscreen ? 'right-1' : 'left-1'
                } transition-all duration-200`}
              ></span>
            </span>
          </div>
        </div>
      </div>
      
      {/* Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={saveSettings}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}