import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { AchievementNotification } from './AchievementNotification';
import { achievementService, GameCompletionData } from '../lib/achievementService';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const PROJECTILE_SIZE = 5;
const SHOT_COOLDOWN = 3000;
const MAX_SHOTS = 5;

interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  playerId: string;
}

interface Player {
  id: string;
  x: number;
  y: number;
  health: number;
  username: string;
  image?: string; // Twitter profile image URL
}

export function Game() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, updatePlayer, removePlayer } = useGameStore();
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [shotCount, setShotCount] = useState(0);
  const [canShoot, setCanShoot] = useState(true);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameStats, setGameStats] = useState({
    killCount: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageReceived: 0,
    lowestHealth: 100,
    timeWithLowHealth: 0,
    eliminations: [] as string[],
    killedInRow: 0,
    multiKills: [] as { count: number, timespan: number }[],
    firstKill: false,
    lastKill: false
  });
  const [unlockingAchievement, setUnlockingAchievement] = useState<{
    name: string;
    description: string;
  } | null>(null);
  
  // For tracking time with low health
  const lowHealthTimeRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      
      setCurrentUserId(user.id);
      
      // Initialize player
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
        
      if (profile) {
        // Random starting position
        const x = Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2) + PLAYER_SIZE;
        const y = Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE * 2) + PLAYER_SIZE;
        
        updatePlayer(user.id, {
          x,
          y,
          health: 100,
          username: profile.username
        });
        
        // Add player to game_players table
        await supabase
          .from('game_players')
          .insert({
            game_id: id,
            player_id: user.id,
            position_x: x,
            position_y: y
          });
          
        // Update game current_players count
        await supabase
          .from('games')
          .update({ current_players: players.size + 1 })
          .eq('id', id);
      }
    };
    
    checkAuth();
    
    // Set up game subscription
    const gameSubscription = supabase
      .channel(`game:${id}`)
      .on('presence', { event: 'sync' }, () => {
        // Handle presence sync
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Handle player join
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // Handle player leave
        leftPresences.forEach((presence: any) => {
          removePlayer(presence.user_id);
        });
      })
      .subscribe();
      
    return () => {
      gameSubscription.unsubscribe();
    };
  }, [id, navigate, updatePlayer, removePlayer, players.size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentUserId) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastFrameTime = performance.now();

    const draw = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      
      // Update low health time tracking
      if (players.get(currentUserId)?.health <= 20) {
        lowHealthTimeRef.current += deltaTime / 1000; // Convert to seconds
      }
      
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw players
      players.forEach((player) => {
        if (player.health <= 0) return;

        ctx.fillStyle = player.id === currentUserId ? '#4CAF50' : '#F44336';
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();

        // Draw health bar
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(player.x - 25, player.y - 30, 50, 5);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(
          player.x - 25,
          player.y - 30,
          (player.health / 100) * 50,
          5
        );

        // Draw username
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, player.x, player.y - 35);
      });

      // Draw projectiles
      ctx.fillStyle = '#FF0000';
      projectiles.forEach((projectile) => {
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, PROJECTILE_SIZE, 0, Math.PI * 2);
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

      animationId = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => cancelAnimationFrame(animationId);
  }, [players, projectiles, currentUserId, gameState, updatePlayer]);

  const handleGameEnd = async (isWinner: boolean) => {
    setGameState('finished');
    
    if (!currentUserId) return;
    
    // Update leaderboard
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
      
    // Check for achievements
    const gameData: GameCompletionData = {
      gameId: id || '',
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

    const currentPlayer = players.get(currentUserId);
    if (!currentPlayer || currentPlayer.health <= 0) return;

    const angle = Math.atan2(y - currentPlayer.y, x - currentPlayer.x);
    const velocity = 5;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;

    setProjectiles((prev) => [
      ...prev,
      {
        x: currentPlayer.x,
        y: currentPlayer.y,
        dx,
        dy,
        playerId: currentUserId,
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

  const handleReturnToLobby = () => {
    navigate('/game/lobby');
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
          className="bg-white rounded-lg shadow-lg"
        />
        
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded">
          Shots: {MAX_SHOTS - shotCount}
          {!canShoot && <span className="ml-2">(Cooling down...)</span>}
        </div>
        
        {gameState === 'finished' && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Game Over
            </h2>
            <p className="text-xl text-white mb-6">
              {players.get(currentUserId)?.health > 0 ? 'You Won!' : 'Better luck next time!'}
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
            <button
              onClick={handleReturnToLobby}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Return to Lobby
            </button>
          </div>
        )}
      </div>
      
      {/* Achievement notification */}
      <AchievementNotification 
        achievement={unlockingAchievement} 
        onClose={() => setUnlockingAchievement(null)} 
      />
    </div>
  );
}
