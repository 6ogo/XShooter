import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { MobileControls } from './MobileControls';
import { AchievementNotification } from './AchievementNotification';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;

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

  // Keyboard movement
  const [keys, setKeys] = useState({
    ArrowUp: false,
    w: false,
    ArrowDown: false,
    s: false,
    ArrowLeft: false,
    a: false,
    ArrowRight: false,
    d: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        setKeys((prev) => ({ ...prev, [e.key]: true }));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        setKeys((prev) => ({ ...prev, [e.key]: false }));
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
    if (!currentUserId) return;
    const handleMovement = () => {
      const currentPlayer = players.get(currentUserId);
      if (!currentPlayer || currentPlayer.health <= 0) return;
      const moveSpeed = 5;
      let dx = 0,
        dy = 0;
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

  // Initialize game and fetch Twitter handle
  useEffect(() => {
    const checkAuth = async () => {
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

  // Game rendering and logic (unchanged from original)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw players
      players.forEach((player) => {
        if (player.health <= 0) return;
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fillStyle = player.isAI ? '#FF5555' : '#55FF55';
        ctx.fill();

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

        return updatedProjectiles;
      });

      requestAnimationFrameRef.current = requestAnimationFrame(animate);
    };

    requestAnimationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
    };
  }, [players]);

  return (
    <div className="relative min-h-screen bg-gray-900 flex flex-col items-center p-4">
      {/* Top UI */}
      <div className="absolute top-4 left-4 flex items-center space-x-4">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700"
        >
          <SettingsIcon size={20} />
        </button>
        {twitterHandle && (
          <div className="flex items-center space-x-2 text-white">
            <Twitter size={16} className="text-blue-400" />
            <span>@{twitterHandle}</span>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="absolute top-4 right-4 w-64">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="w-full p-2 pr-10 rounded-lg bg-gray-800 text-white"
          />
          <button
            onClick={handleSearch}
            className="absolute right-2 top-2 text-gray-400 hover:text-white"
          >
            <Search size={20} />
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="absolute mt-2 w-full bg-gray-800 rounded-lg shadow-lg">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="p-2 hover:bg-gray-700 text-white flex justify-between items-center"
              >
                <span>{result.username}</span>
                <button
                  onClick={() => invitePlayer(result.username)}
                  className="p-1 bg-indigo-600 rounded text-white hover:bg-indigo-700"
                >
                  Invite
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lobby Creation and Invite */}
      <div className="absolute top-20 right-4 flex flex-col space-y-2">
        <button
          onClick={createLobby}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Create Lobby
        </button>
        {inviteLink && (
          <button
            onClick={shareToTwitter}
            className="px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 flex items-center space-x-2"
          >
            <Twitter size={16} />
            <span>Share on Twitter</span>
          </button>
        )}
      </div>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-gray-700 rounded-lg"
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Game Settings</h2>
            <GameSettings onClose={() => setShowSettings(false)} onSave={function (): void {
              throw new Error('Function not implemented.');
            } } />
          </div>
        </div>
      )}

      {/* Achievement Notification */}
      {unlockingAchievement && (
        <AchievementNotification
          achievement={unlockingAchievement}
          onClose={() => setUnlockingAchievement(null)}
        />
      )}

      {/* Mobile Controls */}
      {isMobile && <MobileControls onMove={function (): void {
        throw new Error('Function not implemented.');
      } } onShoot={function (): void {
        throw new Error('Function not implemented.');
      } } />}
    </div>
  );
}