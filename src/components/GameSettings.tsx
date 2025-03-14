// Update the GameSettings.tsx file to be more mobile-friendly

import { useState, useEffect } from 'react';
import { Volume2, Monitor, Zap, Check, X as CloseIcon, Gamepad, MousePointer, Smartphone } from 'lucide-react';

interface GameSettingsProps {
  onClose: () => void;
}

interface GameSettingsState {
  volume: number;
  graphicsQuality: 'low' | 'medium' | 'high';
  musicEnabled: boolean;
  sfxEnabled: boolean;
  controlType: 'arrows' | 'wasd';
  showFps: boolean;
  showTutorialOnStart: boolean;
}

const DEFAULT_SETTINGS: GameSettingsState = {
  volume: 70,
  graphicsQuality: 'medium',
  musicEnabled: true,
  sfxEnabled: true,
  controlType: 'wasd',
  showFps: false,
  showTutorialOnStart: true
};

export function GameSettings({ onClose }: GameSettingsProps) {
  const [settings, setSettings] = useState<GameSettingsState>(DEFAULT_SETTINGS);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'controls'>('general');

  useEffect(() => {
    // Load settings from localStorage on component mount
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsedSettings
        });
      } catch (err) {
        console.error('Error parsing saved settings:', err);
        // If there's an error parsing, we'll use the default settings
      }
    }
  }, []);

  const updateSetting = <K extends keyof GameSettingsState>(
    key: K,
    value: GameSettingsState[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setSettingsChanged(true);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSetting('volume', parseInt(e.target.value));
  };

  const handleQualityChange = (quality: 'low' | 'medium' | 'high') => {
    updateSetting('graphicsQuality', quality);
  };

  const toggleSetting = (key: 'musicEnabled' | 'sfxEnabled' | 'showFps' | 'showTutorialOnStart') => {
    updateSetting(key, !settings[key]);
  };

  const setControlType = (type: 'arrows' | 'wasd') => {
    updateSetting('controlType', type);
  };

  const saveSettings = () => {
    // Save settings to local storage
    localStorage.setItem('gameSettings', JSON.stringify(settings));
    
    // Apply settings to the game (would normally affect game state)
    // For example, updating volume of audio elements, etc.
    applySettingsToGame(settings);
    
    setSettingsChanged(false);
    onClose();
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setSettingsChanged(true);
    setShowResetConfirm(false);
  };

  // This function would actually apply the settings to the game
  const applySettingsToGame = (gameSettings: GameSettingsState) => {
    // This is where you would apply the settings to your game
    // For example:
    // - Set audio volume
    // - Update graphics quality
    // - Toggle music/sfx
    // etc.
    console.log('Applying settings:', gameSettings);
    
    // For demonstration, we'll just log the settings
    // In a real implementation, you would access the game state and update it
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md border border-gray-700 shadow-2xl text-white relative overflow-y-auto max-h-[90vh]">
      <div className="sticky top-0 bg-gray-800 z-10 pb-2">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center">
            <Zap className="mr-2" size={22} />
            Game Settings
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
            aria-label="Close settings"
          >
            <CloseIcon size={24} />
          </button>
        </div>
        
        {/* Tabs for better mobile organization */}
        <div className="flex mt-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 ${activeTab === 'general' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400'}`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-4 py-2 ${activeTab === 'controls' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400'}`}
          >
            Controls
          </button>
        </div>
      </div>
      
      {activeTab === 'general' && (
        <div className="py-2 space-y-6">
          {/* Volume */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-white flex items-center">
                <Volume2 className="mr-2" size={18} />
                Volume
              </label>
              <span className="text-gray-300">{settings.volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.volume}
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
              {(['low', 'medium', 'high'] as const).map((quality) => (
                <button
                  key={quality}
                  onClick={() => handleQualityChange(quality)}
                  className={`py-2 px-3 rounded-md capitalize ${
                    settings.graphicsQuality === quality
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-white flex items-center">
                <Zap className="mr-2" size={18} />
                Music
              </label>
              <div 
                className={`relative inline-block w-12 h-6 cursor-pointer ${
                  settings.musicEnabled ? 'bg-indigo-600' : 'bg-gray-600'
                } rounded-full transition-colors duration-200`}
                onClick={() => toggleSetting('musicEnabled')}
              >
                <span 
                  className={`absolute h-4 w-4 rounded-full bg-white top-1 transition-all duration-200 ${
                    settings.musicEnabled ? 'right-1' : 'left-1'
                  }`}
                ></span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-white flex items-center">
                <Volume2 className="mr-2" size={18} />
                Sound Effects
              </label>
              <div 
                className={`relative inline-block w-12 h-6 cursor-pointer ${
                  settings.sfxEnabled ? 'bg-indigo-600' : 'bg-gray-600'
                } rounded-full transition-colors duration-200`}
                onClick={() => toggleSetting('sfxEnabled')}
              >
                <span 
                  className={`absolute h-4 w-4 rounded-full bg-white top-1 transition-all duration-200 ${
                    settings.sfxEnabled ? 'right-1' : 'left-1'
                  }`}
                ></span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-white flex items-center">
                <Monitor className="mr-2" size={18} />
                Show FPS Counter
              </label>
              <div 
                className={`relative inline-block w-12 h-6 cursor-pointer ${
                  settings.showFps ? 'bg-indigo-600' : 'bg-gray-600'
                } rounded-full transition-colors duration-200`}
                onClick={() => toggleSetting('showFps')}
              >
                <span 
                  className={`absolute h-4 w-4 rounded-full bg-white top-1 transition-all duration-200 ${
                    settings.showFps ? 'right-1' : 'left-1'
                  }`}
                ></span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-white flex items-center">
                <Smartphone className="mr-2" size={18} />
                Show Tutorial on Start
              </label>
              <div 
                className={`relative inline-block w-12 h-6 cursor-pointer ${
                  settings.showTutorialOnStart ? 'bg-indigo-600' : 'bg-gray-600'
                } rounded-full transition-colors duration-200`}
                onClick={() => toggleSetting('showTutorialOnStart')}
              >
                <span 
                  className={`absolute h-4 w-4 rounded-full bg-white top-1 transition-all duration-200 ${
                    settings.showTutorialOnStart ? 'right-1' : 'left-1'
                  }`}
                ></span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'controls' && (
        <div className="py-2 space-y-6">
          {/* Controls */}
          <div>
            <div className="flex items-center mb-2">
              <Gamepad className="mr-2" size={18} />
              <label className="text-white">Keyboard Controls</label>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setControlType('wasd')}
                className={`py-3 px-3 rounded-md flex items-center justify-center ${
                  settings.controlType === 'wasd'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span className="px-1 py-0.5 bg-gray-800 rounded mr-2">WASD</span>
                <MousePointer size={14} />
              </button>
              <button
                onClick={() => setControlType('arrows')}
                className={`py-3 px-3 rounded-md flex items-center justify-center ${
                  settings.controlType === 'arrows'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span className="px-1 py-0.5 bg-gray-800 rounded mr-2">Arrows</span>
                <MousePointer size={14} />
              </button>
            </div>
            
            <p className="text-gray-400 text-sm mb-4">
              You can shoot by clicking or tapping in both control modes. On mobile, you can switch between joystick and D-pad controls during the game.
            </p>
            
            <div className="mt-4 bg-gray-700 p-3 rounded-md">
              <h4 className="text-sm font-medium mb-2">Mobile Controls</h4>
              <p className="text-xs text-gray-300">
                Use the joystick on the left side to move and tap on the right side to shoot. Toggle between joystick and D-pad with the button at the top.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Buttons - always visible at bottom */}
      <div className="mt-6 pt-4 border-t border-gray-700 flex flex-col sm:flex-row gap-3 justify-between">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors order-2 sm:order-1"
        >
          Reset Defaults
        </button>
        
        <div className="flex gap-3 order-1 sm:order-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            disabled={!settingsChanged}
            className={`px-4 py-2 rounded-md flex items-center ${
              settingsChanged
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-indigo-600/50 text-white/70'
            } transition-colors`}
          >
            <Check size={18} className="mr-2" />
            Save
          </button>
        </div>
      </div>
      
      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-gray-900/90 flex items-center justify-center p-4 rounded-lg z-50">
          <div className="bg-gray-800 p-4 rounded-lg max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Reset Settings?</h3>
            <p className="text-gray-300 mb-4">
              This will restore all settings to their default values. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={resetToDefaults}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
              >
                <CloseIcon size={18} className="mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}