import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { Users, Swords, Trophy, Award } from 'lucide-react';

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
            <button
              onClick={createGame}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Swords size={20} />
              Create Game
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Active Games</h2>
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
