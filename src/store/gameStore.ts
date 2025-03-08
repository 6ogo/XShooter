// src/store/gameStore.ts
import { create } from 'zustand';

// AI state for tracking AI behavior
export interface AIState {
  targetX: number;
  targetY: number;
  lastShotTime: number;
  movementDirection: { x: number, y: number };
  changeDirCounter: number;
}

export interface Player {
  id: string;
  x: number;
  y: number;
  health: number;
  username: string;
  avatar_url?: string;
  isAI?: boolean;
  aiState?: AIState;
}

export interface GameSettings {
  volume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  graphicsQuality: string;
  fullscreen: boolean;
}

interface GameState {
  players: Map<string, Player>;
  gameId: string | null;
  isHost: boolean;
  roomCode: string | null;
  maxPlayers: number;
  gameSettings: GameSettings;
  setGameId: (id: string) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  setMaxPlayers: (maxPlayers: number) => void;
  setGameSettings: (settings: GameSettings) => void;
  updatePlayer: (playerId: string, data: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  reset: () => void;
}

const defaultSettings: GameSettings = {
  volume: 70,
  musicEnabled: true,
  sfxEnabled: true,
  graphicsQuality: 'medium',
  fullscreen: false
};

export const useGameStore = create<GameState>((set) => ({
  players: new Map(),
  gameId: null,
  isHost: false,
  roomCode: null,
  maxPlayers: 18,
  gameSettings: defaultSettings,
  setGameId: (id) => set({ gameId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setIsHost: (isHost) => set({ isHost }),
  setMaxPlayers: (maxPlayers) => set({ maxPlayers }),
  setGameSettings: (settings) => set({ gameSettings: settings }),
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
  reset: () => set({ 
    players: new Map(), 
    gameId: null, 
    isHost: false, 
    roomCode: null,
    maxPlayers: 18,
    gameSettings: defaultSettings
  }),
}));