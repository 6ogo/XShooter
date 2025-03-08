import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';

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

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, gameId, updatePlayer } = useGameStore();
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [shotCount, setShotCount] = useState(0);
  const [canShoot, setCanShoot] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw players
      players.forEach((player) => {
        if (player.health <= 0) return;

        ctx.fillStyle = '#4CAF50';
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
            players.forEach((player) => {
              if (
                player.health > 0 &&
                projectile.playerId !== player.id &&
                Math.hypot(newX - player.x, newY - player.y) <
                  PLAYER_SIZE + PROJECTILE_SIZE
              ) {
                updatePlayer(player.id, {
                  health: Math.max(0, player.health - 20),
                });
                return null;
              }
            });

            return {
              ...projectile,
              x: newX,
              y: newY,
            };
          })
          .filter((p): p is Projectile => p !== null)
      );

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [players, projectiles]);

  const handleShoot = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canShoot || shotCount >= MAX_SHOTS) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentPlayer = Array.from(players.values()).find(
      (p) => p.id === supabase.auth.user()?.id
    );
    if (!currentPlayer) return;

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
        playerId: currentPlayer.id,
      },
    ]);

    setShotCount((prev) => prev + 1);
    if (shotCount + 1 >= MAX_SHOTS) {
      setCanShoot(false);
      setTimeout(() => {
        setCanShoot(true);
        setShotCount(0);
      }, SHOT_COOLDOWN);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
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
      </div>
    </div>
  );
}