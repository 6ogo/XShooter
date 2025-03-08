import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Player, useGameStore } from '../store/gameStore';
import { NavigationBar } from './NavigationBar';
import { Twitter } from 'lucide-react';

interface GameLobbyProps {}

export function GameLobby({}: GameLobbyProps) {
  const navigate = useNavigate();
  const { 
    setGameId, 
    setRoomCode, 
    setIsHost, 
    setMaxPlayers, 
    updatePlayer 
  } = useGameStore() as {
    setGameId: (id: string) => void;
    setRoomCode: (code: string | null) => void; // Explicitly type as string | null
    setIsHost: (isHost: boolean) => void;
    setMaxPlayers: (maxPlayers: number) => void;
    updatePlayer: (playerId: string, data: Partial<Player>) => void;
  };
  const [loading, setLoading] = useState(true);
  const [creatingGame, setCreatingGame] = useState(false);
  const [joiningGame, setJoiningGame] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setCurrentUser(user);
      setTwitterHandle(user.user_metadata?.preferred_username || user.user_metadata?.user_name || null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (profile) {
        updatePlayer(user.id, {
          id: user.id,
          username: profile.username,
          x: 0,
          y: 0,
          health: 100,
          avatar_url: user.user_metadata?.avatar_url,
        });
      }
      setLoading(false);
    };
    checkAuth();
  }, [navigate, updatePlayer]);

  const createGame = async () => {
    if (!currentUser) return;
    setCreatingGame(true);
    setError(null);
    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          host_id: currentUser.id,
          current_players: 1,
          max_players: 18,
          status: 'waiting',
        })
        .select()
        .single();

      if (gameError) throw gameError;

      const generatedRoomCode = `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await supabase
        .from('games')
        .update({ room_code: generatedRoomCode })
        .eq('id', game.id);

      await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          player_id: currentUser.id,
          position_x: 0,
          position_y: 0,
        });

      setGameId(game.id);
      setRoomCode(generatedRoomCode);
      setIsHost(true);
      setMaxPlayers(18);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setCreatingGame(false);
    }
  };

  const joinGame = async () => {
    if (!roomCodeInput) {
      setError('Please enter a room code');
      return;
    }
    setJoiningGame(true);
    setError(null);
    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('room_code', roomCodeInput.toUpperCase())
        .eq('status', 'waiting')
        .single();

      if (gameError || !game) {
        setError('Game not found or has already started');
        setJoiningGame(false);
        return;
      }

      if (game.current_players >= game.max_players) {
        setError('Game is full');
        setJoiningGame(false);
        return;
      }

      await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          player_id: currentUser.id,
          position_x: 0,
          position_y: 0,
        });

      await supabase
        .from('games')
        .update({ current_players: game.current_players + 1 })
        .eq('id', game.id);

      setGameId(game.id);
      setRoomCode(game.room_code);
      setIsHost(false);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setJoiningGame(false);
    }
  };

  const joinQuickplay = async () => {
    setJoiningGame(true);
    setError(null);
    try {
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'waiting')
        .lt('current_players', 'max_players')
        .order('created_at', { ascending: false });

      if (gamesError) throw gamesError;

      let game;
      if (games && games.length > 0) {
        game = games[0];
      } else {
        const { data: newGame, error: newGameError } = await supabase
          .from('games')
          .insert({
            host_id: currentUser.id,
            current_players: 1,
            max_players: 18,
            status: 'waiting',
          })
          .select()
          .single();

        if (newGameError) throw newGameError;
        game = newGame;
      }

      await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          player_id: currentUser.id,
          position_x: 0,
          position_y: 0,
        });

      await supabase
        .from('games')
        .update({ current_players: game.current_players + 1 })
        .eq('id', game.id);

      setGameId(game.id);
      setRoomCode(game.room_code);
      setIsHost(game.host_id === currentUser.id);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join quickplay');
    } finally {
      setJoiningGame(false);
    }
  };

  const startSingleplayer = () => {
    setGameId('singleplayer');
    setRoomCode(null); // This is fine since setRoomCode accepts string | null
    setIsHost(true);
    navigate('/game/singleplayer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <NavigationBar currentPage="lobby" />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-600 text-white rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to XShooter</h2>
            {twitterHandle && (
              <div className="flex items-center space-x-2 text-white mb-4">
                <Twitter size={16} className="text-blue-400" />
                <span>@{twitterHandle}</span>
              </div>
            )}
            <div className="space-y-4">
              <button
                onClick={createGame}
                disabled={creatingGame}
                className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {creatingGame ? 'Creating Game...' : 'Create New Game'}
              </button>
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  placeholder="Enter Room Code"
                  className="flex-1 p-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={joinGame}
                  disabled={joiningGame}
                  className="py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {joiningGame ? 'Joining...' : 'Join Game'}
                </button>
              </div>
              <button
                onClick={joinQuickplay}
                disabled={joiningGame}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {joiningGame ? 'Joining...' : 'Quickplay'}
              </button>
              <button
                onClick={startSingleplayer}
                className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Singleplayer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}