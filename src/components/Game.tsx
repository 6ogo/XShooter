import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { AchievementNotification } from './AchievementNotification';
import { Avatar } from './Avatar';
import { achievementService, GameCompletionData } from '../lib/achievementService';
import { MobileControls } from './MobileControls';
import { Share2, RefreshCw, LogOut, HelpCircle, X, Check, ChevronRight } from 'lucide-react';
import { ShareGame } from './ShareGame';

// Game constants - moved to the top for easier configuration
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const PROJECTILE_SIZE = 8;
const SHOT_COOLDOWN = 3000;
const MAX_SHOTS = 5;
const SHOT_DAMAGE = 20;
const AI_UPDATE_INTERVAL = 250; // More responsive AI
const AI_SIGHT_RANGE = 350; // Increased sight range
const AI_SHOT_CHANCE = 0.5; // Slightly reduced to balance difficulty
const AI_MOVEMENT_SPEED = 3.5; // Increased for more dynamic gameplay
const AI_BOT_COUNT = 3;
const PLAYER_MOVEMENT_SPEED = 5;
const PROJECTILE_SPEED = 6; // Increased for more dynamic gameplay
const HIT_EFFECT_DURATION = 300; // Longer visual feedback
const LOW_HEALTH_THRESHOLD = 30; // Define low health for achievements

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
  personality?: 'aggressive' | 'defensive' | 'sniper' | 'erratic';
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
  lastMoveTime?: number;
  velocity?: { x: number; y: number };
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

  // Game state
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [particles, setParticles] = useState<ParticleEffect[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

  // Refs for game loop timing
  const lowHealthTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const aiUpdateTimeRef = useRef(0);
  const requestAnimationFrameRef = useRef<number | null>(null);
  const fpsTimestamps = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(performance.now());
  const gameLoopRef = useRef<(time: number) => void>();

  // Input handling
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
    lastFrameTime.current = performance.now();

    return () => {
      const sessionTime = performance.now() - lastFrameTime.current;
      console.log(`Game session lasted ${Math.round(sessionTime / 1000)} seconds`);
    };
  }, [gameSettings.showTutorialOnStart]);

  // Keyboard input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process key events if we're not in tutorial mode
      if (showTutorial) return;

      // Determine which keys to use based on settings
      const movementKeys = gameSettings.controlType === 'wasd'
        ? ['w', 'a', 's', 'd']
        : ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];

      if ([...movementKeys, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        // Prevent default behavior to avoid scrolling the page when using arrow keys
        e.preventDefault();
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

  // Check if device is mobile
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

  // Player movement based on keyboard input
  useEffect(() => {
    if (!currentUserId) return;

    const handleMovement = () => {
      const currentPlayer = players.get(currentUserId);
      if (!currentPlayer || currentPlayer.health <= 0) return;

      const moveSpeed = PLAYER_MOVEMENT_SPEED;
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

      // Normalize diagonal movement to prevent faster diagonal speed
      if (dx !== 0 && dy !== 0) {
        const factor = 1 / Math.sqrt(2);
        dx *= factor;
        dy *= factor;
      }

      if (dx !== 0 || dy !== 0) {
        const newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, currentPlayer.x + dx));
        const newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, currentPlayer.y + dy));

        // Update player position and store velocity for visual effects
        updatePlayer(currentUserId, {
          x: newX,
          y: newY,
          lastMoveTime: performance.now(),
          velocity: { x: dx, y: dy }
        });
      } else if (currentPlayer.velocity && (currentPlayer.velocity.x !== 0 || currentPlayer.velocity.y !== 0)) {
        // Reset velocity when stopped
        updatePlayer(currentUserId, { velocity: { x: 0, y: 0 } });
      }
    };

    const movementInterval = setInterval(handleMovement, 16);
    return () => clearInterval(movementInterval);
  }, [keys, currentUserId, players, updatePlayer, gameSettings.controlType]);

  // Initialize the game and authentication
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

  // Notification system
  const addNotification = useCallback((text: string, color: string, duration: number) => {
    setNotifications(prev => [
      ...prev,
      {
        text,
        color,
        duration,
        timeCreated: performance.now()
      }
    ]);
  }, []);

  // Initialize AI opponents with different personalities for more dynamic gameplay
  const initializeAIOpponents = useCallback((count: number) => {
    // Remove any existing AI opponents first
    for (const [playerId, player] of players.entries()) {
      if (player.isAI) removePlayer(playerId);
    }

    // AI personality types for variety
    const personalities: ('aggressive' | 'defensive' | 'sniper' | 'erratic')[] =
      ['aggressive', 'defensive', 'sniper', 'erratic'];

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

      // Assign personality
      const personality = personalities[i % personalities.length];

      // Create with unique names based on personality
      const botNames = {
        'aggressive': ["PredatorBot", "HunterBot", "RusherBot"],
        'defensive': ["GuardianBot", "ShieldBot", "DefenderBot"],
        'sniper': ["SniperBot", "SharpshooterBot", "MarksmanBot"],
        'erratic': ["ZigZagBot", "ChaosBot", "TricksterBot"]
      };

      const nameList = botNames[personality];
      const botName = nameList[Math.floor(Math.random() * nameList.length)];

      updatePlayer(aiId, {
        id: aiId,
        x,
        y,
        health: 100,
        username: botName,
        isAI: true,
        aiState: {
          targetX: x,
          targetY: y,
          lastShotTime: 0,
          movementDirection,
          changeDirCounter: 0,
          personality
        },
      });
    }
  }, [players, removePlayer, updatePlayer]);

  // Load player avatars
  const loadPlayerAvatar = useCallback(async (player: GamePlayer): Promise<HTMLImageElement | null> => {
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
  }, [playerAvatars]);

  // Create fallback avatar
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

  // Load avatars for all players
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
  }, [players, loadPlayerAvatar, playerAvatars]);
  // Create particle effects for visual feedback
  const createParticleEffect = useCallback((x: number, y: number, count: number, color: string) => {
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
  }, []);

  // AI behavior update - improved with different personality types
  const updateAIBehavior = useCallback(() => {
    const currentPlayer = players.get(currentUserId || '');
    if (!currentPlayer || currentPlayer.health <= 0) return;

    players.forEach((playerValue, playerId) => {
      // Type assertion
      const player = playerValue as unknown as GamePlayer;

      // Skip if not an AI, or if AI is dead
      if (!player.isAI || player.health <= 0 || !player.aiState) return;

      const aiState = player.aiState;
      const personality = aiState.personality || 'aggressive';
      const distToPlayer = Math.hypot(currentPlayer.x - player.x, currentPlayer.y - player.y);
      const currentTime = performance.now();

      // Base AI behavior - different for each personality type
      if (distToPlayer < AI_SIGHT_RANGE) {
        // Within sight range - react based on personality
        const dirX = currentPlayer.x - player.x;
        const dirY = currentPlayer.y - player.y;
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = length > 0 ? dirX / length : 0;
        const normalizedDirY = length > 0 ? dirY / length : 0;

        // Adjust movement based on personality
        switch (personality) {
          case 'aggressive':
            // Aggressive bots move directly toward the player
            aiState.movementDirection = {
              x: normalizedDirX + (Math.random() * 0.4 - 0.2),
              y: normalizedDirY + (Math.random() * 0.4 - 0.2)
            };
            break;

          case 'defensive':
            // Defensive bots maintain distance
            if (distToPlayer < 200) {
              // Move away if too close
              aiState.movementDirection = {
                x: -normalizedDirX + (Math.random() * 0.4 - 0.2),
                y: -normalizedDirY + (Math.random() * 0.4 - 0.2)
              };
            } else {
              // Strafe sideways if at good distance
              aiState.movementDirection = {
                x: normalizedDirY + (Math.random() * 0.3 - 0.15),
                y: -normalizedDirX + (Math.random() * 0.3 - 0.15)
              };
            }
            break;

          case 'sniper':
            // Sniper bots try to stay at medium distance and minimize movement
            if (distToPlayer < 150) {
              // Back away if too close
              aiState.movementDirection = {
                x: -normalizedDirX,
                y: -normalizedDirY
              };
            } else if (distToPlayer > 250) {
              // Move closer if too far
              aiState.movementDirection = {
                x: normalizedDirX * 0.5,
                y: normalizedDirY * 0.5
              };
            } else {
              // Minimal movement at ideal range
              aiState.movementDirection = {
                x: (Math.random() * 0.4 - 0.2),
                y: (Math.random() * 0.4 - 0.2)
              };
            }
            break;

          case 'erratic':
            // Erratic bots move unpredictably
            if (Math.random() < 0.05) {
              // Occasionally change direction completely
              const randomAngle = Math.random() * Math.PI * 2;
              aiState.movementDirection = {
                x: Math.cos(randomAngle),
                y: Math.sin(randomAngle)
              };
            } else {
              // Otherwise do zig-zag movements
              aiState.movementDirection = {
                x: normalizedDirX + Math.sin(currentTime / 200) * 0.8,
                y: normalizedDirY + Math.cos(currentTime / 200) * 0.8
              };
            }
            break;
        }

        // Normalize the direction
        const newLength = Math.sqrt(
          aiState.movementDirection.x * aiState.movementDirection.x +
          aiState.movementDirection.y * aiState.movementDirection.y
        );
        if (newLength > 0) {
          aiState.movementDirection.x /= newLength;
          aiState.movementDirection.y /= newLength;
        }

        // Shoot at player with varying accuracy based on personality
        const timeSinceLastShot = currentTime - aiState.lastShotTime;
        const minCooldown = personality === 'sniper' ? SHOT_COOLDOWN * 1.2 :
          personality === 'aggressive' ? SHOT_COOLDOWN * 0.8 :
            SHOT_COOLDOWN;

        // Different shooting behavior based on personality
        if (timeSinceLastShot > minCooldown) {
          let shouldShoot = false;
          let spreadFactor = 0.2; // Default spread

          switch (personality) {
            case 'aggressive':
              shouldShoot = Math.random() < AI_SHOT_CHANCE * 1.3; // More likely to shoot
              spreadFactor = 0.25; // Less accurate
              break;
            case 'defensive':
              shouldShoot = Math.random() < AI_SHOT_CHANCE * 0.8 && distToPlayer > 150;
              spreadFactor = 0.2;
              break;
            case 'sniper':
              shouldShoot = Math.random() < AI_SHOT_CHANCE * 1.1;
              spreadFactor = 0.1; // More accurate
              break;
            case 'erratic':
              shouldShoot = Math.random() < AI_SHOT_CHANCE;
              spreadFactor = 0.3 * Math.random(); // Wildly variable accuracy
              break;
          }

          if (shouldShoot) {
            const spreadX = (Math.random() * 2 - 1) * spreadFactor;
            const spreadY = (Math.random() * 2 - 1) * spreadFactor;
            const shootDirX = normalizedDirX + spreadX;
            const shootDirY = normalizedDirY + spreadY;
            const shootLength = Math.sqrt(shootDirX * shootDirX + shootDirY * shootDirY);
            const velocityX = PROJECTILE_SPEED * (shootLength > 0 ? shootDirX / shootLength : 0);
            const velocityY = PROJECTILE_SPEED * (shootLength > 0 ? shootDirY / shootLength : 0);

            // Color based on personality
            const projectileColors = {
              'aggressive': '#FF3A3A', // Bright red
              'defensive': '#3A9BFF', // Blue
              'sniper': '#FFAA3A', // Orange
              'erratic': '#AA3AFF'  // Purple
            };

            setProjectiles(prev => [
              ...prev,
              {
                x: player.x,
                y: player.y,
                dx: velocityX,
                dy: velocityY,
                playerId,
                size: PROJECTILE_SIZE,
                color: projectileColors[personality],
                trail: [],
                timeCreated: currentTime
              }
            ]);
            aiState.lastShotTime = currentTime;

            // Add muzzle flash effect for visual feedback
            createParticleEffect(
              player.x + normalizedDirX * PLAYER_SIZE,
              player.y + normalizedDirY * PLAYER_SIZE,
              10,
              projectileColors[personality]
            );
          }
        }
      } else {
        // Random movement patterns when not near player, based on personality
        aiState.changeDirCounter++;

        // Change direction more frequently to make movement more dynamic
        const changeFrequency = personality === 'erratic' ? 3 :
          personality === 'aggressive' ? 5 :
            personality === 'sniper' ? 8 : 6;

        if (aiState.changeDirCounter >= changeFrequency) {
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
            // Otherwise move in a semi-random direction based on personality
            switch (personality) {
              case 'aggressive':
                // More direct movement, search pattern
                if (Math.random() < 0.7) {
                  // Broader search pattern
                  const targets = [];
                  for (const [pid, p] of players.entries()) {
                    if (pid !== playerId && !p.isAI) {
                      targets.push(p);
                    }
                  }

                  if (targets.length > 0) {
                    const target = targets[Math.floor(Math.random() * targets.length)];
                    const dirX = target.x - player.x;
                    const dirY = target.y - player.y;
                    const length = Math.sqrt(dirX * dirX + dirY * dirY);
                    aiState.movementDirection = {
                      x: length > 0 ? dirX / length : 0,
                      y: length > 0 ? dirY / length : 0,
                    };
                    break;
                  }
                }
                break;
              default:
                // Random direction for other personalities
                const randomAngle = Math.random() * Math.PI * 2;
                aiState.movementDirection = {
                  x: Math.cos(randomAngle),
                  y: Math.sin(randomAngle),
                };
                break;
            }
          }
        }

        const timeSinceLastShot = currentTime - aiState.lastShotTime;
        const minIdleCooldown = SHOT_COOLDOWN * 1.5;

        // Occasionally shoot in random directions based on personality
        const idleShootChance = personality === 'aggressive' ? 0.15 :
          personality === 'erratic' ? 0.12 :
            personality === 'defensive' ? 0.08 : 0.05;

        if (timeSinceLastShot > minIdleCooldown && Math.random() < idleShootChance) {
          const randomAngle = Math.random() * Math.PI * 2;
          const velocityX = PROJECTILE_SPEED * Math.cos(randomAngle);
          const velocityY = PROJECTILE_SPEED * Math.sin(randomAngle);

          const projectileColors = {
            'aggressive': '#FF3A3A',
            'defensive': '#3A9BFF',
            'sniper': '#FFAA3A',
            'erratic': '#AA3AFF'
          };

          setProjectiles(prev => [
            ...prev,
            {
              x: player.x,
              y: player.y,
              dx: velocityX,
              dy: velocityY,
              playerId,
              size: PROJECTILE_SIZE,
              color: projectileColors[personality],
              trail: [],
              timeCreated: currentTime
            }
          ]);
          aiState.lastShotTime = currentTime;

          // Add muzzle flash effect
          createParticleEffect(
            player.x + Math.cos(randomAngle) * PLAYER_SIZE,
            player.y + Math.sin(randomAngle) * PLAYER_SIZE,
            8,
            projectileColors[personality]
          );
        }
      }

      // Move the AI bot with personality-based speed variation
      const speedMultiplier = personality === 'aggressive' ? 1.2 :
        personality === 'erratic' ? 1.1 :
          personality === 'sniper' ? 0.9 : 1.0;

      const moveSpeed = AI_MOVEMENT_SPEED * speedMultiplier;
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
        aiState: { ...aiState, targetX: newX, targetY: newY },
        velocity: {
          x: aiState.movementDirection.x * moveSpeed,
          y: aiState.movementDirection.y * moveSpeed
        }
      });
    });
  }, [createParticleEffect, currentUserId, players, updatePlayer]);
  // Handle game end and achievement processing
  const handleGameEnd = useCallback(async (isWinner: boolean) => {
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
  }, [currentUserId, gameStats, id, isSingleplayer, players]);

  // Create damage number popups
  const createDamageNumber = useCallback((x: number, y: number, damage: number) => {
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
  }, []);

  // Game render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrameTimestamp = performance.now();

    // Main game loop - extracted into a named function for better performance
    const draw = (currentTime: number) => {
      // Calculate delta time for frame-rate independent updates
      const deltaTime = currentTime - lastFrameTimestamp;
      lastFrameTimestamp = currentTime;

      // Calculate FPS for display
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

      // Update AI behavior at fixed intervals
      if (isSingleplayer) {
        aiUpdateTimeRef.current += deltaTime;
        if (aiUpdateTimeRef.current >= AI_UPDATE_INTERVAL) {
          updateAIBehavior();
          aiUpdateTimeRef.current = 0;
        }
      }

      // Update low health timer for achievements
      if (currentUserId) {
        const currentPlayer = players.get(currentUserId);
        if (currentPlayer && currentPlayer.health <= LOW_HEALTH_THRESHOLD && currentPlayer.health > 0) {
          lowHealthTimeRef.current += deltaTime / 1000; // Convert to seconds
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

        // Add subtle glow in the center for better visual interest
        const gradient = ctx.createRadialGradient(
          CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 50,
          CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 300
        );
        gradient.addColorStop(0, 'rgba(60, 60, 120, 0.1)');
        gradient.addColorStop(1, 'rgba(30, 30, 60, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        // Simple background for medium/low quality
        ctx.fillStyle = gameSettings.graphicsQuality === 'medium' ? '#1a1a2e' : '#111122';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Draw players
      players.forEach((player) => {
        if (player.health <= 0) return;

        // Draw player hit effect (enhanced)
        if (player.lastHitTime && performance.now() - player.lastHitTime < HIT_EFFECT_DURATION) {
          const effectProgress = 1 - ((performance.now() - player.lastHitTime) / HIT_EFFECT_DURATION);
          const hitEffectSize = PLAYER_SIZE + 8 * effectProgress;

          // Outer glow
          ctx.beginPath();
          ctx.arc(player.x, player.y, hitEffectSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 0, 0, ${0.4 * effectProgress})`;
          ctx.fill();

          // Inner flash
          ctx.beginPath();
          ctx.arc(player.x, player.y, PLAYER_SIZE * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * effectProgress})`;
          ctx.fill();
        }

        // Draw movement trail for better visual feedback
        if (player.velocity && gameSettings.graphicsQuality !== 'low' &&
          (Math.abs(player.velocity.x) > 0.5 || Math.abs(player.velocity.y) > 0.5)) {
          const trailLength = gameSettings.graphicsQuality === 'high' ? 3 : 2;
          const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
          const normalizedSpeed = Math.min(speed / PLAYER_MOVEMENT_SPEED, 1);

          // Direction opposite to movement
          const dirX = player.velocity.x !== 0 ? -player.velocity.x / Math.abs(player.velocity.x) : 0;
          const dirY = player.velocity.y !== 0 ? -player.velocity.y / Math.abs(player.velocity.y) : 0;

          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.lineTo(
            player.x + dirX * PLAYER_SIZE * normalizedSpeed * trailLength,
            player.y + dirY * PLAYER_SIZE * normalizedSpeed * trailLength
          );

          // Gradient trail
          const gradient = ctx.createLinearGradient(
            player.x, player.y,
            player.x + dirX * PLAYER_SIZE * normalizedSpeed * trailLength,
            player.y + dirY * PLAYER_SIZE * normalizedSpeed * trailLength
          );

          const trailColor = player.id === currentUserId ? 'rgba(76, 175, 80, 0.6)' :
            player.isAI ? 'rgba(255, 85, 85, 0.6)' : 'rgba(66, 135, 245, 0.6)';

          gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
          gradient.addColorStop(1, trailColor);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = PLAYER_SIZE * 0.8 * normalizedSpeed;
          ctx.lineCap = 'round';
          ctx.stroke();
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

        // Draw health bar with improvements
        const healthBarWidth = 40;
        const healthBarHeight = 4;
        const healthBarX = player.x - healthBarWidth / 2;
        const healthBarY = player.y - PLAYER_SIZE - 15;

        // Background with rounded corners
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight, 2);
        ctx.fill();

        // Health fill with color gradient based on health
        const healthPercentage = player.health / 100;
        let healthColor;

        if (healthPercentage > 0.6) {
          healthColor = '#4CAF50'; // Green
        } else if (healthPercentage > 0.3) {
          // Gradient from yellow to orange
          const gradient = ctx.createLinearGradient(healthBarX, 0, healthBarX + healthBarWidth * healthPercentage, 0);
          gradient.addColorStop(0, '#FFC107');
          gradient.addColorStop(1, '#FF9800');
          healthColor = gradient;
        } else {
          // Gradient from orange to red
          const gradient = ctx.createLinearGradient(healthBarX, 0, healthBarX + healthBarWidth * healthPercentage, 0);
          gradient.addColorStop(0, '#FF5722');
          gradient.addColorStop(1, '#F44336');
          healthColor = gradient;
        }

        ctx.fillStyle = healthColor;
        ctx.beginPath();
        ctx.roundRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight, 2);
        ctx.fill();

        // Add pulsing effect on low health
        if (player.health <= LOW_HEALTH_THRESHOLD) {
          const pulseIntensity = (Math.sin(performance.now() / 200) + 1) / 2; // 0 to 1 pulsing
          ctx.fillStyle = `rgba(255, 0, 0, ${pulseIntensity * 0.3})`;
          ctx.beginPath();
          ctx.roundRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight, 2);
          ctx.fill();
        }

        // Health text and username
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.health} HP`, player.x, player.y - 20);

        // Username with shadow for better readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(player.username, player.x + 1, player.y - 35 + 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(player.username, player.x, player.y - 35);

        // Show AI personality for debugging/clarity
        if (player.isAI && player.aiState?.personality && gameSettings.showFps) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = '10px Arial';
          ctx.fillText(player.aiState.personality, player.x, player.y - 48);
        }
      });

      // Update and draw projectiles
      const updatedProjectiles = projectiles.map(proj => {
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

          // Make trail glow effect more visible with smoother gradients
          const isPlayerProjectile = proj.playerId === currentUserId;
          const trailColor = isPlayerProjectile ? 'rgba(76, 175, 80, 0.6)' : 'rgba(255, 85, 85, 0.6)';

          // For high quality, use actual gradient
          if (gameSettings.graphicsQuality === 'high') {
            const gradient = ctx.createLinearGradient(
              proj.x, proj.y,
              proj.trail[proj.trail.length - 1].x, proj.trail[proj.trail.length - 1].y
            );
            gradient.addColorStop(0, isPlayerProjectile ? 'rgba(100, 255, 100, 0.7)' : 'rgba(255, 100, 100, 0.7)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = gradient;
          } else {
            ctx.strokeStyle = trailColor;
          }

          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Draw projectile with larger size and glow effect
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
          // Enemy projectiles: use color based on the projectile's defined color
          const gradient = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, proj.size);

          // Extract base color components for center highlight
          let colorComponents = { r: 255, g: 85, b: 85 }; // Default red

          // Parse hex color to RGB
          if (proj.color.startsWith('#') && proj.color.length === 7) {
            colorComponents = {
              r: parseInt(proj.color.slice(1, 3), 16),
              g: parseInt(proj.color.slice(3, 5), 16),
              b: parseInt(proj.color.slice(5, 7), 16)
            };
          }

          // Create lighter version for center
          const centerColor = `rgb(${Math.min(colorComponents.r + 50, 255)}, ${Math.min(colorComponents.g + 50, 255)}, ${Math.min(colorComponents.b + 50, 255)})`;

          gradient.addColorStop(0, centerColor);
          gradient.addColorStop(1, proj.color);
          ctx.fillStyle = gradient;
        }
        ctx.fill();

        // Draw glow for all quality levels
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size + 4, 0, Math.PI * 2);
        if (proj.playerId === currentUserId) {
          ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        } else {
          // Extract alpha component for glow
          let glowColor = 'rgba(255, 85, 85, 0.3)'; // Default

          if (proj.color.startsWith('#') && proj.color.length === 7) {
            const r = parseInt(proj.color.slice(1, 3), 16);
            const g = parseInt(proj.color.slice(3, 5), 16);
            const b = parseInt(proj.color.slice(5, 7), 16);
            glowColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
          }

          ctx.fillStyle = glowColor;
        }
        ctx.fill();
      });
      setProjectiles(updatedProjectiles);

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

            // Draw particles with improved rendering
            updatedParticles.forEach(p => {
              ctx.globalAlpha = p.life;
              ctx.beginPath();

              // High quality = use gradient for particles
              if (gameSettings.graphicsQuality === 'high') {
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                gradient.addColorStop(0, p.color);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient;
              } else {
                ctx.fillStyle = p.color;
              }

              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.globalAlpha = 1;

            return { ...effect, particles: updatedParticles };
          })
          .filter(effect => effect.particles.length > 0);
      });

      // Update and draw damage numbers with improved animation
      setDamageNumbers(prev => {
        const currentTime = performance.now();
        return prev
          .filter(dmg => currentTime - dmg.timeCreated < 1000)
          .map(dmg => {
            // Update position and properties with smoother animation
            const progress = (currentTime - dmg.timeCreated) / 1000;
            const easeOutCubic = 1 - Math.pow(1 - progress, 3); // Easing function

            // Movement slows down over time
            dmg.x += dmg.velocity.x * (1 - easeOutCubic * 0.7);
            dmg.y += dmg.velocity.y * (1 - easeOutCubic * 0.7);

            dmg.opacity = 1 - easeOutCubic;
            dmg.scale = 1 + easeOutCubic * 0.3; // Grows slightly as it fades

            // Draw damage number with shadow for better visibility
            ctx.globalAlpha = dmg.opacity;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.font = `bold ${Math.floor(16 * dmg.scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(`-${dmg.value}`, dmg.x + 1, dmg.y + 1);

            ctx.fillStyle = dmg.color;
            ctx.fillText(`-${dmg.value}`, dmg.x, dmg.y);
            ctx.globalAlpha = 1;

            return dmg;
          });
      });

      // Update and draw notifications with improved animation
      setNotifications(prev => {
        const currentTime = performance.now();
        const validNotifications = prev.filter(notif =>
          currentTime - notif.timeCreated < notif.duration
        );

        // Draw notifications with better animation
        validNotifications.forEach((notif, index) => {
          const elapsed = currentTime - notif.timeCreated;
          const duration = notif.duration;

          // Fade in for the first 300ms, fade out for the last 300ms
          const fadeInDuration = 300;
          const fadeOutDuration = 300;

          let opacity;
          if (elapsed < fadeInDuration) {
            // Fade in (ease in)
            opacity = Math.pow(elapsed / fadeInDuration, 2);
          } else if (elapsed > duration - fadeOutDuration) {
            // Fade out (ease out)
            opacity = Math.pow(1 - (elapsed - (duration - fadeOutDuration)) / fadeOutDuration, 2);
          } else {
            // Stable visibility
            opacity = 1;
          }

          // Add a subtle bounce effect
          const yOffset = elapsed < 300 ? 10 * (1 - Math.pow(elapsed / 300, 2)) : 0;

          // Draw notification background with rounded corners
          const textWidth = ctx.measureText(notif.text).width;
          const padding = 10;
          const boxWidth = textWidth + padding * 2;
          const boxHeight = 30;
          const boxX = CANVAS_WIDTH / 2 - boxWidth / 2;
          const boxY = 30 + index * 35 - yOffset;

          ctx.globalAlpha = opacity * 0.8;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 5);
          ctx.fill();

          // Draw color indicator strip
          ctx.fillStyle = notif.color;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, 5, boxHeight, [5, 0, 0, 5]);
          ctx.fill();

          // Draw text with shadow
          ctx.globalAlpha = opacity;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(notif.text, CANVAS_WIDTH / 2 + 1, boxY + 20 + 1);

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(notif.text, CANVAS_WIDTH / 2, boxY + 20);
          ctx.globalAlpha = 1;
        });

        return validNotifications;
      });

      // Check for projectile collisions
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        const newX = projectile.x + projectile.dx;
        const newY = projectile.y + projectile.dy;

        if (newX < 0 || newX > CANVAS_WIDTH || newY < 0 || newY > CANVAS_HEIGHT) {
          projectiles.splice(i, 1);
          continue;
        }

        let hitPlayer = false;

        // More accurate collision detection logic
        players.forEach((player: GamePlayer) => {
          if (player.health <= 0 || projectile.playerId === player.id || player.invulnerable) return;

          // Calculate squared distance (more efficient than Math.hypot)
          const dx = newX - player.x;
          const dy = newY - player.y;
          const distanceSquared = dx * dx + dy * dy;

          // Compare with squared sum of radii (avoid square root calculation)
          const combinedRadii = PLAYER_SIZE + PROJECTILE_SIZE;

          if (distanceSquared <= combinedRadii * combinedRadii) {
            hitPlayer = true;
            const damage = SHOT_DAMAGE;
            const newHealth = Math.max(0, player.health - damage);

            // Create hit effects
            createParticleEffect(newX, newY, 15, '#FF5555');
            createDamageNumber(player.x, player.y - PLAYER_SIZE - 10, damage);

            // Add hit impulse for more dynamic movement feedback
            if (player.velocity) {
              const hitImpulse = 2; // Strength of knockback
              // Calculate normalized hit direction
              const hitDirX = dx !== 0 ? dx / Math.sqrt(dx * dx + dy * dy) : 0;
              const hitDirY = dy !== 0 ? dy / Math.sqrt(dx * dx + dy * dy) : 0;

              // Update player position with knockback (scaled by damage)
              const knockbackX = hitDirX * hitImpulse * (damage / 100);
              const knockbackY = hitDirY * hitImpulse * (damage / 100);

              const newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, player.x + knockbackX));
              const newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, player.y + knockbackY));

              updatePlayer(player.id, {
                x: newX,
                y: newY
              });
            }

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

              // Show kill notification with more info
              if (newHealth === 0) {
                // More descriptive notification
                if (player.isAI) {
                  if (player.aiState?.personality) {
                    addNotification(`You eliminated ${player.username} (${player.aiState.personality})!`, "#4CAF50", 3000);
                  } else {
                    addNotification(`You eliminated ${player.username}!`, "#4CAF50", 3000);
                  }
                } else {
                  addNotification(`You eliminated ${player.username}!`, "#4CAF50", 3000);
                }
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
              const attacker = players.get(projectile.playerId);
              if (attacker) {
                addNotification(`${damage} damage from ${attacker.username}!`, "#F44336", 2000);
              } else {
                addNotification(`${damage} damage received!`, "#F44336", 2000);
              }

              // Screen shake effect for better feedback
              if (canvas && damage > 0 && gameSettings.graphicsQuality !== 'low') {
                const intensity = damage / 100 * 10; // Scale shake with damage
                canvas.style.transform = `translate(${(Math.random() - 0.5) * intensity}px, ${(Math.random() - 0.5) * intensity}px)`;
                setTimeout(() => {
                  canvas.style.transform = 'translate(0, 0)';
                }, 100);
              }
            }
          }
        });

        if (hitPlayer) {
          projectiles.splice(i, 1);
        }
      }

      // Check game state - win condition
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

      // Draw cooldown indicator (improved visual feedback)
      if (currentUserId) {
        const currentPlayer = players.get(currentUserId);
        if (currentPlayer && currentPlayer.health > 0) {
          const cooldownBarWidth = 150;
          const cooldownBarHeight = 12;
          const cooldownBarX = (CANVAS_WIDTH - cooldownBarWidth) / 2;
          const cooldownBarY = CANVAS_HEIGHT - 30;

          // Background with rounded corners
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.beginPath();
          ctx.roundRect(cooldownBarX, cooldownBarY, cooldownBarWidth, cooldownBarHeight, 6);
          ctx.fill();

          if (!canShoot) {
            // Draw cooldown progress with gradient
            const timeElapsed = performance.now() - (performance.now() - (SHOT_COOLDOWN - (performance.now() % SHOT_COOLDOWN)));
            const cooldownProgress = timeElapsed / SHOT_COOLDOWN;

            const gradient = ctx.createLinearGradient(cooldownBarX, 0, cooldownBarX + cooldownBarWidth * cooldownProgress, 0);
            gradient.addColorStop(0, '#FFC107');
            gradient.addColorStop(1, '#FF9800');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(cooldownBarX, cooldownBarY, cooldownBarWidth * cooldownProgress, cooldownBarHeight, 6);
            ctx.fill();

            // Draw text with shadow for better readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Reloading...', CANVAS_WIDTH / 2 + 1, cooldownBarY - 5 + 1);

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('Reloading...', CANVAS_WIDTH / 2, cooldownBarY - 5);

            // Add countdown timer for better feedback
            const remainingTime = ((SHOT_COOLDOWN - timeElapsed) / 1000).toFixed(1);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(remainingTime + 's', CANVAS_WIDTH / 2, cooldownBarY + 8);
          } else {
            // Draw available shots with improved visuals
            const shotWidth = cooldownBarWidth / MAX_SHOTS;

            // Draw individual shot indicators
            for (let i = 0; i < MAX_SHOTS - shotCount; i++) {
              const shotX = cooldownBarX + i * shotWidth;

              // Use gradient for better appearance
              const gradient = ctx.createLinearGradient(shotX, cooldownBarY, shotX, cooldownBarY + cooldownBarHeight);
              gradient.addColorStop(0, '#81C784'); // Light green
              gradient.addColorStop(1, '#388E3C'); // Dark green

              ctx.fillStyle = gradient;
              ctx.beginPath();

              // First shot (leftmost)
              if (i === 0) {
                ctx.roundRect(shotX, cooldownBarY, shotWidth - 1, cooldownBarHeight, [6, 0, 0, 6]);
              }
              // Last shot (rightmost)
              else if (i === MAX_SHOTS - shotCount - 1) {
                ctx.roundRect(shotX, cooldownBarY, shotWidth - 1, cooldownBarHeight, [0, 6, 6, 0]);
              }
              // Middle shots
              else {
                ctx.rect(shotX, cooldownBarY, shotWidth - 1, cooldownBarHeight);
              }

              ctx.fill();
            }

            // Draw text with shadow for better readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${MAX_SHOTS - shotCount} Shots Available`, CANVAS_WIDTH / 2 + 1, cooldownBarY - 5 + 1);

            ctx.fillStyle = '#FFFFFF';
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

    // Store the game loop function in ref
    gameLoopRef.current = draw;

    // Start the game loop
    requestAnimationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (requestAnimationFrameRef.current) cancelAnimationFrame(requestAnimationFrameRef.current);
    };
  }, [
    players, currentUserId, gameState, updatePlayer, playerAvatars, isSingleplayer,
    gameSettings, showTutorial, addNotification, createDamageNumber, createParticleEffect,
    handleGameEnd, loadPlayerAvatar, projectiles, updateAIBehavior
  ]);


  // Helper function to fire projectile
  const fireProjectile = useCallback((targetX: number, targetY: number) => {
    if (!canShoot || shotCount >= MAX_SHOTS || !currentUserId || showTutorial) return;

    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;

    const angle = Math.atan2(targetY - currentPlayer.y, targetX - currentPlayer.x);
    const velocity = PROJECTILE_SPEED;
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

    // Visual feedback: muzzle flash at player position in firing direction
    createParticleEffect(
      currentPlayer.x + Math.cos(angle) * PLAYER_SIZE,
      currentPlayer.y + Math.sin(angle) * PLAYER_SIZE,
      15,
      '#8AFF8A'
    );

    // Play shoot sound with better sound feedback
    if (gameSettings.sfxEnabled) {
      const shootSound = new Audio('/shoot.mp3');
      shootSound.volume = gameSettings.volume / 100;

      // Slightly randomize pitch for more dynamic feel
      shootSound.playbackRate = 0.9 + Math.random() * 0.2;

      shootSound.play().catch(e => console.error('Error playing sound:', e));
    }

    // Add screen shake for more impact (subtle)
    if (canvasRef.current && gameSettings.graphicsQuality !== 'low') {
      const intensity = 2;
      canvasRef.current.style.transform = `translate(${(Math.random() - 0.5) * intensity}px, ${(Math.random() - 0.5) * intensity}px)`;
      setTimeout(() => {
        if (canvasRef.current) canvasRef.current.style.transform = 'translate(0, 0)';
      }, 50);
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

          // Play reload sound with better feedback
          if (gameSettings.sfxEnabled) {
            const reloadSound = new Audio('/reload.mp3');
            reloadSound.volume = gameSettings.volume / 100;
            reloadSound.play().catch(e => console.error('Error playing sound:', e));

            // Add notification for better feedback
            addNotification("Weapons reloaded!", "#64B5F6", 1500);
          }
        }, SHOT_COOLDOWN);
      }
      return newCount;
    });
  }, [
    canShoot, shotCount, currentUserId, showTutorial, players,
    createParticleEffect, gameSettings.sfxEnabled, gameSettings.volume,
    gameSettings.graphicsQuality, addNotification
  ]);

  // Handle shooting via mouse click
  const handleShoot = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canShoot || shotCount >= MAX_SHOTS || !currentUserId || showTutorial) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    fireProjectile(x, y);
  }, [canShoot, shotCount, currentUserId, showTutorial, fireProjectile]);

  // Handle mobile controls
  const handleMobileMove = useCallback((dx: number, dy: number) => {
    if (!currentUserId || showTutorial) return;

    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;

    const moveSpeed = PLAYER_MOVEMENT_SPEED;
    const newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, currentPlayer.x + dx * moveSpeed));
    const newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, currentPlayer.y + dy * moveSpeed));

    if (newX !== currentPlayer.x || newY !== currentPlayer.y) {
      updatePlayer(currentUserId, {
        x: newX,
        y: newY,
        velocity: { x: dx * moveSpeed, y: dy * moveSpeed }
      });
    }
  }, [currentUserId, showTutorial, players, updatePlayer]);

  // Handle mobile shooting
  const handleMobileShoot = useCallback((x: number, y: number) => {
    if (showTutorial) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    fireProjectile(canvasX, canvasY);
  }, [showTutorial, fireProjectile]);

  // Handle returning to lobby
  const handleReturnToLobby = useCallback(() => {
    navigate('/game/lobby');
  }, [navigate]);

  // Handle game restart
  const handleRestart = useCallback(() => {
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
  }, [
    isSingleplayer, players, currentUserId, updatePlayer, removePlayer,
    initializeAIOpponents, navigate, addNotification
  ]);

  // Handle closing the tutorial
  const handleCloseTutorial = useCallback(() => {
    setShowTutorial(false);
    setTutorialStep(0);

    // Update settings to not show tutorial again
    const updatedSettings = {
      ...gameSettings,
      showTutorialOnStart: false
    };

    setGameSettings(updatedSettings);
    localStorage.setItem('gameSettings', JSON.stringify(updatedSettings));
  }, [gameSettings]);

  // Handle share game button
  const handleShareGame = useCallback(() => {
    setShowShareDialog(true);
  }, []);

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