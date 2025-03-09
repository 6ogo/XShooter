import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Trophy, Medal, Search, User, ArrowUp, Filter, Loader2 } from 'lucide-react';
import { Layout } from './Layout';
import { Avatar } from './Avatar';

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url?: string;
  twitter_handle?: string;
  wins: number;
  total_kills: number;
  total_shots: number;
  shots_hit: number;
  games_played: number;
  accuracy: number;
  kd_ratio: number;
}

interface LeaderboardFilter {
  type: 'wins' | 'total_kills' | 'accuracy' | 'games_played' | 'kd_ratio';
  label: string;
  icon: JSX.Element;
}

export function Leaderboard() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<LeaderboardFilter>({
    type: 'wins',
    label: 'Wins',
    icon: <Trophy className="h-4 w-4" />
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const filters: LeaderboardFilter[] = [
    { type: 'wins', label: 'Wins', icon: <Trophy className="h-4 w-4" /> },
    { type: 'total_kills', label: 'Kills', icon: <Medal className="h-4 w-4" /> },
    { type: 'accuracy', label: 'Accuracy', icon: <ArrowUp className="h-4 w-4" /> },
    { type: 'games_played', label: 'Games', icon: <Filter className="h-4 w-4" /> },
    { type: 'kd_ratio', label: 'K/D Ratio', icon: <ArrowUp className="h-4 w-4" /> }
  ];

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    
    checkAuth();
    
    const fetchLeaderboard = async () => {
      setLoading(true);
      
      try {
        // Get all required data
        const { data: leaderboardData, error: leaderboardError } = await supabase
          .from('leaderboard')
          .select('*')
          .order(currentFilter.type, { ascending: false })
          .limit(50);
          
        if (leaderboardError) throw leaderboardError;
        
        if (leaderboardData) {
          // Get user profiles to add usernames and avatars
          const playerIds = leaderboardData.map((p) => p.player_id);
          
          if (playerIds.length === 0) {
            setLeaderboard([]);
            setLoading(false);
            return;
          }
          
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', playerIds);
            
          if (profilesError) throw profilesError;
          
          // Get user metadata to extract avatar URLs and Twitter handles
          const { data: { users } } = await supabase.auth.admin.listUsers({
            perPage: 1000,
          }).catch(() => {
            // Fallback if admin functions are not available
            return { data: { users: [] }, error: null };
          });
          
          // Create a map for easier lookups
          const profileMap = new Map();
          profiles?.forEach(profile => {
            profileMap.set(profile.id, { username: profile.username });
          });
          
          // Add user metadata if available
          if (users && users.length > 0) {
            users.forEach(user => {
              if (profileMap.has(user.id)) {
                const profileData = profileMap.get(user.id);
                profileMap.set(user.id, {
                  ...profileData,
                  avatar_url: user.user_metadata?.avatar_url,
                  twitter_handle: user.user_metadata?.preferred_username
                });
              }
            });
          }
          
          // Process leaderboard data
          const processedData = leaderboardData.map((entry) => {
            const profile = profileMap.get(entry.player_id) || { username: 'Unknown Player' };
            
            // Calculate derived stats
            const accuracy = entry.total_shots > 0
              ? (entry.shots_hit / entry.total_shots) * 100
              : 0;
              
            // Calculate K/D ratio - deaths are approximated by games_played - wins
            const deaths = Math.max(1, entry.games_played - entry.wins); // Avoid division by zero
            const kdRatio = entry.total_kills / deaths;
            
            return {
              id: entry.player_id,
              username: profile.username,
              avatar_url: profile.avatar_url,
              twitter_handle: profile.twitter_handle,
              wins: entry.wins,
              total_kills: entry.total_kills,
              total_shots: entry.total_shots,
              shots_hit: entry.shots_hit,
              games_played: entry.games_played,
              accuracy: accuracy,
              kd_ratio: kdRatio
            };
          });
          
          // Sort data by the current filter
          processedData.sort((a, b) => b[currentFilter.type] - a[currentFilter.type]);
          
          setLeaderboard(processedData);
          
          // Find current user's rank
          if (currentUserId) {
            const userEntry = processedData.find(entry => entry.id === currentUserId);
            if (userEntry) {
              setUserRank(userEntry);
            } else {
              // Get user's stats directly if not in top 50
              const { data: userStats } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('player_id', currentUserId)
                .single();
                
              if (userStats) {
                const { data: userProfile } = await supabase
                  .from('profiles')
                  .select('username')
                  .eq('id', currentUserId)
                  .single();
                  
                if (userProfile) {
                  const accuracy = userStats.total_shots > 0
                    ? (userStats.shots_hit / userStats.total_shots) * 100
                    : 0;
                    
                  const deaths = Math.max(1, userStats.games_played - userStats.wins);
                  const kdRatio = userStats.total_kills / deaths;
                  
                  setUserRank({
                    id: currentUserId,
                    username: userProfile.username,
                    wins: userStats.wins,
                    total_kills: userStats.total_kills,
                    total_shots: userStats.total_shots,
                    shots_hit: userStats.shots_hit,
                    games_played: userStats.games_played,
                    accuracy: accuracy,
                    kd_ratio: kdRatio
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [currentFilter, currentUserId]);

  const handleFilterChange = (filter: LeaderboardFilter) => {
    setCurrentFilter(filter);
  };

  const filteredLeaderboard = searchTerm
    ? leaderboard.filter(entry => 
        entry.username.toLowerCase().includes(searchTerm.toLowerCase()))
    : leaderboard;

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500'; // Gold
    if (rank === 2) return 'text-gray-400'; // Silver
    if (rank === 3) return 'text-amber-600'; // Bronze
    return 'text-gray-300'; // Regular rank
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className={`font-bold ${getRankColor(rank)}`}>{rank}</span>;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/game/lobby')}
                className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
            </div>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            </div>
          </div>
          
          {/* Filter tabs */}
          <div className="flex mb-6 overflow-x-auto pb-2">
            {filters.map((filter) => (
              <button
                key={filter.type}
                onClick={() => handleFilterChange(filter)}
                className={`px-4 py-2 rounded-lg mr-2 flex items-center ${
                  currentFilter.type === filter.type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                } transition-colors whitespace-nowrap`}
              >
                {filter.icon}
                <span className="ml-2">{filter.label}</span>
              </button>
            ))}
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-gray-400">Loading leaderboard data...</p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="bg-gray-800 rounded-lg shadow-lg p-12 text-center">
              <User className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No players found</h2>
              <p className="text-gray-400">
                {searchTerm ? 'Try a different search term' : 'Be the first to join the leaderboard!'}
              </p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700 bg-gray-750">
                      <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-16">Rank</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Player</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
                        {currentFilter.label}
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
                        Kills
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
                        Accuracy
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
                        Games
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaderboard.map((entry, index) => {
                      const isCurrentUser = entry.id === currentUserId;
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-gray-700 ${
                            isCurrentUser ? 'bg-indigo-900/30' : (index % 2 === 0 ? 'bg-gray-750' : 'bg-gray-800')
                          } hover:bg-gray-700 transition-colors`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center">
                              {getMedalIcon(index + 1)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Avatar
                                username={entry.username}
                                imageUrl={entry.avatar_url}
                                size="sm"
                              />
                              <div className="ml-3">
                                <p className="text-white font-medium">
                                  {entry.username}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs bg-indigo-600 px-2 py-0.5 rounded-full">
                                      You
                                    </span>
                                  )}
                                </p>
                                {entry.twitter_handle && (
                                  <p className="text-gray-400 text-xs">@{entry.twitter_handle}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                            <span className="text-white">
                              {currentFilter.type === 'accuracy' && entry.accuracy.toFixed(1) + '%'}
                              {currentFilter.type === 'wins' && entry.wins}
                              {currentFilter.type === 'total_kills' && entry.total_kills}
                              {currentFilter.type === 'games_played' && entry.games_played}
                              {currentFilter.type === 'kd_ratio' && entry.kd_ratio.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                            {entry.total_kills}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center">
                              <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, entry.accuracy)}%` }}
                                ></div>
                              </div>
                              <span className="text-gray-300">{entry.accuracy.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                            {entry.games_played}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* User Stats Card */}
          {!loading && userRank && !searchTerm && (
            <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <User className="mr-2 h-5 w-5 text-indigo-400" />
                Your Stats
              </h2>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-1 flex items-center">
                    <Trophy className="h-4 w-4 mr-1 text-yellow-500" /> Wins
                  </p>
                  <p className="text-white text-2xl font-bold">{userRank.wins}</p>
                </div>
                
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-1 flex items-center">
                    <Medal className="h-4 w-4 mr-1 text-red-500" /> Kills
                  </p>
                  <p className="text-white text-2xl font-bold">{userRank.total_kills}</p>
                </div>
                
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-1 flex items-center">
                    <ArrowUp className="h-4 w-4 mr-1 text-green-500" /> Accuracy
                  </p>
                  <p className="text-white text-2xl font-bold">{userRank.accuracy.toFixed(1)}%</p>
                </div>
                
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-1 flex items-center">
                    <Filter className="h-4 w-4 mr-1 text-blue-500" /> K/D Ratio
                  </p>
                  <p className="text-white text-2xl font-bold">{userRank.kd_ratio.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="mt-4 py-3 px-4 bg-indigo-900/30 rounded-lg">
                <p className="text-indigo-300 text-sm flex items-center">
                  <Trophy className="h-4 w-4 mr-2" />
                  {userRank.games_played > 0 ? (
                    `Win rate: ${((userRank.wins / userRank.games_played) * 100).toFixed(1)}% (${userRank.wins} wins in ${userRank.games_played} games)`
                  ) : (
                    "Play your first game to see your win rate!"
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}