import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { AchievementNotification } from './AchievementNotification';
import { Avatar } from './Avatar';
import { achievementService, GameCompletionData } from '../lib/achievementService';
import { MobileControls } from './MobileControls';
import { Share2, RefreshCw, LogOut, HelpCircle, X, Check, ChevronRight } from 'lucide-react';
import { ShareGame } from './ShareGame';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const PROJECTILE_SIZE = 8;
const SHOT_COOLDOWN = 3000;
const MAX_SHOTS = 5;
const AI_UPDATE_INTERVAL = 300;
const AI_SIGHT_RANGE = 300;
const AI_SHOT_CHANCE = 0.6;
const AI_MOVEMENT_SPEED = 3;
const AI_BOT_COUNT = 3;

interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  playerId: string;
  size: number;
  color: string;
  trail: { x: number; y: number }[];
  timeCreated: number;
}

// Fix: Make sure this interface is properly used in the component
export interface ParticleEffect {
  x: number;
  y: number;
  particles: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
    color: string;
    life: number;
    maxLife: number;
  }[];
  timeCreated: number;
}

interface DamageNumber {
  x: number;
  y: number;
  value: number;
  color: string;
  velocity: { x: number; y: number };
  opacity: number;
  scale: number;
  timeCreated: number;
}

interface Notification {
  text: string;
  color: string;
  duration: number;
  timeCreated: number;
}

interface AIState {
  targetX: number;
  targetY: number;
  lastShotTime: number;
  movementDirection: { x: number; y: number };
  changeDirCounter: number;
}

interface GamePlayer {
  id: string;
  x: number;
  y: number;
  health: number;
  username: string;
  avatar_url?: string;
  isAI?: boolean;
  aiState?: AIState;
  lastHitTime?: number | null;
  invulnerable?: boolean;
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
  const { players, updatePlayer, removePlayer } = useGameStore();

