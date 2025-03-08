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
const PLAYER_SIZE = 20;
const PROJECTILE_SIZE = 5;
const SHOT_COOLDOWN = 3000;
const MAX_SHOTS = 5;
const AI_UPDATE_INTERVAL = 300;
const AI_SIGHT_RANGE = 300;
const AI_SHOT_CHANCE = 0.7;
const AI_MOVEMENT_SPEED = 2;

interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  playerId: string;
  size: number;
  color: string;
  trail: { x: number; y: number }[];
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
}

interface PlayerAvatarCache {
  [playerId: string]: HTMLImageElement | null;
}

interface GameProps {
  // No props currently, but interface defined for future use
}

export function Game(_props: GameProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, updatePlayer, removePlayer } = useGameStore();
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [shotCount, setShotCount] = useState(0);
  const [canShoot, setCanShoot] = useState(true);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playerAvatars, setPlayerAvatars] = useState<PlayerAvatarCache>({});
  const [isMobile, setIsMobile] = useState(false);
  const [isSingleplayer, setIsSingleplayer] = useState(false);
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

      if (keys.ArrowUp || keys.w) dy -= moveSpeed;
      if (keys.ArrowDown || keys.s) dy += moveSpeed;
      if (keys.ArrowLeft || keys.a) dx -= moveSpeed;
      if (keys.ArrowRight || keys.d) dx += moveSpeed;

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
  }, [keys, currentUserId, players, updatePlayer]);

  useEffect(() => {
    const checkAuth = async () => {
      if (id === 'singleplayer') {
        const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
        setCurrentUserId(playerId);
        const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
        const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
        updatePlayer(playerId, { id: playerId, x, y, health: 100, username: 'You' });
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
        }
      }
    };

    checkAuth();

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
        aiState: { targetX: x, targetY: y, lastShotTime: 0, movementDirection, changeDirCounter: 0 },
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

    players.forEach((player: GamePlayer, playerId: string) => {
      if (!player.isAI || player.health <= 0 || !player.aiState) return;

      const aiState = player.aiState;
      const distToPlayer = Math.hypot(currentPlayer.x - player.x, currentPlayer.y - player.y);

      if (distToPlayer < AI_SIGHT_RANGE) {
        const dirX = currentPlayer.x - player.x;
        const dirY = currentPlayer.y - player.y;
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = length > 0 ? dirX / length : 0;
        const normalizedDirY = length > 0 ? dirY / length : 0;

        const randomFactor = 0.3;
        aiState.movementDirection = {
          x: normalizedDirX + (Math.random() * 2 - 1) * randomFactor,
          y: normalizedDirY + (Math.random() * 2 - 1) * randomFactor
        };
        const newLength = Math.sqrt(aiState.movementDirection.x * aiState.movementDirection.x + aiState.movementDirection.y * aiState.movementDirection.y);
        if (newLength > 0) {
          aiState.movementDirection.x /= newLength;
          aiState.movementDirection.y /= newLength;
        }

        const currentTime = performance.now();
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
            { x: player.x, y: player.y, dx: velocityX, dy: velocityY, playerId, size: PROJECTILE_SIZE, color: '#FF0000', trail: [] }
          ]);
          aiState.lastShotTime = currentTime;
        }
      } else {
        aiState.changeDirCounter++;
        if (aiState.changeDirCounter >= 5) {
          aiState.changeDirCounter = 0;
          const randomAngle = Math.random() * Math.PI * 2;
          aiState.movementDirection = { x: Math.cos(randomAngle), y: Math.sin(randomAngle) };
        }
      }

      const moveSpeed = AI_MOVEMENT_SPEED;
      let newX = player.x + aiState.movementDirection.x * moveSpeed;
      let newY = player.y + aiState.movementDirection.y * moveSpeed;
      newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, newX));
      newY = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, newY));
      updatePlayer(playerId, { x: newX, y: newY, aiState: { ...aiState, targetX: newX, targetY: newY } });
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrameTime = performance.now();

    const draw = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      if (isSingleplayer) {
        aiUpdateTimeRef.current += deltaTime;
        if (aiUpdateTimeRef.current >= AI_UPDATE_INTERVAL) {
          updateAIBehavior();
          aiUpdateTimeRef.current = 0;
        }
      }

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      players.forEach((player) => {
        if (player.health <= 0) return;
        const avatar = playerAvatars[player.id];
        if (avatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, player.x - PLAYER_SIZE, player.y - PLAYER_SIZE, PLAYER_SIZE * 2, PLAYER_SIZE * 2);
          if (player.id === currentUserId) {
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.fillStyle = player.id === currentUserId ? '#4CAF50' : (player.isAI ? '#F44336' : '#2196F3');
          ctx.beginPath();
          ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
          ctx.fill();
          loadPlayerAvatar(player);
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.health} HP`, player.x, player.y - 30);
        ctx.fillText(player.username, player.x, player.y - 50);
      });

      setProjectiles(prev => {
        const updatedProjectiles = prev.map(proj => {
          const newX = proj.x + proj.dx;
          const newY = proj.y + proj.dy;
          if (newX < 0 || newX > CANVAS_WIDTH || newY < 0 || newY > CANVAS_HEIGHT) return null;
          return { ...proj, x: newX, y: newY };
        }).filter((proj): proj is Projectile => proj !== null);

        updatedProjectiles.forEach(proj => {
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
          ctx.fillStyle = proj.color;
          ctx.fill();
        });

        return updatedProjectiles;
      });

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
              Math.hypot(newX - player.x, newY - player.y) < PLAYER_SIZE + PROJECTILE_SIZE
            ) {
              hitPlayer = true;
              const newHealth = Math.max(0, player.health - 20);
              updatePlayer(player.id, { health: newHealth });

              if (projectile.playerId === currentUserId) {
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
              }

              if (player.id === currentUserId) {
                setGameStats(prev => ({
                  ...prev,
                  damageReceived: prev.damageReceived + 20,
                  lowestHealth: newHealth < prev.lowestHealth ? newHealth : prev.lowestHealth
                }));
              }
            }
          });

          return hitPlayer ? null : { ...projectile, x: newX, y: newY };
        }).filter((p): p is Projectile => p !== null);

        const activePlayers = Array.from(players.values()).filter(p => p.health > 0);
        if (activePlayers.length === 1 && gameState === 'playing') {
          const winner = activePlayers[0];
          handleGameEnd(winner.id === currentUserId);
        } else if (activePlayers.length >= 2 && gameState === 'waiting') {
          setGameState('playing');
        }

        return newProjectiles;
      });

      if (gameState !== 'finished') {
        requestAnimationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    requestAnimationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestAnimationFrameRef.current) cancelAnimationFrame(requestAnimationFrameRef.current);
    };
  }, [players, currentUserId, gameState, updatePlayer, playerAvatars, isSingleplayer]);

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

    const gameData: GameCompletionData = {
      gameId: id || 'singleplayer',
      playerId: currentUserId,
      winner: isWinner,
      killCount: gameStats.killCount,
      finalHealth: players.get(currentUserId)?.health || 0,
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
    if (!canShoot || shotCount >= MAX_SHOTS || !currentUserId) return;

    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;

    const angle = Math.atan2(targetY - currentPlayer.y, targetX - currentPlayer.x);
    const velocity = 5;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    setProjectiles(prev => [
      ...prev,
      { x: currentPlayer.x, y: currentPlayer.y, dx, dy, playerId: currentUserId, size: PROJECTILE_SIZE, color: '#FF0000', trail: [] }
    ]);

    setGameStats(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));
    setShotCount(prev => {
      const newCount = prev + 1;
      if (newCount >= MAX_SHOTS) {
        setCanShoot(false);
        setTimeout(() => {
          setCanShoot(true);
          setShotCount(0);
        }, SHOT_COOLDOWN);
      }
      return newCount;
    });
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

  const handleMobileMove = (dx: number, dy: number) => {
    if (!currentUserId) return;

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

      initializeAIOpponents(3);
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
      navigate('/game/lobby');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4" tabIndex={0}>
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
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
          {isSingleplayer ? 'Singleplayer' : 'Multiplayer'}
        </div>
        {gameState === 'finished' && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center">
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
              {currentUserId && players.get(currentUserId)?.health > 0 ? 'You Won!' : 'Better luck next time!'}
            </p>
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="text-center">
                <p className="text-gray-400">Kills</p>
                <p className="text-2xl font-bold text-white">{gameStats.killCount}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Accuracy</p>
                <p className="text-2xl font-bold text-white">
                  {gameStats.shotsFired > 0 ? `${Math.round((gameStats.shotsHit / gameStats.shotsFired) * 100)}%` : '0%'}
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
      {isMobile && <MobileControls onMove={handleMobileMove} onShoot={handleMobileShoot} />}
      <AchievementNotification achievement={unlockingAchievement} onClose={() => setUnlockingAchievement(null)} />
    </div>
  );
}