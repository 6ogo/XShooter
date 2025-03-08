import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { Auth } from './components/Auth';
import { AuthCallback } from './components/AuthCallback';
import { GameLobby } from './components/GameLobby';
import { Achievements } from './components/Achievements';
import { Settings } from './components/Settings';
import { PrivacyPolicy } from './components/PrivacyPolicy.tsx';
import { TermsOfService } from './components/TermsOfService.tsx';
import { useGameStore } from './store/gameStore';

function App() {
  const { gameId } = useGameStore();

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/game/lobby" element={<GameLobby />} />
          <Route path="/game/:id" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;