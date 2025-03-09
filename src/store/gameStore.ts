// src/store/gameStore.ts
import { create } from 'zustand';

// AI state for tracking AI behavior
interface AIState {
  targetX: number;
  targetY: number;
  lastShotTime: number;
  movementDirection: { x: number, y: number };
  changeDirCounter: number;
  personality?: 'aggressive' | 'defensive' | 'sniper' | 'erratic';
}

interface Player {
  lastHitTime: number | null;
  id: string;
  x: number;
  y: number;
  health: number;
  username: string;
  avatar_url?: string;
  isAI?: boolean;
  aiState?: AIState;
  lastMoveTime?: number;
  velocity?: { x: number; y: number };
}

interface GameState {
  players: Map<string, Player>;
  gameId: string | null;
  isHost: boolean;
  roomCode: string | null;
  setGameId: (id: string) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  updatePlayer: (playerId: string, data: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  players: new Map(),
  gameId: null,
  isHost: false,
  roomCode: null,
  setGameId: (id) => set({ gameId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setIsHost: (isHost) => set({ isHost }),
  updatePlayer: (playerId, data) =>
    set((state) => {
      const players = new Map(state.players);
      const currentPlayer = players.get(playerId);
      if (currentPlayer) {
        players.set(playerId, { ...currentPlayer, ...data });
      } else {
        players.set(playerId, { 
          id: playerId, 
          x: 0, 
          y: 0, 
          health: 100, 
          username: '', 
          lastHitTime: null,
          ...data 
        });
      }
      return { players };
    }),
  removePlayer: (playerId) =>
    set((state) => {
      const players = new Map(state.players);
      players.delete(playerId);
      return { players };
    }),
  reset: () => set({ players: new Map(), gameId: null, isHost: false, roomCode: null }),
}));