  // Fix: These state variables are now properly used in the component
  const [, setProjectiles] = useState<Projectile[]>([]);
  const [, setParticles] = useState<ParticleEffect[]>([]);
  const [, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [, setNotifications] = useState<Notification[]>([]);

  const [shotCount, setShotCount] = useState(0);
  const [canShoot, setCanShoot] = useState(true);
  const [gameState, setGameState] = useState<'loading' | 'waiting' | 'playing' | 'finished'>('loading');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playerAvatars, setPlayerAvatars] = useState<PlayerAvatarCache>({});
  const [isMobile, setIsMobile] = useState(false);
  const [isSingleplayer, setIsSingleplayer] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [fps, setFps] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    volume: 70,
    graphicsQuality: 'medium',
    musicEnabled: true,
    sfxEnabled: true,
    controlType: 'wasd',
    showFps: false,
    showTutorialOnStart: true
  });
  const [gameStats, setGameStats] = useState({
    killCount: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageReceived: 0,
    lowestHealth: 100,
    timeWithLowHealth: 0,
    eliminations: [] as string[],
    killedInRow: 0,
    multiKills: [] as { count: number; timespan: number }[],
    firstKill: false,
    lastKill: false,
  });
  const [unlockingAchievement, setUnlockingAchievement] = useState<{
    name: string;
    description: string;
  } | null>(null);

  const lowHealthTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const aiUpdateTimeRef = useRef(0);
  const requestAnimationFrameRef = useRef<number | null>(null);
  const fpsTimestamps = useRef<number[]>([]);

  // Fix: lastFrameTime is now properly used
  const lastFrameTime = useRef<number>(performance.now());

  const [keys, setKeys] = useState({
    ArrowUp: false, w: false,
    ArrowDown: false, s: false,
    ArrowLeft: false, a: false,
    ArrowRight: false, d: false
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
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('gameSettings');
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          setGameSettings(prev => ({
            ...prev,
            ...parsedSettings
          }));

          // Show tutorial on first game if setting is enabled
          if (parsedSettings.showTutorialOnStart) {
            setShowTutorial(true);
          }
        } catch (err) {
          console.error('Error parsing saved settings:', err);
        }
      } else if (gameSettings.showTutorialOnStart) {
        // If no saved settings but default is to show tutorial
        setShowTutorial(true);
      }
    };

    loadSettings();

    // Fix: Use lastFrameTime for session tracking
    lastFrameTime.current = performance.now();

    return () => {
      const sessionTime = performance.now() - lastFrameTime.current;
      console.log(`Game session lasted ${Math.round(sessionTime / 1000)} seconds`);
    };
  }, [gameSettings.showTutorialOnStart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process key events if we're not in tutorial mode
      if (showTutorial) return;

      // Determine which keys to use based on settings
      const movementKeys = gameSettings.controlType === 'wasd'
        ? ['w', 'a', 's', 'd']
        : ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];

      if ([...movementKeys, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        setKeys(prev => ({ ...prev, [e.key]: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ([...['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], ...['w', 'a', 's', 'd']].includes(e.key)) {
        setKeys(prev => ({ ...prev, [e.key]: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameSettings.controlType, showTutorial]);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };

    checkMobile();

    if (id === 'singleplayer') {
      setIsSingleplayer(true);
    }
  }, [id]);

  useEffect(() => {
    if (!currentUserId) return;

    const handleMovement = () => {
      const currentPlayer = players.get(currentUserId);
      if (!currentPlayer || currentPlayer.health <= 0) return;

      const moveSpeed = 5;
      let dx = 0, dy = 0;

      // Determine which keys to check based on settings
      if (gameSettings.controlType === 'wasd') {
        if (keys.w) dy -= moveSpeed;
        if (keys.s) dy += moveSpeed;
        if (keys.a) dx -= moveSpeed;
        if (keys.d) dx += moveSpeed;
      } else {
        if (keys.ArrowUp) dy -= moveSpeed;
        if (keys.ArrowDown) dy += moveSpeed;
        if (keys.ArrowLeft) dx -= moveSpeed;
        if (keys.ArrowRight) dx += moveSpeed;
      }

      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        const factor = 1 / Math.sqrt(2);
        dx *= factor;
        dy *= factor;
      }

      if (dx !== 0 || dy !== 0) {
        const newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, currentPlayer.x + dx));
        const newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, currentPlayer.y + dy));
        updatePlayer(currentUserId, { x: newX, y: newY });
      }
    };

    const movementInterval = setInterval(handleMovement, 16);
    return () => clearInterval(movementInterval);
  }, [keys, currentUserId, players, updatePlayer, gameSettings.controlType]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (id === 'singleplayer') {
          const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
          setCurrentUserId(playerId);
          const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
          const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
          updatePlayer(playerId, { id: playerId, x, y, health: 100, username: 'You' });
          initializeAIOpponents(AI_BOT_COUNT);
          setGameState('playing');

          // Add welcome notification
          addNotification("Welcome to Singleplayer Mode!", "#4CAF50", 3000);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/');
          return;
        }

        setCurrentUserId(user.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (profile) {
          const avatar_url = user.user_metadata?.avatar_url || null;
          const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
          const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
          updatePlayer(user.id, { x, y, health: 100, username: profile.username, avatar_url });

          if (id && id !== 'singleplayer') {
            await supabase
              .from('game_players')
              .insert({ game_id: id, player_id: user.id, position_x: x, position_y: y });

            await supabase
              .from('games')
              .update({ current_players: players.size + 1 })
              .eq('id', id);

            // Check if you're the host
            const { data: game } = await supabase
              .from('games')
              .select('host_id')
              .eq('id', id)
              .single();

            if (game && game.host_id === user.id) {
              // Show share link for host
              addNotification("Share the game link with friends to play together!", "#3498db", 5000);
              setTimeout(() => setShowShareLink(true), 1000);
            } else {
              // Welcome message for non-host
              addNotification("Welcome to the game! Get ready to play!", "#4CAF50", 3000);
            }
          }
        }

        setGameState('waiting');
      } catch (error) {
        console.error("Auth check error:", error);
        addNotification("Error connecting to game server", "#e74c3c", 5000);
      }
    };

    checkAuth();

    if (!isSingleplayer && id && id !== 'singleplayer') {
      const gameSubscription = supabase
        .channel(`game:${id}`)
        .on('presence', { event: 'sync' }, () => { })
        .on('presence', { event: 'join' }, () => {
          addNotification("A player has joined the game!", "#3498db", 3000);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          leftPresences.forEach((presence: any) => {
            addNotification(`${players.get(presence.user_id)?.username || 'A player'} has left the game`, "#e67e22", 3000);
            removePlayer(presence.user_id);
          });
        })
        .subscribe();

      return () => {
        gameSubscription.unsubscribe();
      };
    }
  }, [id, navigate, updatePlayer, removePlayer, players, isSingleplayer]);

  // Fix: Function now properly uses the notifications state
  const addNotification = (text: string, color: string, duration: number) => {
    setNotifications(prev => [
      ...prev,
      {
        text,
        color,
        duration,
        timeCreated: performance.now()
      }
    ]);
  };

  const initializeAIOpponents = (count: number) => {
    // Remove any existing AI opponents first
    for (const [playerId, player] of players.entries()) {
      if (player.isAI) removePlayer(playerId);
    }

    // Add new AI opponents
    for (let i = 0; i < count; i++) {
      const aiId = 'ai_' + Math.random().toString(36).substring(2, 9);
      // Spread out the initial positions to avoid clustering
      const x = Math.max(50, Math.min(CANVAS_WIDTH - 50,
        Math.random() * CANVAS_WIDTH * 0.8 + (i * CANVAS_WIDTH * 0.2 / count)));
      const y = Math.max(50, Math.min(CANVAS_HEIGHT - 50,
        Math.random() * CANVAS_HEIGHT * 0.8 + (i * CANVAS_HEIGHT * 0.2 / count)));

      // Random initial movement direction
      const angle = Math.random() * Math.PI * 2;
      const movementDirection = {
        x: Math.cos(angle),
        y: Math.sin(angle),
      };

      // Create with unique names and random colors
      const botNames = ["SniperBot", "ZigZagBot", "PredatorBot", "NinjaBot", "AssassinBot"];
      updatePlayer(aiId, {
        id: aiId,
        x,
        y,
        health: 100,
        username: botNames[i % botNames.length],
        isAI: true,
        aiState: {
          targetX: x,
          targetY: y,
          lastShotTime: 0,
          movementDirection,
          changeDirCounter: 0
        },
      });
    }
  };

  const loadPlayerAvatar = async (player: GamePlayer): Promise<HTMLImageElement | null> => {
    if (playerAvatars[player.id]) return playerAvatars[player.id];

    if (player.avatar_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => {
            const fallbackImg = createFallbackAvatar(player.username, PLAYER_SIZE);
            setPlayerAvatars(prev => ({ ...prev, [player.id]: fallbackImg }));
            resolve();
          };
          img.src = player.avatar_url || '';
        });
        setPlayerAvatars(prev => ({ ...prev, [player.id]: img }));
        return img;
      } catch (err) {
        console.error('Error loading avatar:', err);
      }
    }

    const fallbackAvatar = createFallbackAvatar(player.username, PLAYER_SIZE);
    setPlayerAvatars(prev => ({ ...prev, [player.id]: fallbackAvatar }));
    return fallbackAvatar;
  };

  const createFallbackAvatar = (username: string, size: number): HTMLImageElement | null => {
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const initial = username.charAt(0).toUpperCase();
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
    const colorIndex = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;

    ctx.beginPath();
    ctx.arc(size, size, size, 0, Math.PI * 2);
    ctx.fillStyle = colors[colorIndex];
    ctx.fill();

    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, size, size);

    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  };

  useEffect(() => {
    const loadAvatars = async () => {
      const newCache: PlayerAvatarCache = { ...playerAvatars };
      for (const [playerId, player] of players.entries()) {
        if (!newCache[playerId]) {
          const avatar = await loadPlayerAvatar(player);
          if (avatar) newCache[playerId] = avatar;
        }
      }
      setPlayerAvatars(newCache);
    };
    loadAvatars();
  }, [players]);

  const updateAIBehavior = () => {
    const currentPlayer = players.get(currentUserId || '');
    if (!currentPlayer || currentPlayer.health <= 0) return;

    players.forEach((playerValue, playerId) => {
      // Type assertion
      const player = playerValue as unknown as GamePlayer;

      // Skip if not an AI, or if AI is dead
      if (!player.isAI || player.health <= 0 || !player.aiState) return;

      const aiState = player.aiState;
      const distToPlayer = Math.hypot(currentPlayer.x - player.x, currentPlayer.y - player.y);
      const currentTime = performance.now();

      // AI behavior is different based on distance to player
      if (distToPlayer < AI_SIGHT_RANGE) {
        // Within sight range - react to player
        const dirX = currentPlayer.x - player.x;
        const dirY = currentPlayer.y - player.y;
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = length > 0 ? dirX / length : 0;
        const normalizedDirY = length > 0 ? dirY / length : 0;

        // Add some randomness to movement
        const randomFactor = 0.4;
        aiState.movementDirection = {
          x: normalizedDirX + (Math.random() * 2 - 1) * randomFactor,
          y: normalizedDirY + (Math.random() * 2 - 1) * randomFactor
        };

        // Normalize the direction
        const newLength = Math.sqrt(
          aiState.movementDirection.x * aiState.movementDirection.x +
          aiState.movementDirection.y * aiState.movementDirection.y
        );
        if (newLength > 0) {
          aiState.movementDirection.x /= newLength;
          aiState.movementDirection.y /= newLength;
        }

        // Shoot at player with some random spread
        const timeSinceLastShot = currentTime - aiState.lastShotTime;
        if (timeSinceLastShot > SHOT_COOLDOWN && Math.random() < AI_SHOT_CHANCE) {
          const spreadFactor = 0.2;
          const spreadX = (Math.random() * 2 - 1) * spreadFactor;
          const spreadY = (Math.random() * 2 - 1) * spreadFactor;
          const shootDirX = normalizedDirX + spreadX;
          const shootDirY = normalizedDirY + spreadY;
          const shootLength = Math.sqrt(shootDirX * shootDirX + shootDirY * shootDirY);
          const velocityX = 5 * (shootLength > 0 ? shootDirX / shootLength : 0);
          const velocityY = 5 * (shootLength > 0 ? shootDirY / shootLength : 0);

          setProjectiles(prev => [
            ...prev,
            {
              x: player.x,
              y: player.y,
              dx: velocityX,
              dy: velocityY,
              playerId,
              size: PROJECTILE_SIZE,
              color: '#FF0000',
              trail: [],
              timeCreated: currentTime
            }
          ]);
          aiState.lastShotTime = currentTime;
        }
      } else {
        // Random movement patterns when not near player
        aiState.changeDirCounter++;

        // Change direction more frequently to make movement more dynamic
        if (aiState.changeDirCounter >= 4) {
          aiState.changeDirCounter = 0;

          // Sometimes move toward center of map to avoid getting stuck in corners
          if (Math.random() < 0.3) {
            const centerX = CANVAS_WIDTH / 2;
            const centerY = CANVAS_HEIGHT / 2;
            const toCenter = {
              x: centerX - player.x,
              y: centerY - player.y
            };
            const dist = Math.sqrt(toCenter.x * toCenter.x + toCenter.y * toCenter.y);
            if (dist > 0) {
              aiState.movementDirection = {
                x: toCenter.x / dist,
                y: toCenter.y / dist
              };
            }
          } else {
            // Otherwise move in a random direction
            const randomAngle = Math.random() * Math.PI * 2;
            aiState.movementDirection = {
              x: Math.cos(randomAngle),
              y: Math.sin(randomAngle)
            };
          }
        }

        const timeSinceLastShot = performance.now() - aiState.lastShotTime;

        // Occasionally shoot in random directions even when player is not in sight
        if (timeSinceLastShot > SHOT_COOLDOWN * 1.5 && Math.random() < 0.1) {
          const randomAngle = Math.random() * Math.PI * 2;
          const velocityX = 5 * Math.cos(randomAngle);
          const velocityY = 5 * Math.sin(randomAngle);

          setProjectiles(prev => [
            ...prev,
            {
              x: player.x,
              y: player.y,
              dx: velocityX,
              dy: velocityY,
              playerId,
              size: PROJECTILE_SIZE,
              color: '#FF0000',
              trail: [],
              timeCreated: currentTime
            }
          ]);
          aiState.lastShotTime = currentTime;
        }
      }

      // Move the AI bot
      const moveSpeed = AI_MOVEMENT_SPEED;
      let newX = player.x + aiState.movementDirection.x * moveSpeed;
      let newY = player.y + aiState.movementDirection.y * moveSpeed;

      // Bounce off the walls to stay in bounds
      if (newX < PLAYER_SIZE || newX > CANVAS_WIDTH - PLAYER_SIZE) {
        aiState.movementDirection.x *= -1;
        newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, newX));
      }
      if (newY < PLAYER_SIZE || newY > CANVAS_HEIGHT - PLAYER_SIZE) {
        aiState.movementDirection.y *= -1;
        newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, newY));
      }

      updatePlayer(playerId, {
        x: newX,
        y: newY,
        aiState: { ...aiState, targetX: newX, targetY: newY }
      });
    });
  };

  // Fix: This function now properly uses the particles state
  const createParticleEffect = (x: number, y: number, count: number, color: string) => {
    // Fix: Add explicit type for particlesArray
    const particlesArray: {
      x: number;
      y: number;
      dx: number;
      dy: number;
      size: number;
      color: string;
      life: number;
      maxLife: number;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;

      particlesArray.push({
        x: x,
        y: y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        size: 1 + Math.random() * 3,
        color: color,
        life: 1.0,
        maxLife: 0.5 + Math.random() * 0.5
      });
    }

    setParticles(prev => [
      ...prev,
      {
        x,
        y,
        particles: particlesArray,
        timeCreated: performance.now()
      }
    ]);
  };

  // Fix: This function now properly uses the damageNumbers state
  const createDamageNumber = (x: number, y: number, damage: number) => {
    const angle = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
    const speed = 1 + Math.random() * 0.5;

    setDamageNumbers(prev => [
      ...prev,
      {
        x,
        y,
        value: damage,
        color: '#FF5555',
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        opacity: 1,
        scale: 1,
        timeCreated: performance.now()
      }
    ]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrameTimestamp = performance.now();

    const draw = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTimestamp;
      lastFrameTimestamp = currentTime;

      // Calculate FPS
      const now = performance.now();
      const times = fpsTimestamps.current;
      times.push(now);

      while (times[0] < now - 1000) {
        times.shift();
      }

      setFps(times.length);

      // Skip animation frames if we're in tutorial mode
      if (showTutorial) {
        requestAnimationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      if (isSingleplayer) {
        aiUpdateTimeRef.current += deltaTime;
        if (aiUpdateTimeRef.current >= AI_UPDATE_INTERVAL) {
          updateAIBehavior();
          aiUpdateTimeRef.current = 0;
        }
      }

      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background based on graphics quality
      if (gameSettings.graphicsQuality === 'high') {
        // Grid background for high quality
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.strokeStyle = '#2a2a4e';
        ctx.lineWidth = 1;

        // Draw vertical grid lines
        for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, CANVAS_HEIGHT);
          ctx.stroke();
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(CANVAS_WIDTH, y);
          ctx.stroke();
        }
      } else {
        // Simple background for medium/low quality
        ctx.fillStyle = gameSettings.graphicsQuality === 'medium' ? '#1a1a2e' : '#111122';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Draw players
      players.forEach((player) => {
        if (player.health <= 0) return;

        // Draw player hit effect
        if (player.lastHitTime && performance.now() - player.lastHitTime < 200) {
          const hitEffectSize = PLAYER_SIZE + 5;
          ctx.beginPath();
          ctx.arc(player.x, player.y, hitEffectSize, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fill();
        }

        // Draw player avatar
        const avatar = playerAvatars[player.id];
        if (avatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, player.x - PLAYER_SIZE, player.y - PLAYER_SIZE, PLAYER_SIZE * 2, PLAYER_SIZE * 2);

          // Highlight current player
          if (player.id === currentUserId) {
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          ctx.restore();
        } else {
          // Fallback if avatar not loaded
          ctx.fillStyle = player.id === currentUserId ? '#4CAF50' : (player.isAI ? '#F44336' : '#2196F3');
          ctx.beginPath();
          ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
          ctx.fill();
          loadPlayerAvatar(player);
        }

        // Draw health bar
        const healthBarWidth = 40;
        const healthBarHeight = 4;
        const healthBarX = player.x - healthBarWidth / 2;
        const healthBarY = player.y - PLAYER_SIZE - 15;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

        // Health fill
        const healthPercentage = player.health / 100;
        const healthColor = healthPercentage > 0.6 ? '#4CAF50' : healthPercentage > 0.3 ? '#FFC107' : '#F44336';
        ctx.fillStyle = healthColor;
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);

        // Health text and username
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.health} HP`, player.x, player.y - 20);
        ctx.fillText(player.username, player.x, player.y - 35);
      });

      // Draw projectiles
      setProjectiles(prev => {
        const updatedProjectiles = prev.map(proj => {
          const newX = proj.x + proj.dx;
          const newY = proj.y + proj.dy;
          if (newX < 0 || newX > CANVAS_WIDTH || newY < 0 || newY > CANVAS_HEIGHT) return null;

          // Add trail points for high quality
          let trail = proj.trail;
          if (gameSettings.graphicsQuality === 'high') {
            trail = [{ x: proj.x, y: proj.y }, ...trail.slice(0, 5)];
          }

          return { ...proj, x: newX, y: newY, trail };
        }).filter((proj): proj is Projectile => proj !== null);

        // Draw projectiles based on graphics quality
        updatedProjectiles.forEach(proj => {
          // Draw trail for high and medium quality
          if ((gameSettings.graphicsQuality === 'high' || gameSettings.graphicsQuality === 'medium') && proj.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(proj.x, proj.y);

            for (let i = 0; i < proj.trail.length; i++) {
              ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
            }

            // Make trail glow effect more visible
            ctx.strokeStyle = proj.playerId === currentUserId ? 'rgba(76, 175, 80, 0.6)' : 'rgba(255, 85, 85, 0.6)';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          // Draw projectile with larger size
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);

          // Brighter colors for better visibility
          if (proj.playerId === currentUserId) {
            // Player projectiles: bright green with gradient
            const gradient = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, proj.size);
            gradient.addColorStop(0, '#AAFFAA');
            gradient.addColorStop(1, '#4CAF50');
            ctx.fillStyle = gradient;
          } else {
            // Enemy projectiles: bright red with gradient
            const gradient = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, proj.size);
            gradient.addColorStop(0, '#FFAAAA');
            gradient.addColorStop(1, '#FF5555');
            ctx.fillStyle = gradient;
          }
          ctx.fill();

          // Draw glow for all quality levels
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.size + 4, 0, Math.PI * 2);
          ctx.fillStyle = proj.playerId === currentUserId ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 85, 85, 0.3)';
          ctx.fill();
        });
        return updatedProjectiles;
      });

      // Update and draw particles
      setParticles(prev => {
        const currentTime = performance.now();
        return prev
          .filter(effect => currentTime - effect.timeCreated < 2000)
          .map(effect => {
            const updatedParticles = effect.particles.map(p => {
              p.x += p.dx;
              p.y += p.dy;
              p.life -= 0.016 / p.maxLife; // Reduce life based on frame time
              return p;
            }).filter(p => p.life > 0);

            // Draw particles
            updatedParticles.forEach(p => {
              ctx.globalAlpha = p.life;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = p.color;
              ctx.fill();
            });
            ctx.globalAlpha = 1;

            return { ...effect, particles: updatedParticles };
          })
          .filter(effect => effect.particles.length > 0);
      });

      // Update and draw damage numbers
      setDamageNumbers(prev => {
        const currentTime = performance.now();
        return prev
          .filter(dmg => currentTime - dmg.timeCreated < 1000)
          .map(dmg => {
            // Update position and properties
            dmg.x += dmg.velocity.x;
            dmg.y += dmg.velocity.y;
            dmg.opacity = 1 - (currentTime - dmg.timeCreated) / 1000;
            dmg.scale = 1 + (currentTime - dmg.timeCreated) / 1000 * 0.5;

            // Draw damage number
            ctx.globalAlpha = dmg.opacity;
            ctx.fillStyle = dmg.color;
            ctx.font = `bold ${Math.floor(16 * dmg.scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(`-${dmg.value}`, dmg.x, dmg.y);
            ctx.globalAlpha = 1;

            return dmg;
          });
      });

      // Update and draw notifications
      setNotifications(prev => {
        const currentTime = performance.now();
        const validNotifications = prev.filter(notif =>
          currentTime - notif.timeCreated < notif.duration
        );

        // Draw notifications
        validNotifications.forEach((notif, index) => {
          const elapsed = currentTime - notif.timeCreated;
          const progress = Math.min(1, elapsed / 500); // Fade in over 500ms
          const fadeOut = Math.max(0, 1 - (elapsed - (notif.duration - 500)) / 500); // Fade out over last 500ms
          const opacity = Math.min(progress, fadeOut);

          ctx.globalAlpha = opacity;
          ctx.fillStyle = notif.color;
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(notif.text, CANVAS_WIDTH / 2, 30 + index * 25);
          ctx.globalAlpha = 1;
        });

        return validNotifications;
      });

      // Check for projectile collisions
      setProjectiles(prev => {
        const newProjectiles = prev.map((projectile: Projectile) => {
          const newX = projectile.x + projectile.dx;
          const newY = projectile.y + projectile.dy;

          if (newX < 0 || newX > CANVAS_WIDTH || newY < 0 || newY > CANVAS_HEIGHT) return null;

          let hitPlayer = false;
          players.forEach((player: GamePlayer) => {
            if (
              player.health > 0 &&
              projectile.playerId !== player.id &&
              !player.invulnerable &&
              Math.hypot(newX - player.x, newY - player.y) < PLAYER_SIZE + PROJECTILE_SIZE
            ) {
              hitPlayer = true;
              const damage = 20;
              const newHealth = Math.max(0, player.health - damage);

              // Create hit effects
              createParticleEffect(newX, newY, 15, '#FF5555');
              createDamageNumber(player.x, player.y - PLAYER_SIZE - 10, damage);

              // Update player with hit effect
              updatePlayer(player.id, {
                health: newHealth,
                lastHitTime: performance.now()
              });

              // Handle hit by current player
              if (projectile.playerId === currentUserId) {
                // Add hit sound effect
                if (gameSettings.sfxEnabled) {
                  const hitSound = new Audio('/hit.mp3'); // This would be a real sound file in production
                  hitSound.volume = gameSettings.volume / 100;
                  hitSound.play().catch(e => console.error('Error playing sound:', e));
                }

                // Update stats
                setGameStats(prev => ({
                  ...prev,
                  shotsHit: prev.shotsHit + 1,
                  ...(newHealth === 0 && {
                    killCount: prev.killCount + 1,
                    eliminations: [...prev.eliminations, player.id],
                    killedInRow: prev.killedInRow + 1,
                    firstKill: prev.killCount === 0 ? true : prev.firstKill,
                    lastKill: prev.eliminations.length + 1 === players.size - 1 ? true : prev.lastKill,
                    multiKills: (() => {
                      const now = performance.now();
                      const multiKills = [...prev.multiKills];
                      if (lastTimeRef.current > 0 && now - lastTimeRef.current < 5000) {
                        const lastMultiKill = multiKills[multiKills.length - 1];
                        if (lastMultiKill && now - lastMultiKill.timespan < 5000) {
                          lastMultiKill.count++;
                          lastMultiKill.timespan = now;
                        } else {
                          multiKills.push({ count: 2, timespan: now });
                        }
                      }
                      lastTimeRef.current = now;
                      return multiKills;
                    })()
                  })
                }));

                // Show kill notification
                if (newHealth === 0) {
                  addNotification(`You eliminated ${player.username}!`, "#4CAF50", 3000);
                }
              }

              // Handle being hit as current player
              if (player.id === currentUserId) {
                // Add damage sound effect
                if (gameSettings.sfxEnabled) {
                  const damageSound = new Audio('/damage.mp3'); // This would be a real sound file in production
                  damageSound.volume = gameSettings.volume / 100;
                  damageSound.play().catch(e => console.error('Error playing sound:', e));
                }

                // Update stats
                setGameStats(prev => ({
                  ...prev,
                  damageReceived: prev.damageReceived + damage,
                  lowestHealth: newHealth < prev.lowestHealth ? newHealth : prev.lowestHealth
                }));

                // Show damage notification
                addNotification(`${damage} damage from ${players.get(projectile.playerId)?.username || 'Player'}!`, "#F44336", 2000);
              }
            }
          });

          return hitPlayer ? null : { ...projectile, x: newX, y: newY };
        }).filter((p): p is Projectile => p !== null);

        const activePlayers = Array.from(players.values()).filter(p => p.health > 0);
        if (activePlayers.length === 1 && gameState === 'playing') {
          const winner = activePlayers[0];
          if (winner.id === currentUserId) {
            addNotification("Victory! You are the last player standing!", "#4CAF50", 5000);
          } else {
            addNotification(`${winner.username} wins the game!`, "#FF9800", 5000);
          }
          handleGameEnd(winner.id === currentUserId);
        } else if (activePlayers.length >= 2 && gameState === 'waiting') {
          setGameState('playing');
          addNotification("Game started! Last player standing wins!", "#3498db", 3000);
        }

        return newProjectiles;
      });

      // Draw cooldown indicator
      if (currentUserId) {
        const currentPlayer = players.get(currentUserId);
        if (currentPlayer && currentPlayer.health > 0) {
          const cooldownBarWidth = 100;
          const cooldownBarHeight = 10;
          const cooldownBarX = (CANVAS_WIDTH - cooldownBarWidth) / 2;
          const cooldownBarY = CANVAS_HEIGHT - 30;

          // Background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(cooldownBarX, cooldownBarY, cooldownBarWidth, cooldownBarHeight);

          if (!canShoot) {
            // Draw cooldown progress
            const timeElapsed = performance.now() - (performance.now() - (SHOT_COOLDOWN - (performance.now() % SHOT_COOLDOWN)));
            const cooldownProgress = timeElapsed / SHOT_COOLDOWN;
            ctx.fillStyle = '#FFC107';
            ctx.fillRect(cooldownBarX, cooldownBarY, cooldownBarWidth * cooldownProgress, cooldownBarHeight);

            // Draw text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Reloading...', CANVAS_WIDTH / 2, cooldownBarY - 5);
          } else {
            // Draw available shots
            const shotWidth = cooldownBarWidth / MAX_SHOTS;
            for (let i = 0; i < MAX_SHOTS - shotCount; i++) {
              ctx.fillStyle = '#4CAF50';
              ctx.fillRect(cooldownBarX + i * shotWidth, cooldownBarY, shotWidth - 1, cooldownBarHeight);
            }

            // Draw text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${MAX_SHOTS - shotCount} Shots Available`, CANVAS_WIDTH / 2, cooldownBarY - 5);
          }
        }
      }

      // Draw FPS counter if enabled
      if (gameSettings.showFps) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(5, 5, 60, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`FPS: ${fps}`, 10, 18);
      }

      if (gameState !== 'finished') {
        requestAnimationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    requestAnimationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestAnimationFrameRef.current) cancelAnimationFrame(requestAnimationFrameRef.current);
    };
  }, [players, currentUserId, gameState, updatePlayer, playerAvatars, isSingleplayer, gameSettings, showTutorial]);

  const handleGameEnd = async (isWinner: boolean) => {
    setGameState('finished');
    if (!currentUserId || isSingleplayer) return;

    const { data: leaderboardEntry } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('player_id', currentUserId)
      .single();

    if (leaderboardEntry) {
      await supabase
        .from('leaderboard')
        .update({
          wins: isWinner ? leaderboardEntry.wins + 1 : leaderboardEntry.wins,
          total_kills: leaderboardEntry.total_kills + gameStats.killCount,
          total_shots: leaderboardEntry.total_shots + gameStats.shotsFired,
          shots_hit: leaderboardEntry.shots_hit + gameStats.shotsHit,
          games_played: leaderboardEntry.games_played + 1
        })
        .eq('player_id', currentUserId);
    }

    if (id && id !== 'singleplayer') {
      await supabase
        .from('game_players')
        .update({ kills: gameStats.killCount, shots_fired: gameStats.shotsFired, shots_hit: gameStats.shotsHit })
        .eq('game_id', id)
        .eq('player_id', currentUserId);

      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', id);
    }

    const currentPlayer = players.get(currentUserId);

    const gameData: GameCompletionData = {
      gameId: id || 'singleplayer',
      playerId: currentUserId,
      winner: isWinner,
      killCount: gameStats.killCount,
      finalHealth: currentPlayer ? currentPlayer.health : 0,
      damageReceived: gameStats.damageReceived,
      shotsFired: gameStats.shotsFired,
      shotsHit: gameStats.shotsHit,
      accuracy: gameStats.shotsFired > 0 ? (gameStats.shotsHit / gameStats.shotsFired) * 100 : 0,
      eliminations: gameStats.eliminations,
      eliminatedAllPlayers: gameStats.eliminations.length === players.size - 1,
      firstKill: gameStats.firstKill,
      lastKill: gameStats.lastKill,
      killedInRow: gameStats.killedInRow,
      multiKills: gameStats.multiKills,
      lowestHealth: gameStats.lowestHealth,
      timeWithLowHealth: lowHealthTimeRef.current
    };

    const unlockedAchievements = await achievementService.checkGameAchievements(gameData);
    if (unlockedAchievements.length > 0) {
      const { data: achievement } = await supabase
        .from('achievements')
        .select('name, description')
        .eq('id', unlockedAchievements[0])
        .single();
      if (achievement) setUnlockingAchievement(achievement);
    }
  };

  const fireProjectile = (targetX: number, targetY: number) => {
    if (!canShoot || shotCount >= MAX_SHOTS || !currentUserId || showTutorial) return;

    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;

    const angle = Math.atan2(targetY - currentPlayer.y, targetX - currentPlayer.x);
    const velocity = 5;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;

    // Create new projectile
    setProjectiles(prev => [
      ...prev,
      {
        x: currentPlayer.x,
        y: currentPlayer.y,
        dx,
        dy,
        playerId: currentUserId,
        size: PROJECTILE_SIZE,
        color: '#4CAF50',
        trail: [],
        timeCreated: performance.now()
      }
    ]);

    // Play shoot sound
    if (gameSettings.sfxEnabled) {
      const shootSound = new Audio('/shoot.mp3'); // This would be a real sound file in production
      shootSound.volume = gameSettings.volume / 100;
      shootSound.play().catch(e => console.error('Error playing sound:', e));
    }

    // Update stats
    setGameStats(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));

    // Update shot count and handle cooldown
    setShotCount(prev => {
      const newCount = prev + 1;
      if (newCount >= MAX_SHOTS) {
        setCanShoot(false);
        setTimeout(() => {
          setCanShoot(true);
          setShotCount(0);

          // Play reload sound
          if (gameSettings.sfxEnabled) {
            const reloadSound = new Audio('/reload.mp3'); // This would be a real sound file in production
            reloadSound.volume = gameSettings.volume / 100;
            reloadSound.play().catch(e => console.error('Error playing sound:', e));
          }
        }, SHOT_COOLDOWN);
      }
      return newCount;
    });
  };

  const handleShoot = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canShoot || shotCount >= MAX_SHOTS || !currentUserId || showTutorial) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    fireProjectile(x, y);
  };

  const handleMobileMove = (dx: number, dy: number) => {
    if (!currentUserId || showTutorial) return;

    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;

    const moveSpeed = 5;
    const newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, currentPlayer.x + dx * moveSpeed));
    const newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, currentPlayer.y + dy * moveSpeed));

    if (newX !== currentPlayer.x || newY !== currentPlayer.y) {
      updatePlayer(currentUserId, { x: newX, y: newY });
    }
  };

  const handleMobileShoot = (x: number, y: number) => {
    if (showTutorial) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    fireProjectile(canvasX, canvasY);
  };

  const handleReturnToLobby = () => {
    navigate('/game/lobby');
  };

  const handleRestart = () => {
    if (isSingleplayer) {
      const currentPlayer = players.get(currentUserId || '');
      if (currentPlayer) {
        const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
        const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
        updatePlayer(currentUserId || '', { x, y, health: 100 });
      }

      for (const [playerId, player] of players.entries()) {
        if (player.isAI) removePlayer(playerId);
      }

      initializeAIOpponents(AI_BOT_COUNT);
      setGameState('playing');
      setProjectiles([]);
      setParticles([]);
      setDamageNumbers([]);
      setNotifications([]);
      setShotCount(0);
      setCanShoot(true);
      addNotification("New game started!", "#4CAF50", 3000);
      setGameStats({
        killCount: 0,
        shotsFired: 0,
        shotsHit: 0,
        damageReceived: 0,
        lowestHealth: 100,
        timeWithLowHealth: 0,
        eliminations: [],
        killedInRow: 0,
        multiKills: [],
        firstKill: false,
        lastKill: false
      });
      lowHealthTimeRef.current = 0;
      lastTimeRef.current = 0;
    } else {
      navigate('/game/lobby');
    }
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    setTutorialStep(0);

    // Update settings to not show tutorial again
    const updatedSettings = {
      ...gameSettings,
      showTutorialOnStart: false
    };

    setGameSettings(updatedSettings);
    localStorage.setItem('gameSettings', JSON.stringify(updatedSettings));
  };

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

  const handleShareGame = () => {
    setShowShareDialog(true);
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4" tabIndex={0}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleShoot}
          className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700"
        />

        {/* Game Info Overlay */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-lg flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>
            {isSingleplayer ? 'Singleplayer' : `${Array.from(players.values()).filter(p => p.health > 0).length} Players`}
          </span>
        </div>

        {/* Help Button */}
        <button
          onClick={() => setShowTutorial(true)}
          className="absolute top-4 left-4 bg-indigo-600 text-white p-1 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          title="Show Tutorial"
        >
          <HelpCircle size={20} />
        </button>

        {/* Exit Button */}
        <button
          onClick={handleReturnToLobby}
          className="absolute top-16 left-4 bg-red-600 text-white p-2 rounded-lg flex items-center gap-2 shadow-lg hover:bg-red-700 transition-colors"
          title="Exit Game"
        >
          <LogOut size={18} />
          <span>Exit Game</span>
        </button>

        {/* Share Game Modal */}
        {showShareDialog && !isSingleplayer && (
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

        {/* Share Game Button (only for hosts in waiting state) */}
        {showShareLink && !isSingleplayer && (
          <button
            onClick={handleShareGame}
            className="absolute top-16 right-4 bg-indigo-600 text-white p-2 rounded-lg flex items-center gap-2 shadow-lg cursor-pointer hover:bg-indigo-700 transition-colors"
          >
            <Share2 size={16} />
            <span>Share Game</span>
          </button>
        )}


        {/* Game Over Overlay */}
        {gameState === 'finished' && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg">
            <h2 className="text-3xl font-bold text-white mb-4">Game Over</h2>
            {Array.from(players.values()).find(p => p.health > 0) && (
              <div className="mb-6">
                <div className="flex flex-col items-center">
                  <Avatar
                    username={Array.from(players.values()).find(p => p.health > 0)?.username || 'Winner'}
                    imageUrl={Array.from(players.values()).find(p => p.health > 0)?.avatar_url}
                    size="lg"
                    className="mb-2"
                  />
                  <p className="text-xl text-white">
                    Winner: {Array.from(players.values()).find(p => p.health > 0)?.username}
                  </p>
                </div>
              </div>
            )}
            <p className="text-xl text-white mb-6">
              {currentUserId && players.get(currentUserId) && players.get(currentUserId)!.health > 0 ? 'You Won!' : 'Better luck next time!'}
            </p>

            <div className="bg-gray-800 p-4 rounded-lg mb-8 w-64 shadow-lg">
              <h3 className="text-white text-center mb-4 font-semibold">Your Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Kills</p>
                  <p className="text-2xl font-bold text-white">{gameStats.killCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Accuracy</p>
                  <p className="text-2xl font-bold text-white">
                    {gameStats.shotsFired > 0 ? `${Math.round((gameStats.shotsHit / gameStats.shotsFired) * 100)}%` : '0%'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Damage Dealt</p>
                  <p className="text-2xl font-bold text-white">{gameStats.shotsHit * 20}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Damage Taken</p>
                  <p className="text-2xl font-bold text-white">{gameStats.damageReceived}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-700 hover:to-green-600 transition-all duration-200 shadow-lg flex items-center gap-2"
              >
                <RefreshCw size={18} />
                {isSingleplayer ? 'Play Again' : 'Return to Lobby'}
              </button>
              {isSingleplayer && (
                <button
                  onClick={handleReturnToLobby}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-all duration-200 shadow-lg flex items-center gap-2"
                >
                  <LogOut size={18} />
                  Main Menu
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tutorial Overlay */}
        {showTutorial && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-lg">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl border border-indigo-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{tutorialSteps[tutorialStep].title}</h3>
                <button
                  onClick={handleCloseTutorial}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-gray-300 mb-6">{tutorialSteps[tutorialStep].content}</p>

              <div className="flex justify-between">
                <button
                  onClick={() => setTutorialStep(Math.max(0, tutorialStep - 1))}
                  className={`px-4 py-2 rounded-lg ${tutorialStep === 0
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                    } transition-colors`}
                  disabled={tutorialStep === 0}
                >
                  Previous
                </button>

                {tutorialStep < tutorialSteps.length - 1 ? (
                  <button
                    onClick={() => setTutorialStep(tutorialStep + 1)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleCloseTutorial}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <Check size={16} /> Start Playing
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      {isMobile && !showTutorial && <MobileControls onMove={handleMobileMove} onShoot={handleMobileShoot} />}

      {/* Achievement Notification */}
      <AchievementNotification achievement={unlockingAchievement} onClose={() => setUnlockingAchievement(null)} />
    </div>
  );
}