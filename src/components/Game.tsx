import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { AchievementNotification } from './AchievementNotification';
import { Avatar } from './Avatar';
import { achievementService, GameCompletionData } from '../lib/achievementService';
import { MobileControls } from './MobileControls';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20; // Base player size for hitbox
const PROJECTILE_SIZE = 5;
const SHOT_COOLDOWN = 3000;
const MAX_SHOTS = 5;
const AI_UPDATE_INTERVAL = 300; // AI decision making interval in ms (reduced for more frequent updates)
const AI_SIGHT_RANGE = 300; // How far AI can "see" the player
const AI_SHOT_CHANCE = 0.7; // Probability of AI shooting when player is in sight
const AI_MOVEMENT_SPEED = 2; // Speed of AI movement (increased from code review)

interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  playerId: string;
  size: number;
  color: string;
  trail: { x: number, y: number }[];
}

// AI state for tracking AI behavior
interface AIState {
  targetX: number;
  targetY: number;
  lastShotTime: number;
  movementDirection: { x: number, y: number };
  changeDirCounter: number;
}

// Player interface used in the game
interface GamePlayer {
  id: string;
  x: number;
  y: number;
  health: number;
  username: string;
  avatar_url?: string;
  isAI?: boolean;
  aiState?: AIState;
}

// Cache player avatars for rendering
interface PlayerAvatarCache {
  [playerId: string]: HTMLImageElement | null;
}

export function Game() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, updatePlayer, removePlayer } = useGameStore();
  const [, setProjectiles] = useState<Projectile[]>([]);
  const [] = useState(0);
  const [] = useState(true);
  const [, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [] = useState<PlayerAvatarCache>({});
  const [isMobile, setIsMobile] = useState(false);
  const [isSingleplayer, setIsSingleplayer] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { gameSettings } = useGameStore();
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
  
  // For tracking time with low health
  const lowHealthTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const aiUpdateTimeRef = useRef(0);
  const requestAnimationFrameRef = useRef<number | null>(null);

  // Detect mobile device
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

// Replace the current keyboard movement with this approach
const [keys, setKeys] = useState({
  ArrowUp: false, w: false,
  ArrowDown: false, s: false,
  ArrowLeft: false, a: false,
  ArrowRight: false, d: false
});

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      setKeys(prev => ({ ...prev, [e.key]: true }));
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      setKeys(prev => ({ ...prev, [e.key]: false }));
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, []);

