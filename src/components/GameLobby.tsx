import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { Users, Swords, Trophy, Award, User } from 'lucide-react';

export function GameLobby() {
  const navigate = useNavigate();
  const { setGameId, setRoomCode } = useGameStore();
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
          
        if (data) {
          setUserData({ ...user, username: data.username });
        }
      } else {
        navigate('/');
      }
    };
    
    fetchUserData();
  }, [navigate]);

  useEffect(() => {
    const fetchGames = async () => {
      const { data: games, error } = await supabase
        .from('games')
        .select('*, profiles!games_host_id_fkey(username)')
        .eq('status', 'waiting');

      if (!error && games) {
        setActiveGames(games);
      }
      setLoading(false);
    };

    fetchGames();

    // Subscribe to game updates
    const gameSubscription = supabase
      .channel('games')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games'
      }, () => {
        fetchGames();
      })
      .subscribe();

    return () => {
      gameSubscription.unsubscribe();
    };
  }, []);

  const createGame = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Verify profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Profile not found. Please sign up first.');
      }

      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert([{
          host_id: user.id,
          room_code: roomCode,
          status: 'waiting',
          current_players: 1,
          max_players: 4
        }])
        .select()
        .single();

      if (gameError) throw gameError;
      if (!game) throw new Error('Failed to create game');

      setGameId(game.id);
      setRoomCode(roomCode);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    }
  };

  const startSingleplayer = () => {
    // No need to create a game in the database for singleplayer
    navigate('/game/singleplayer');
  };

  const joinGame = async (gameId: string) => {
    setGameId(gameId);
    navigate(`/game/${gameId}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with username and sign out */}
        {userData && (
          <div className="flex justify-between items-center mb-6 text-white">
            <div className="text-sm">
              Playing as <span className="font-medium">{userData.username}</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Game Lobby</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/achievements')}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              <Award size={20} />
              Achievements
            </button>
            <button
              onClick={() => navigate('/leaderboard')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Trophy size={20} />
              Leaderboard
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* Game modes */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-lg shadow-xl p-6 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-green-700">
                <User size={24} />
              </div>
              <h2 className="text-xl font-semibold">Singleplayer Mode</h2>
            </div>
            <p className="mb-6 text-green-200">
              Practice your skills against AI opponents. Test your abilities before competing against other players.
            </p>
            <button
              onClick={startSingleplayer}
              className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Swords size={20} />
              Play Singleplayer
            </button>
          </div>
          
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-lg shadow-xl p-6 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-indigo-700">
                <Users size={24} />
              </div>
              <h2 className="text-xl font-semibold">Multiplayer Mode</h2>
            </div>
            <p className="mb-6 text-indigo-200">
              Compete against other players online. Your stats will be tracked on the leaderboard.
            </p>
            <button
              onClick={createGame}
              className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <Swords size={20} />
              Create Multiplayer Game
            </button>
          </div>
        </div>

        {/* Active multiplayer games */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Active Multiplayer Games</h2>
          {loading ? (
            <p className="text-gray-600">Loading games...</p>
          ) : activeGames.length === 0 ? (
            <p className="text-gray-600">No active games. Create one to start playing!</p>
          ) : (
            <div className="grid gap-4">
              {activeGames.map((game: any) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Users className="text-indigo-600" />
                    <div>
                      <p className="font-medium">Room: {game.room_code}</p>
                      <p className="text-sm text-gray-600">
                        Host: {game.profiles?.username}
                      </p>
                      <p className="text-sm text-gray-600">
                        Players: {game.current_players}/{game.max_players}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => joinGame(game.id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    disabled={game.current_players >= game.max_players}
                  >
                    {game.current_players >= game.max_players ? 'Full' : 'Join Game'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}