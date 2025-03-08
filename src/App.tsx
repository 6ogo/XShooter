import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { Auth } from './components/Auth';
import { GameLobby } from './components/GameLobby';
import { Achievements } from './components/Achievements';
import { useGameStore } from './store/gameStore';

function App() {
  const { gameId } = useGameStore();

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/game/lobby" element={<GameLobby />} />
          <Route path="/game/:id" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/achievements" element={<Achievements />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