// Add this to your game loop
useEffect(() => {
  // Inside your game loop
  if (!currentUserId) return;
  
  const handleMovement = () => {
    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;
    
    const moveSpeed = 5;
    let dx = 0, dy = 0;
    
    if (keys.ArrowUp || keys.w) dy -= moveSpeed;
    if (keys.ArrowDown || keys.s) dy += moveSpeed;
    if (keys.ArrowLeft || keys.a) dx -= moveSpeed;
    if (keys.ArrowRight || keys.d) dx += moveSpeed;
    
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
  
  const movementInterval = setInterval(handleMovement, 16); // ~60fps
  
  return () => clearInterval(movementInterval);
}, [keys, currentUserId, players, updatePlayer]);

  // Initialize game and fetch Twitter handle
  useEffect(() => {
    const checkAuth = async () => {
      // For singleplayer mode, we can skip authentication
      if (id === 'singleplayer') {
        const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
        setCurrentUserId(playerId);
        const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
        const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
        updatePlayer(playerId, {
          id: playerId,
          x,
          y,
          health: 100,
          username: 'You',
        });
        initializeAIOpponents(3);
        setGameState('playing');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      setCurrentUserId(user.id);
      setTwitterHandle(user.user_metadata?.preferred_username || user.user_metadata?.user_name || null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (profile) {
        const avatar_url = user.user_metadata?.avatar_url || null;
        const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
        const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
        updatePlayer(user.id, {
          x,
          y,
          health: 100,
          username: profile.username,
          avatar_url,
        });
        
        // Add player to game_players table
        if (id && id !== 'singleplayer') {
          await supabase
            .from('game_players')
            .insert({
              game_id: id,
              player_id: user.id,
              position_x: x,
              position_y: y,
            });

          await supabase
            .from('games')
            .update({ current_players: players.size + 1 })
            .eq('id', id);
        }
      }
    };

    checkAuth();
    
    // Set up game subscription for multiplayer mode
    if (!isSingleplayer && id && id !== 'singleplayer') {
      const gameSubscription = supabase
        .channel(`game:${id}`)
        .on('presence', { event: 'sync' }, () => {})
        .on('presence', { event: 'join' }, () => {})
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          leftPresences.forEach((presence: any) => {
            removePlayer(presence.user_id);
          });
        })
        .subscribe();

      return () => {
        gameSubscription.unsubscribe();
      };
    }
  }, [id, navigate, updatePlayer, removePlayer, players.size, isSingleplayer]);

  // Search for players by Twitter handle
  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username, id')
        .ilike('username', `%${searchQuery}%`);
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching players:', error);
    }
  };

  // Invite player by Twitter handle
  const invitePlayer = async (twitterHandle: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', twitterHandle)
        .single();

      if (data) {
        // Send invite (mocked here; could be expanded with notifications)
        console.log(`Invited player with Twitter handle @${twitterHandle}`);
        alert(`Invited @${twitterHandle} to the game!`);
      } else {
        alert(`No player found with Twitter handle @${twitterHandle}`);
      }
    } catch (error) {
      console.error('Error inviting player:', error);
      alert('Failed to invite player.');
    }
  };

  // Create lobby and generate invite link
  const createLobby = async () => {
    if (!currentUserId) return;
    try {
      const { data } = await supabase
        .from('games')
        .insert({
          host_id: currentUserId,
          current_players: 1,
          max_players: 18,
          status: 'waiting',
        })
        .select()
        .single();

      if (data) {
        const roomCode = `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const generatedInviteLink = `${window.location.origin}/game/${data.id}`;
        setInviteLink(generatedInviteLink);
        await supabase
          .from('games')
          .update({ room_code: roomCode })
          .eq('id', data.id);
      }
    } catch (error) {
      console.error('Error creating lobby:', error);
    }
  };

  // Share invite link to Twitter
  const shareToTwitter = () => {
    if (!inviteLink) return;
    const tweetText = `Join my XShooter game! Click the link to jump in: ${inviteLink} #XShooter`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');
  };

  const initializeAIOpponents = (count: number) => {
    for (let i = 0; i < count; i++) {
      const aiId = 'ai_' + Math.random().toString(36).substring(2, 9);
      const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
      const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
      const movementDirection = {
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
      };
      const length = Math.sqrt(movementDirection.x * movementDirection.x + movementDirection.y * movementDirection.y);
      if (length > 0) {
        movementDirection.x /= length;
        movementDirection.y /= length;
      }
      updatePlayer(aiId, {
        id: aiId,
        x,
        y,
        health: 100,
        username: `Bot ${i + 1}`,
        isAI: true,
        aiState: {
          targetX: x,
          targetY: y,
          lastShotTime: 0,
          movementDirection,
          changeDirCounter: 0,
        },
      });
    }
  };

  // Helper function to create fallback avatar
  const createFallbackAvatar = (username: string, size: number) => {
    // Create a canvas to draw the fallback avatar
    const canvas = document.createElement('canvas');
    canvas.width = size * 2; // Higher resolution for better quality
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Get initial and color similar to Avatar component
    const initial = username.charAt(0).toUpperCase();
    
    // Colors matching Avatar component
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
    const colorIndex = username
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(size, size, size, 0, Math.PI * 2);
    ctx.fillStyle = colors[colorIndex];
    ctx.fill();
    
    // Draw text
    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, size, size);
    
    // Create image from canvas
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  };

  // Load player avatar
  const loadPlayerAvatar = async (player: any) => {
    if (playerAvatars[player.id]) return playerAvatars[player.id];
    
    // If player has an avatar URL, load it
    if (player.avatar_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Handle CORS
        
        // Create a promise to wait for image loading
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => {
            // On error, use fallback
            const fallbackImg = createFallbackAvatar(player.username, PLAYER_SIZE);
            setPlayerAvatars(prev => ({
              ...prev,
              [player.id]: fallbackImg
            }));
            resolve();
          };
          img.src = player.avatar_url || '';
        });
        
        // Successfully loaded
        setPlayerAvatars(prev => ({
          ...prev,
          [player.id]: img
        }));
        return img;
      } catch (err) {
        console.error('Error loading avatar:', err);
      }
    }
    
    // Use fallback for no avatar or loading error
    const fallbackAvatar = createFallbackAvatar(player.username, PLAYER_SIZE);
    setPlayerAvatars(prev => ({
      ...prev,
      [player.id]: fallbackAvatar
    }));
    return fallbackAvatar;
  };

  // Helper function to create fallback avatar
  const createFallbackAvatar = (username: string, size: number) => {
    // Create a canvas to draw the fallback avatar
    const canvas = document.createElement('canvas');
    canvas.width = size * 2; // Higher resolution for better quality
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Get initial and color similar to Avatar component
    const initial = username.charAt(0).toUpperCase();
    
    // Colors matching Avatar component
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
    const colorIndex = username
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(size, size, size, 0, Math.PI * 2);
    ctx.fillStyle = colors[colorIndex];
    ctx.fill();
    
    // Draw text
    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, size, size);
    
    // Create image from canvas
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  };

  // Load player avatar
  const loadPlayerAvatar = async (player: any) => {
    if (playerAvatars[player.id]) return playerAvatars[player.id];
    
    // If player has an avatar URL, load it
    if (player.avatar_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Handle CORS
        
        // Create a promise to wait for image loading
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => {
            // On error, use fallback
            const fallbackImg = createFallbackAvatar(player.username, PLAYER_SIZE);
            setPlayerAvatars(prev => ({
              ...prev,
              [player.id]: fallbackImg
            }));
            resolve();
          };
          img.src = player.avatar_url || '';
        });
        
        // Successfully loaded
        setPlayerAvatars(prev => ({
          ...prev,
          [player.id]: img
        }));
        return img;
      } catch (err) {
        console.error('Error loading avatar:', err);
      }
    }
    
    // Use fallback for no avatar or loading error
    const fallbackAvatar = createFallbackAvatar(player.username, PLAYER_SIZE);
    setPlayerAvatars(prev => ({
      ...prev,
      [player.id]: fallbackAvatar
    }));
    return fallbackAvatar;
  };

  // Preload player avatars when player data changes
  useEffect(() => {
    const loadAvatars = async () => {
      const newCache: PlayerAvatarCache = { ...playerAvatars };
      
      for (const [playerId, player] of players.entries()) {
        if (!newCache[playerId]) {
          const avatar = await loadPlayerAvatar(player);
          if (avatar) {
            newCache[playerId] = avatar;
          }
        }
      }
      
      setPlayerAvatars(newCache);
    };
    
    loadAvatars();
  }, [players]);

  // Update AI behavior
  const updateAIBehavior = () => {
    const currentPlayer = players.get(currentUserId || '');
    if (!currentPlayer || currentPlayer.health <= 0) return;
    
    players.forEach((player, playerId) => {
      if (!player.isAI || player.health <= 0) return;
      
      // Get AI state
      const aiState = player.aiState;
      if (!aiState) return;
      
      // Calculate distance to player
      const distToPlayer = Math.hypot(
        currentPlayer.x - player.x,
        currentPlayer.y - player.y
      );
      
      // Different behavior based on distance to player
      if (distToPlayer < AI_SIGHT_RANGE) {
        // Player is in sight - chase and possibly shoot
        
        // Update movement direction towards player
        const dirX = currentPlayer.x - player.x;
        const dirY = currentPlayer.y - player.y;
        
        // Normalize direction
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = length > 0 ? dirX / length : 0;
        const normalizedDirY = length > 0 ? dirY / length : 0;
        
        // Set new movement direction (slightly randomized for more natural movement)
        const randomFactor = 0.3; // How much randomness to add
        aiState.movementDirection = {
          x: normalizedDirX + (Math.random() * 2 - 1) * randomFactor,
          y: normalizedDirY + (Math.random() * 2 - 1) * randomFactor
        };
        
        // Normalize again after adding randomness
        const newLength = Math.sqrt(
          aiState.movementDirection.x * aiState.movementDirection.x + 
          aiState.movementDirection.y * aiState.movementDirection.y
        );
        
        if (newLength > 0) {
          aiState.movementDirection.x /= newLength;
          aiState.movementDirection.y /= newLength;
        }
        
        // Possibly shoot at player
        const currentTime = performance.now();
        const timeSinceLastShot = currentTime - aiState.lastShotTime;
        
        if (timeSinceLastShot > SHOT_COOLDOWN && Math.random() < AI_SHOT_CHANCE) {
          // Shoot at player with some random spread
          const spreadFactor = 0.2; // How much spread to add
          const spreadX = (Math.random() * 2 - 1) * spreadFactor;
          const spreadY = (Math.random() * 2 - 1) * spreadFactor;
          
          const shootDirX = normalizedDirX + spreadX;
          const shootDirY = normalizedDirY + spreadY;
          
          // Normalize shooting direction
          const shootLength = Math.sqrt(shootDirX * shootDirX + shootDirY * shootDirY);
          const velocityX = 5 * (shootLength > 0 ? shootDirX / shootLength : 0);
          const velocityY = 5 * (shootLength > 0 ? shootDirY / shootLength : 0);
          
          // Add projectile
          setProjectiles(prev => [
            ...prev,
            {
              x: player.x,
              y: player.y,
              dx: velocityX,
              dy: velocityY,
              playerId: playerId,
              size: PROJECTILE_SIZE,
              color: '#FF0000',
              trail: []
            }
          ]);
          
          // Update last shot time
          aiState.lastShotTime = currentTime;
        }
      } else {
        // Player not in sight - random movement
        
        // Occasionally change direction
        aiState.changeDirCounter++;
        if (aiState.changeDirCounter >= 5) { // Change direction every ~2.5 seconds
          aiState.changeDirCounter = 0;
          
          const randomAngle = Math.random() * Math.PI * 2;
          aiState.movementDirection = {
            x: Math.cos(randomAngle),
            y: Math.sin(randomAngle)
          };
        }
      }
      
      // Move AI based on current direction
      const moveSpeed = AI_MOVEMENT_SPEED; // speed of AI bots
      let newX = player.x + aiState.movementDirection.x * moveSpeed;
      let newY = player.y + aiState.movementDirection.y * moveSpeed;
      
      // Keep within bounds
      newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, newX));
      newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, newY));
      
      // Update AI position
      updatePlayer(playerId, { 
        x: newX, 
        y: newY,
        aiState: {
          ...aiState,
          targetX: newX,
          targetY: newY
        }
      });
    });
  };

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrameTime = performance.now();

    const draw = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      
      // Process player keyboard movement
      processPlayerMovement();
      
      // Update low health time tracking
      const currentPlayer = players.get(currentUserId);
      if (currentPlayer && currentPlayer.health <= 20) {
        lowHealthTimeRef.current += deltaTime / 1000; // Convert to seconds
      }
      
      // Update AI behavior
      if (isSingleplayer) {
        aiUpdateTimeRef.current += deltaTime;
        if (aiUpdateTimeRef.current >= AI_UPDATE_INTERVAL) {
          updateAIBehavior();
          aiUpdateTimeRef.current = 0;
        }
      }
      
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw players
      players.forEach((player) => {
        if (player.health <= 0) return;

        // Get player avatar (from cache or load it)
        const avatar = playerAvatars[player.id];
        
        // Draw player as avatar or circle if avatar not loaded yet
        if (avatar) {
          // Draw avatar as circle with clipping
          ctx.save();
          ctx.beginPath();
          ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
          ctx.clip();
          
          // Draw the image centered on the player position
          ctx.drawImage(
            avatar, 
            player.x - PLAYER_SIZE, 
            player.y - PLAYER_SIZE,
            PLAYER_SIZE * 2,
            PLAYER_SIZE * 2
          );
          
          // If this is the current player, add a highlight
          if (player.id === currentUserId) {
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          
          ctx.restore();
        } else {
          // Fallback to colored circle
          ctx.fillStyle = player.id === currentUserId ? '#4CAF50' : (player.isAI ? '#F44336' : '#2196F3');
          ctx.beginPath();
          ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
          ctx.fill();
          
          // Load the avatar for next frame
          loadPlayerAvatar(player);
        }

        // Draw health
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.health} HP`, player.x, player.y - 30);

        // Draw username
        ctx.fillText(player.username, player.x, player.y - 50);
      });

      // Draw projectiles
      setProjectiles((prev) => {
        const updatedProjectiles = prev
          .map((proj) => {
            const newX = proj.x + proj.dx;
            const newY = proj.y + proj.dy;
            if (newX < 0 || newX > CANVAS_WIDTH || newY < 0 || newY > CANVAS_HEIGHT) return null;
            return { ...proj, x: newX, y: newY };
          })
          .filter((proj): proj is Projectile => proj !== null);

        updatedProjectiles.forEach((proj) => {
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
          ctx.fillStyle = proj.color;
          ctx.fill();
        });

      // Update projectile positions and check collisions
      setProjectiles((prev) =>
        prev
          .map((projectile) => {
            const newX = projectile.x + projectile.dx;
            const newY = projectile.y + projectile.dy;

            // Check wall collisions
            if (
              newX < 0 ||
              newX > CANVAS_WIDTH ||
              newY < 0 ||
              newY > CANVAS_HEIGHT
            ) {
              return null;
            }

            // Check player collisions
            let hitPlayer = false;
            
            players.forEach((player) => {
              if (
                player.health > 0 &&
                projectile.playerId !== player.id &&
                Math.hypot(newX - player.x, newY - player.y) <
                  PLAYER_SIZE + PROJECTILE_SIZE
              ) {
                hitPlayer = true;
                
                // Update player health
                const newHealth = Math.max(0, player.health - 20);
                updatePlayer(player.id, { health: newHealth });
                
                // Update stats if current user hit another player
                if (projectile.playerId === currentUserId) {
                  setGameStats(prev => ({
                    ...prev,
                    shotsHit: prev.shotsHit + 1
                  }));
                  
                  // Check if player was eliminated
                  if (newHealth === 0) {
                    setGameStats(prev => {
                      const isFirstKill = prev.killCount === 0;
                      const eliminations = [...prev.eliminations, player.id];
                      const killCount = prev.killCount + 1;
                      const killedInRow = prev.killedInRow + 1;
                      
                      // Check if this is a multi-kill
                      const now = performance.now();
                      const multiKills = [...prev.multiKills];
                      
                      if (lastTimeRef.current > 0 && now - lastTimeRef.current < 5000) {
                        // Within 5 seconds of last kill
                        const existingMultiKill = multiKills[multiKills.length - 1];
                        if (existingMultiKill && now - existingMultiKill.timespan < 5000) {
                          // Add to existing multi-kill
                          existingMultiKill.count++;
                          existingMultiKill.timespan = now;
                        } else {
                          // Start new multi-kill
                          multiKills.push({
                            count: 2,
                            timespan: now - lastTimeRef.current
                          });
                        }
                      }
                      
                      lastTimeRef.current = now;
                      
                      return {
                        ...prev,
                        killCount,
                        eliminations,
                        killedInRow,
                        multiKills,
                        firstKill: isFirstKill,
                        lastKill: eliminations.length === players.size - 1
                      };
                    });
                  }
                }
                
                // Update stats if current user got hit
                if (player.id === currentUserId) {
                  setGameStats(prev => {
                    const newStats = {
                      ...prev,
                      damageReceived: prev.damageReceived + 20
                    };
                    
                    // Track lowest health
                    if (newHealth < prev.lowestHealth) {
                      newStats.lowestHealth = newHealth;
                    }
                    
                    return newStats;
                  });
                }
              }
            });

            return hitPlayer ? null : {
              ...projectile,
              x: newX,
              y: newY,
            };
          })
          .filter((p): p is Projectile => p !== null)
      );
      
      // Check if game is over (only one player left)
      const activePlayers = Array.from(players.values()).filter(p => p.health > 0);
      
      if (activePlayers.length === 1 && gameState === 'playing') {
        // Game over, we have a winner
        const winner = activePlayers[0];
        handleGameEnd(winner.id === currentUserId);
      } else if (activePlayers.length >= 2 && gameState === 'waiting') {
        // Game has started
        setGameState('playing');
      }

      // Continue game loop unless game is finished
      if (gameState !== 'finished') {
        requestAnimationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    // Start the game loop
    requestAnimationFrameRef.current = requestAnimationFrame(draw);
    
    // Cleanup function
    return () => {
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
    };
  }, [players, projectiles, currentUserId, gameState, updatePlayer, playerAvatars, isSingleplayer]);

  const handleGameEnd = async (isWinner: boolean) => {
    setGameState('finished');
    
    if (!currentUserId) return;
    
    // For singleplayer mode, we don't need to update leaderboard
    if (isSingleplayer) {
      return;
    }
    
    // Update leaderboard for multiplayer
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
    
    // Update game_players entry
    if (id && id !== 'singleplayer') {
      await supabase
        .from('game_players')
        .update({
          kills: gameStats.killCount,
          shots_fired: gameStats.shotsFired,
          shots_hit: gameStats.shotsHit
        })
        .eq('game_id', id)
        .eq('player_id', currentUserId);
        
      // Update game status
      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', id);
    }
      
    // Check for achievements
    const gameData: GameCompletionData = {
      gameId: id || 'singleplayer',
      playerId: currentUserId,
      winner: isWinner,
      killCount: gameStats.killCount,
      finalHealth: players.get(currentUserId)?.health || 0,
      damageReceived: gameStats.damageReceived,
      shotsFired: gameStats.shotsFired,
      shotsHit: gameStats.shotsHit,
      accuracy: gameStats.shotsFired > 0 
        ? (gameStats.shotsHit / gameStats.shotsFired) * 100
        : 0,
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
      // Fetch the first achievement to display
      const { data: achievement } = await supabase
        .from('achievements')
        .select('name, description')
        .eq('id', unlockedAchievements[0])
        .single();
        
      if (achievement) {
        setUnlockingAchievement(achievement);
      }
    }
  };

  const handleShoot = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canShoot || shotCount >= MAX_SHOTS || !currentUserId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    fireProjectile(x, y);
  };

  const fireProjectile = (targetX: number, targetY: number) => {
    if (!canShoot || shotCount >= MAX_SHOTS || !currentUserId) return;

    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;

    const angle = Math.atan2(targetY - currentPlayer.y, targetX - currentPlayer.x);
    const velocity = 5;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    setProjectiles((prev) => [
      ...prev,
      {
        x: currentPlayer.x,
        y: currentPlayer.y,
        dx: dx,
        dy: dy,
        playerId: currentUserId,
        size: PROJECTILE_SIZE,
        color: '#FF0000',
        trail: []
      },
    ]);

    // Update stats
    setGameStats(prev => ({
      ...prev,
      shotsFired: prev.shotsFired + 1
    }));

    setShotCount((prev) => prev + 1);
    if (shotCount + 1 >= MAX_SHOTS) {
      setCanShoot(false);
      setTimeout(() => {
        setCanShoot(true);
        setShotCount(0);
      }, SHOT_COOLDOWN);
    }
  };

  // Handle keyboard movement
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentUserId) return;
    
    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;
    
    const moveSpeed = 5;
    let newX = currentPlayer.x;
    let newY = currentPlayer.y;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        newY = Math.max(PLAYER_SIZE, currentPlayer.y - moveSpeed);
        break;
      case 'ArrowDown':
      case 's':
        newY = Math.min(CANVAS_HEIGHT - PLAYER_SIZE, currentPlayer.y + moveSpeed);
        break;
      case 'ArrowLeft':
      case 'a':
        newX = Math.max(PLAYER_SIZE, currentPlayer.x - moveSpeed);
        break;
      case 'ArrowRight':
      case 'd':
        newX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, currentPlayer.x + moveSpeed);
        break;
    }
    
    if (newX !== currentPlayer.x || newY !== currentPlayer.y) {
      updatePlayer(currentUserId, { x: newX, y: newY });
    }
  };

  // Handle mobile controls
  const handleMobileMove = (dx: number, dy: number) => {
    if (!currentUserId) return;
    
    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;
    
    const moveSpeed = 5;
    const newX = Math.max(
      PLAYER_SIZE, 
      Math.min(CANVAS_WIDTH - PLAYER_SIZE, currentPlayer.x + dx * moveSpeed)
    );
    const newY = Math.max(
      PLAYER_SIZE, 
      Math.min(CANVAS_HEIGHT - PLAYER_SIZE, currentPlayer.y + dy * moveSpeed)
    );
    
    if (newX !== currentPlayer.x || newY !== currentPlayer.y) {
      updatePlayer(currentUserId, { x: newX, y: newY });
    }
  };

  const handleMobileShoot = (x: number, y: number) => {
    // Convert screen coordinates to canvas coordinates
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
      // Reset player health and position
      const currentPlayer = players.get(currentUserId || '');
      if (currentPlayer) {
        // Random starting position
        const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
        const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
        
        updatePlayer(currentUserId || '', { 
          x, 
          y, 
          health: 100 
        });
      }
      
      // Remove all existing AI players
      for (const [playerId, player] of players.entries()) {
        if (player.isAI) {
          removePlayer(playerId);
        }
      }
      
      // Create new AI opponents
      initializeAIOpponents(3);
      
      // Reset game state and stats
      setGameState('playing');
      setProjectiles([]);
      setShotCount(0);
      setCanShoot(true);
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
      // For multiplayer, just navigate back to lobby
      navigate('/game/lobby');
    }
  };

  // This function is needed to make the component compile
  const processPlayerMovement = () => {
    // The actual player movement logic is now in the useEffect with keys
    // This function remains as a placeholder to prevent the compiler error
  };

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleShoot}
          className="bg-gray-800 rounded-lg shadow-lg"
        />
        
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded">
          Shots: {MAX_SHOTS - shotCount}
          {!canShoot && <span className="ml-2">(Cooling down...)</span>}
        </div>
        
        {/* Game mode indicator */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
          {isSingleplayer ? 'Singleplayer' : 'Multiplayer'}
        </div>
        
        {gameState === 'finished' && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Game Over
            </h2>
            
            {/* Winner display with avatar */}
            {Array.from(players.values()).find(p => p.health > 0) && (
              <div className="mb-6">
                <div className="flex flex-col items-center">
                  <Avatar 
                    username={Array.from(players.values()).find(p => p.health > 0)?.username || 'Winner'} 
                    imageUrl={Array.from(players.values()).find(p => p.health > 0)?.avatar_url}
                    size="lg"
                    className="mb-2"
                  />
                  <p className="text-xl text-white">Winner: {Array.from(players.values()).find(p => p.health > 0)?.username}</p>
                </div>
              </div>
            )}
            
            <p className="text-xl text-white mb-6">
              {currentUserId && players.get(currentUserId) && players.get(currentUserId)!.health > 0 ? 'You Won!' : 'Better luck next time!'}
            </p>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="text-center">
                <p className="text-gray-400">Kills</p>
                <p className="text-2xl font-bold text-white">{gameStats.killCount}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Accuracy</p>
                <p className="text-2xl font-bold text-white">
                  {gameStats.shotsFired > 0 
                    ? `${Math.round((gameStats.shotsHit / gameStats.shotsFired) * 100)}%` 
                    : '0%'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {isSingleplayer ? 'Play Again' : 'Return to Lobby'}
              </button>
              
              {isSingleplayer && (
                <button
                  onClick={handleReturnToLobby}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Main Menu
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Mobile controls */}
      {isMobile && (
        <MobileControls
          onMove={handleMobileMove}
          onShoot={handleMobileShoot}
        />
      )}
      
      {/* Achievement notification */}
      <AchievementNotification 
        achievement={unlockingAchievement} 
        onClose={() => setUnlockingAchievement(null)} 
      />
    </div>
  );
}