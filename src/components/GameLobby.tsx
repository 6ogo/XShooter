import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { Trophy, Award, Twitter, Users, Gamepad2, Zap, Info, Settings as SettingsIcon, LogOut, HelpCircle } from 'lucide-react';
import { Layout } from './Layout';
import { Avatar } from './Avatar';
import { GameSettings } from './GameSettings';

interface UserData {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
}

export function GameLobby() {
  const [roomCode, setRoomCodeState] = useState<string>('');
  const gameLink = `${window.location.origin}/game/${roomCode}`;
  const { setGameId, setRoomCode, setIsHost, reset } = useGameStore();
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingGame, setCreatingGame] = useState(false);
  const [joiningGame, setJoiningGame] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Reset game store when entering lobby
    reset();
    
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();

          if (data) {
            setUserData({ 
              id: user.id, 
              username: data.username, 
              email: user.email,
              avatar_url: user.user_metadata?.avatar_url 
            });
          }
          setCurrentUser(user);
          setTwitterHandle(user.user_metadata?.preferred_username || user.user_metadata?.user_name || null);
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    
    // Check if this is the first time a user has visited the lobby
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
      localStorage.setItem('hasSeenTutorial', 'true');
    }
  }, [navigate, reset]);

  useEffect(() => {
    const fetchGames = async () => {
      const { data: games, error } = await supabase
        .from('games')
        .select('*, profiles!games_host_id_fkey(username)')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });

      if (!error && games) {
        setActiveGames(games);
      }
      setLoading(false);
    };

    fetchGames();

    const gameSubscription = supabase
      .channel('games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchGames)
      .subscribe();

    return () => {
      gameSubscription.unsubscribe();
    };
  }, []);

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
      setRoomCodeState(generatedRoomCode);
      setRoomCode(generatedRoomCode);
      setIsHost(true);
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
        throw new Error('Game not found or has already started');
      }

      if (game.current_players >= game.max_players) {
        throw new Error('Game is full');
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
        
        // Check if user is already in this game
        const { data: existingPlayer } = await supabase
          .from('game_players')
          .select('id')
          .eq('game_id', game.id)
          .eq('player_id', currentUser.id)
          .single();
          
        if (!existingPlayer) {
          // Add player to existing game
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
        }
      } else {
        // Create new game if none available
        const { data: newGame, error: newGameError } = await supabase
          .from('games')
          .insert({
            host_id: currentUser.id,
            current_players: 1,
            max_players: 18,
            status: 'waiting',
            room_code: `QUICK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          })
          .select()
          .single();

        if (newGameError) throw newGameError;
        game = newGame;
        
        // Add creator to the game
        await supabase
          .from('game_players')
          .insert({
            game_id: game.id,
            player_id: currentUser.id,
            position_x: 0,
            position_y: 0,
          });
      }

      setGameId(game.id);
      setRoomCode(game.room_code || null);
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
    setRoomCode('');
    setIsHost(true);
    navigate('/game/singleplayer');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffSecs < 60) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 border-4 border-t-indigo-500 border-gray-700 rounded-full animate-spin mb-4"></div>
          <p className="text-white">Loading game lobby...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {userData && (
            <div className="flex justify-between items-center mb-6 text-white">
              <div className="flex items-center gap-2">
                <Avatar 
                  username={userData.username} 
                  imageUrl={userData.avatar_url}
                  size="sm"
                />
                <span className="font-medium">{userData.username}</span>
                {twitterHandle && (
                  <div className="flex items-center text-blue-400 text-xs">
                    <Twitter size={12} className="mr-1" />
                    @{twitterHandle}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <SettingsIcon size={16} />
                  <span className="text-sm">Settings</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <LogOut size={16} />
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-white">Game Lobby</h1>
              <button 
                onClick={() => setShowTutorial(true)}
                className="ml-2 text-gray-400 hover:text-white"
                title="Show Tutorial"
              >
                <HelpCircle size={18} />
              </button>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/achievements')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-yellow-500 text-white rounded-lg hover:from-yellow-700 hover:to-yellow-600 transition-all duration-200 shadow-lg"
              >
                <Award size={20} />
                Achievements
              </button>
              <button
                onClick={() => navigate('/leaderboard')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-all duration-200 shadow-lg"
              >
                <Trophy size={20} />
                Leaderboard
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-600 text-white rounded-lg flex items-center">
              <Info className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-6 p-4 bg-green-600 text-white rounded-lg flex items-center">
              <Info className="h-5 w-5 mr-2" />
              {successMessage}
            </div>
          )}
          
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Game Options Panel */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-6">Play XShooter</h2>
                
                <div className="space-y-4">
                  <button
                    onClick={createGame}
                    disabled={creatingGame}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 transition-all duration-200 flex justify-center items-center gap-2 shadow-lg"
                  >
                    {creatingGame ? (
                      <>
                        <div className="h-5 w-5 border-2 border-t-white border-white/20 rounded-full animate-spin"></div>
                        Creating Game...
                      </>
                    ) : (
                      <>
                        <Users size={18} />
                        Create New Game
                      </>
                    )}
                  </button>
                  
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      placeholder="Enter Room Code"
                      className="flex-1 p-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                    />
                    <button
                      onClick={joinGame}
                      disabled={joiningGame || !roomCodeInput}
                      className="py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 shadow-lg"
                    >
                      {joiningGame ? (
                        <div className="h-5 w-5 border-2 border-t-white border-white/20 rounded-full animate-spin"></div>
                      ) : (
                        'Join'
                      )}
                    </button>
                  </div>
                  
                  <button
                    onClick={joinQuickplay}
                    disabled={joiningGame}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all duration-200 flex justify-center items-center gap-2 shadow-lg"
                  >
                    {joiningGame ? (
                      <>
                        <div className="h-5 w-5 border-2 border-t-white border-white/20 rounded-full animate-spin"></div>
                        Finding Game...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        Quickplay
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={startSingleplayer}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-700 hover:to-purple-600 transition-all duration-200 flex justify-center items-center gap-2 shadow-lg"
                  >
                    <Gamepad2 size={18} />
                    Singleplayer
                  </button>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4">Game Information</h3>
                  <ul className="space-y-3 text-gray-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <span>Players start with 100 HP and shoot to reduce opponents' health</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <span>Fire 5 shots in a burst, followed by a 3-second cooldown</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <span>Last player standing wins the match</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Active Games Panel */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-6">Active Games</h2>
                
                {activeGames.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
                    <Users className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 mb-2">No active games found</p>
                    <p className="text-gray-500 text-sm">Create a new game or join quickplay</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-3 px-2">Host</th>
                          <th className="pb-3 px-2">Room Code</th>
                          <th className="pb-3 px-2">Players</th>
                          <th className="pb-3 px-2">Created</th>
                          <th className="pb-3 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeGames.map((game) => (
                          <tr key={game.id} className="border-b border-gray-700">
                            <td className="py-3 px-2 text-white">
                              {game.profiles?.username || 'Unknown'}
                            </td>
                            <td className="py-3 px-2 text-gray-300 font-mono">
                              {game.room_code || '-'}
                            </td>
                            <td className="py-3 px-2 text-gray-300">
                              {game.current_players}/{game.max_players}
                            </td>
                            <td className="py-3 px-2 text-gray-400 text-sm">
                              {formatTimeAgo(game.created_at)}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <button
                                onClick={() => {
                                  setRoomCodeInput(game.room_code);
                                  joinGame();
                                }}
                                disabled={joiningGame || game.current_players >= game.max_players}
                                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                              >
                                {game.current_players >= game.max_players ? 'Full' : 'Join'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              {/* Recent Activity Panel */}
              <div className="mt-6 bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">Your Recent Activity</h2>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-gray-400 text-sm mb-1">Games Played</h3>
                    <p className="text-white text-2xl font-bold">-</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-gray-400 text-sm mb-1">Wins</h3>
                    <p className="text-white text-2xl font-bold">-</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-gray-400 text-sm mb-1">Kills</h3>
                    <p className="text-white text-2xl font-bold">-</p>
                  </div>
                </div>
                
                <p className="text-center text-gray-500 text-sm">
                  View detailed statistics on the Leaderboard
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Game Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full">
            <GameSettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
      
      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="max-w-3xl w-full bg-gray-800 rounded-lg shadow-2xl p-6 text-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Welcome to XShooter!</h2>
              <button 
                onClick={() => setShowTutorial(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-400">Game Overview</h3>
                <p className="text-gray-300">
                  XShooter is a fast-paced 2D multiplayer shooter game where players compete to be the last one standing.
                  Players are represented by their X profile pictures and shoot small balls at each other to reduce opponents' health.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-400">Game Modes</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <Users className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Create Game:</strong> Host your own game and invite friends with a room code</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Quickplay:</strong> Join an existing game or create one that others can join</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Gamepad2 className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Singleplayer:</strong> Practice against AI opponents</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-400">Controls</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Desktop</h4>
                    <ul className="space-y-1 text-gray-300 text-sm">
                      <li>Move: WASD or Arrow Keys</li>
                      <li>Shoot: Click in direction</li>
                      <li>Aim: Mouse position</li>
                    </ul>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Mobile</h4>
                    <ul className="space-y-1 text-gray-300 text-sm">
                      <li>Move: Left side joystick</li>
                      <li>Shoot: Tap right side</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-400">Gameplay Tips</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>Stay mobile to avoid enemy shots</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>Use all 5 shots in your burst effectively</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>Plan your movements during cooldown periods</span>
                  </li>
                </ul>
              </div>
              
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setShowTutorial(false)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}