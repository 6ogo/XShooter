import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { AchievementNotification } from './AchievementNotification';
import { Avatar } from './Avatar';
import { achievementService, GameCompletionData } from '../lib/achievementService';
import { MobileControls } from './MobileControls';
import { Share2, RefreshCw, LogOut, HelpCircle, X, Check, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { ShareGame } from './ShareGame';
import { GameSettings } from './GameSettings';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const PROJECTILE_SIZE = 8;
const SHOT_COOLDOWN = 3000;
const MAX_SHOTS = 5;
const SHOT_DAMAGE = 20;
const AI_UPDATE_INTERVAL = 250;
const AI_SIGHT_RANGE = 350;
const AI_SHOT_CHANCE = 0.5;
const AI_MOVEMENT_SPEED = 3.5;
const AI_BOT_COUNT = 3;
const PLAYER_MOVEMENT_SPEED = 5;
const PROJECTILE_SPEED = 6;
const HIT_EFFECT_DURATION = 300;
const LOW_HEALTH_THRESHOLD = 30;

interface GamePlayer {
  id: string;
  x: number;
  y: number;
  health: number;
  username: string;
  avatar_url?: string;
  isAI?: boolean;
  lastHitTime?: number | null;
  invulnerable?: boolean;
  lastMoveTime?: number;
  velocity?: { x: number; y: number };
  aiState?: {
    targetX: number;
    targetY: number;
    lastShotTime: number;
    movementDirection: { x: number; y: number };
    changeDirCounter: number;
    personality?: 'aggressive' | 'defensive' | 'sniper' | 'erratic';
  };
}

interface GameSettings {
  volume: number;
  graphicsQuality: 'low' | 'medium' | 'high';
  musicEnabled: boolean;
  sfxEnabled: boolean;
  controlType: 'arrows' | 'wasd';
  showFps: boolean;
  showTutorialOnStart: boolean;
}

interface PlayerAvatarCache {
  [playerId: string]: HTMLImageElement | null;
}

export function Game() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, updatePlayer, removePlayer, setRoomCode, setIsHost } = useGameStore();

  // Game state
  const [gameState, setGameState] = useState<'loading' | 'waiting' | 'playing' | 'finished'>('loading');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSingleplayer, setIsSingleplayer] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [neverShowTutorial, setNeverShowTutorial] = useState(false);
  const [playerAvatars, setPlayerAvatars] = useState<PlayerAvatarCache>({});
  const [canShoot, setCanShoot] = useState(true);
  const [shotCount, setShotCount] = useState(0);
  
  // Simple game data
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    volume: 70,
    graphicsQuality: 'medium',
    musicEnabled: true,
    sfxEnabled: true,
    controlType: 'wasd',
    showFps: false,
    showTutorialOnStart: true
  });
  
  // Tutorial steps
  const tutorialSteps = [
    {
      title: "Welcome to XShooter!",
      content: "This tutorial will walk you through the basics of playing XShooter. Click 'Next' to continue."
    },
    {
      title: "Movement",
      content: "Use WASD or arrow keys to move your player around the arena. Stay mobile to avoid enemy fire!"
    },
    {
      title: "Shooting",
      content: "Click anywhere on the screen to shoot in that direction. You can fire 5 shots before a 3-second cooldown."
    },
    {
      title: "Health System",
      content: "Every player starts with 100 HP. Each shot deals 20 damage. When your health reaches 0, you're eliminated."
    },
    {
      title: "Winning",
      content: "The last player standing wins the game! Compete to climb the leaderboard with your kill count and accuracy."
    },
    {
      title: "Ready to Play!",
      content: "You're all set! Good luck and have fun in XShooter!"
    }
  ];

  // Initialize game settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('gameSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setGameSettings(prev => ({
          ...prev,
          ...parsedSettings
        }));

        // Check if we should show tutorial
        const shouldNeverShow = localStorage.getItem('neverShowTutorial') === 'true';
        setNeverShowTutorial(shouldNeverShow);

        // Only show tutorial if setting is enabled and user hasn't opted out
        if (parsedSettings.showTutorialOnStart && !shouldNeverShow) {
          setShowTutorial(true);
        }
      } else if (gameSettings.showTutorialOnStart) {
        // If no saved settings but default is to show tutorial
        // and user hasn't opted out
        const shouldNeverShow = localStorage.getItem('neverShowTutorial') === 'true';
        setNeverShowTutorial(shouldNeverShow);
        if (!shouldNeverShow) {
          setShowTutorial(true);
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };

    checkMobile();

    // Set singleplayer mode if needed
    if (id === 'singleplayer') {
      setIsSingleplayer(true);
    }
  }, [id]);

  // Initialize the game and authentication
  useEffect(() => {
    const initGame = async () => {
      try {
        if (id === 'singleplayer') {
          console.log("Initializing singleplayer mode");

          // Generate a player ID for this session
          const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
          setCurrentUserId(playerId);

          // Position player in the center of the canvas
          const x = CANVAS_WIDTH / 2;
          const y = CANVAS_HEIGHT / 2;

          // Add the player
          updatePlayer(playerId, {
            id: playerId,
            x,
            y,
            health: 100,
            username: 'You'
          });

          // Set game state to playing after a short delay
          setTimeout(() => {
            console.log("Starting singleplayer game");
            setGameState('playing');
          }, 300);

          return;
        }

        // For multiplayer games
        if (currentUserId && id !== 'singleplayer' && players.size > 0) {
          console.log("Game already initialized");
          return;
        }

        // Authenticate user for multiplayer
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/');
          return;
        }

        console.log("User authenticated:", user.id);
        setCurrentUserId(user.id);

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (profile) {
          const avatar_url = user.user_metadata?.avatar_url || null;
          const existingPlayer = players.get(user.id);

          // Random starting position or use existing
          const x = existingPlayer ? existingPlayer.x : Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
          const y = existingPlayer ? existingPlayer.y : Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;

          // Update player data
          updatePlayer(user.id, {
            x,
            y,
            health: existingPlayer ? existingPlayer.health : 100,
            username: profile.username,
            avatar_url
          });

          // For multiplayer games, add to database
          if (id && id !== 'singleplayer' && !existingPlayer) {
            // Add player to game in database
            await supabase
              .from('game_players')
              .upsert({
                game_id: id,
                player_id: user.id,
                position_x: x,
                position_y: y
              }, { onConflict: 'game_id,player_id' });

            // Get game info
            const { data: game } = await supabase
              .from('games')
              .select('host_id, room_code')
              .eq('id', id)
              .single();

            if (game) {
              // Store room code
              if (game.room_code) {
                console.log("Room code:", game.room_code);
                setRoomCode(game.room_code);
              }

              // Check if host
              if (game.host_id === user.id) {
                setIsHost(true);
                // Show share link for host
                setTimeout(() => setShowShareLink(true), 1000);
              }
            }
          }
        }

        // Set initial game state
        if (gameState === 'loading') {
          console.log("Setting game state to waiting");
          setGameState('waiting');
        }

      } catch (error) {
        console.error("Game initialization error:", error);
      }
    };

    initGame();
  }, [id, navigate, updatePlayer, players, currentUserId, gameState, setRoomCode, setIsHost]);

  // Handle keyboard input for movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Implement basic movement controls
      // This is a simplified version that would be expanded in the full component
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Handle key release
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameSettings.controlType, showTutorial]);

  // Basic canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Basic game loop that will be expanded in the full component
    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw players (simplified)
      players.forEach(player => {
        if (player.health <= 0) return;
        
        // Draw player
        ctx.fillStyle = player.id === currentUserId ? '#4CAF50' : '#2196F3';
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw health bar
        const healthBarWidth = 40;
        const healthBarHeight = 4;
        const healthBarX = player.x - healthBarWidth / 2;
        const healthBarY = player.y - PLAYER_SIZE - 15;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        // Health fill
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * (player.health / 100), healthBarHeight);
      });
      
      // Continue animation
      requestAnimationFrame(draw);
    };
    
    // Start game loop
    const animationId = requestAnimationFrame(draw);
    
    // Cleanup
    return () => cancelAnimationFrame(animationId);
  }, [players, currentUserId]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Scale canvas for different screen sizes
      const isMobileDevice = window.innerWidth < 768 || window.innerHeight < 600;
      if (isMobileDevice) {
        const scale = Math.min(1, (window.innerWidth - 40) / CANVAS_WIDTH);
        canvas.style.transform = `scale(${scale})`;
      } else {
        canvas.style.transform = 'scale(1)';
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Simple handler for returning to lobby
  const handleReturnToLobby = () => {
    navigate('/game/lobby');
  };

  // Handle tutorial close
  const handleCloseTutorial = () => {
    setShowTutorial(false);
    setTutorialStep(0);
    
    // Save preferences
    if (neverShowTutorial) {
      localStorage.setItem('neverShowTutorial', 'true');
    }
    
    // Update settings
    const updatedSettings = {
      ...gameSettings,
      showTutorialOnStart: !neverShowTutorial
    };
    
    setGameSettings(updatedSettings);
    localStorage.setItem('gameSettings', JSON.stringify(updatedSettings));
  };

  // Show loading screen
  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 border-4 border-t-indigo-500 border-gray-700 rounded-full animate-spin mb-4"></div>
          <p className="text-white">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 p-4" tabIndex={0}>
      {/* Game controls bar */}
      <div className="w-full max-w-screen-lg mb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={handleReturnToLobby}
            className="bg-red-600 text-white p-2 rounded-lg flex items-center gap-2 shadow-lg hover:bg-red-700 transition-colors"
          >
            <LogOut size={18} />
            <span>Exit Game</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="bg-gray-700 text-white p-2 rounded-lg flex items-center gap-2 shadow-lg hover:bg-gray-600 transition-colors"
          >
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>

          {showShareLink && !isSingleplayer && (
            <button
              onClick={() => setShowShareDialog(true)}
              className="bg-indigo-600 text-white p-2 rounded-lg flex items-center gap-2 shadow-lg cursor-pointer hover:bg-indigo-700 transition-colors"
            >
              <Share2 size={16} />
              <span>Share Game</span>
            </button>
          )}
        </div>
      </div>

      {/* Game canvas */}
      <div className="relative game-canvas-container">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700"
        />

        {/* Mobile Controls */}
        {isMobile && !showTutorial && <MobileControls onMove={() => {}} onShoot={() => {}} />}

        {/* Tutorial Overlay */}
        {showTutorial && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-lg p-4">
            <div className="bg-gray-800 rounded-lg p-4 md:p-6 max-w-md w-full shadow-2xl border border-indigo-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{tutorialSteps[tutorialStep].title}</h3>
                <button
                  onClick={handleCloseTutorial}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="text-gray-300 mb-6">{tutorialSteps[tutorialStep].content}</div>

              <div className="flex flex-col sm:flex-row justify-between gap-2">
                <button
                  onClick={() => setTutorialStep(Math.max(0, tutorialStep - 1))}
                  className={`px-4 py-2 rounded-lg ${
                    tutorialStep === 0 
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                    } transition-colors w-full sm:w-auto`}
                  disabled={tutorialStep === 0}
                >
                  Previous
                </button>

                <div className="flex items-center justify-center my-2 sm:my-0">
                  <span className="text-gray-400 text-sm">
                    {tutorialStep + 1} / {tutorialSteps.length}
                  </span>
                </div>

                {tutorialStep < tutorialSteps.length - 1 ? (
                  <button
                    onClick={() => setTutorialStep(tutorialStep + 1)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 w-full sm:w-auto"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleCloseTutorial}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1 w-full sm:w-auto"
                  >
                    <Check size={16} /> Start Playing
                  </button>
                )}
              </div>

              {/* Never show again checkbox */}
              <div className="mt-4 pt-4 border-t border-gray-700 flex items-center">
                <input
                  type="checkbox"
                  id="neverShowTutorial"
                  checked={neverShowTutorial}
                  onChange={(e) => setNeverShowTutorial(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 rounded"
                />
                <label htmlFor="neverShowTutorial" className="ml-2 text-sm text-gray-300">
                  Don't show tutorial on startup
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Game Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="max-w-md w-full">
              <GameSettings onClose={() => setShowSettings(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
