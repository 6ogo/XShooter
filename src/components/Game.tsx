import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { AchievementNotification } from './AchievementNotification';
import { Avatar } from './Avatar';
import { ShareGame } from './ShareGame';
import { GameSettings } from './GameSettings';
import { MobileControls } from './MobileControls';
import { Share2, RefreshCw, LogOut, HelpCircle, X, Check, ChevronRight, Settings as SettingsIcon } from 'lucide-react';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const AI_BOT_COUNT = 3;

export function Game() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, updatePlayer, removePlayer, setRoomCode, setIsHost } = useGameStore();

  // Game state
  const [gameState, setGameState] = useState<'loading' | 'waiting' | 'playing' | 'finished'>('loading');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSingleplayer, setIsSingleplayer] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [neverShowTutorial, setNeverShowTutorial] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Initialize AI opponents
  const initializeAIOpponents = useCallback((count: number) => {
    console.log("Initializing AI opponents:", count);

    // Remove any existing AI opponents
    const playersToRemove = [];
    for (const [playerId, player] of players.entries()) {
      if (player.isAI) playersToRemove.push(playerId);
    }
    playersToRemove.forEach(id => removePlayer(id));

    // Add new AI opponents
    for (let i = 0; i < count; i++) {
      const aiId = 'ai_' + Math.random().toString(36).substring(2, 9);
      
      // Position AI in different locations
      const angle = (Math.PI * 2 * i) / count;
      const distance = CANVAS_WIDTH * 0.3;
      
      const x = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE,
        CANVAS_WIDTH / 2 + Math.cos(angle) * distance));
      const y = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE,
        CANVAS_HEIGHT / 2 + Math.sin(angle) * distance));
      
      const botName = `Bot ${i+1}`;
      
      updatePlayer(aiId, {
        id: aiId,
        x,
        y,
        health: 100,
        username: botName,
        isAI: true
      });
      
      console.log(`Added AI opponent: ${botName} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }
  }, [players, removePlayer, updatePlayer]);

  // Initialize game settings from localStorage
  useEffect(() => {
    // Check if we should show tutorial
    const shouldNeverShow = localStorage.getItem('neverShowTutorial') === 'true';
    setNeverShowTutorial(shouldNeverShow);
    
    if (!shouldNeverShow) {
      setShowTutorial(true);
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

  // Initialize the game
  useEffect(() => {
    const initGame = async () => {
      try {
        console.log("Initializing game with id:", id);
        
        if (id === 'singleplayer') {
          console.log("Initializing singleplayer mode");

          // Generate a random player ID
          const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
          setCurrentUserId(playerId);

          // Add player in center of canvas
          const x = CANVAS_WIDTH / 2;
          const y = CANVAS_HEIGHT / 2;

          updatePlayer(playerId, {
            id: playerId,
            x,
            y,
            health: 100,
            username: 'You'
          });

          // Add AI opponents and start game
          setTimeout(() => {
            console.log("Starting singleplayer game");
            initializeAIOpponents(AI_BOT_COUNT);
            setGameState('playing');
          }, 500);

          return;
        }

        // Multiplayer: Check if already initialized
        if (currentUserId && id !== 'singleplayer' && players.size > 0) {
          console.log("Game already initialized, skipping");
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

        // Get profile
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
            id: user.id,
            x,
            y,
            health: existingPlayer ? existingPlayer.health : 100,
            username: profile.username,
            avatar_url
          });

          if (id && id !== 'singleplayer' && !existingPlayer) {
            try {
              // First check if player exists
              const { data: existingRecord } = await supabase
                .from('game_players')
                .select('*')
                .eq('game_id', id)
                .eq('player_id', user.id)
                .maybeSingle();

              if (existingRecord) {
                console.log("Player already in game, updating position");
                await supabase
                  .from('game_players')
                  .update({
                    position_x: x,
                    position_y: y
                  })
                  .eq('game_id', id)
                  .eq('player_id', user.id);
              } else {
                console.log("Adding player to game");
                await supabase
                  .from('game_players')
                  .insert({
                    game_id: id,
                    player_id: user.id,
                    position_x: x,
                    position_y: y,
                    health: 100
                  });
              }

              // Get game info
              const { data: game } = await supabase
                .from('games')
                .select('host_id, room_code')
                .eq('id', id)
                .single();

              if (game) {
                if (game.room_code) {
                  console.log("Room code:", game.room_code);
                  setRoomCode(game.room_code);
                }

                if (game.host_id === user.id) {
                  setIsHost(true);
                  setTimeout(() => setShowShareLink(true), 1000);
                }
              }
            } catch (error) {
              console.error("Error adding player to game:", error);
            }
          }
        }

        // Set initial game state
        if (gameState === 'loading') {
          console.log("Setting game state to waiting");
          setGameState('waiting');
          
          // Force game to playing state after delay for testing
          setTimeout(() => {
            console.log("Forcing game to playing state");
            setGameState('playing');
          }, 2000);
        }
      } catch (error) {
        console.error("Game initialization error:", error);
      }
    };

    initGame();
  }, [id, navigate, updatePlayer, players, currentUserId, gameState, setRoomCode, setIsHost, initializeAIOpponents]);

  // Canvas rendering
  useEffect(() => {
    if (!canvasRef.current) {
      console.error("Canvas ref is null");
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get canvas context");
      return;
    }

    console.log(`Setting up canvas render. Players: ${players.size}, Current user: ${currentUserId}`);

    let animationFrameId: number;
    
    // Game rendering loop
    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw grid
      ctx.strokeStyle = '#2a2a4e';
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      
      for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
      
      // Draw game state info for debugging
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Game State: ${gameState}`, 10, 20);
      ctx.fillText(`Players: ${players.size}`, 10, 40);
      ctx.fillText(`Current User: ${currentUserId?.substring(0, 8)}`, 10, 60);
      
      // Draw players
      let drawnCount = 0;
      players.forEach((player) => {
        if (player.health <= 0) return;
        
        drawnCount++;
        
        // Draw player circle
        ctx.fillStyle = player.id === currentUserId ? '#4CAF50' : (player.isAI ? '#F44336' : '#2196F3');
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw player name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, player.x, player.y - 30);
        
        // Draw health bar
        const healthBarWidth = 40;
        const healthBarHeight = 4;
        const healthBarX = player.x - healthBarWidth / 2;
        const healthBarY = player.y - PLAYER_SIZE - 15;
        
        // Health bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        // Health bar fill
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * (player.health / 100), healthBarHeight);
      });
      
      console.log(`Drew ${drawnCount} players on canvas`);
      
      // Continue animation
      animationFrameId = requestAnimationFrame(render);
    };
    
    // Start render loop
    console.log("Starting render loop");
    animationFrameId = requestAnimationFrame(render);
    
    // Cleanup
    return () => {
      console.log("Cleaning up render loop");
      cancelAnimationFrame(animationFrameId);
    };
  }, [players, currentUserId, gameState]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
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

  // Debug player positions
  useEffect(() => {
    console.log("Current players:", Array.from(players.entries()).map(([id, p]) => ({
      id: id.substring(0, 8),
      username: p.username,
      x: p.x,
      y: p.y,
      health: p.health,
      isAI: p.isAI
    })));
  }, [players]);

  // Handle tutorial close
  const handleCloseTutorial = () => {
    setShowTutorial(false);
    setTutorialStep(0);
    
    if (neverShowTutorial) {
      localStorage.setItem('neverShowTutorial', 'true');
    }
  };

  // Handle returning to lobby
  const handleReturnToLobby = () => {
    navigate('/game/lobby');
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
        
        {/* Debug overlay */}
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
          Game: {id?.substring(0, 8)} | State: {gameState} | Players: {players.size}
        </div>

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
        
        {/* Share Dialog */}
        {showShareDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="max-w-md w-full">
              <ShareGame 
                roomCode={id || ''} 
                gameLink={`${window.location.origin}/game/${id}`}
                onClose={() => setShowShareDialog(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
