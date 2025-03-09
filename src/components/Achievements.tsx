import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Award, 
  Lock, 
  ArrowLeft, 
  Trophy, 
  Target, 
  Zap, 
  Shield, 
  Users, 
  Star,
  Filter,
  Search,
  Loader2
} from 'lucide-react';
import { Layout } from './Layout';

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  unlocked: boolean;
  unlocked_at?: string;
  progress?: number;
}

interface CategoryStats {
  [key: string]: {
    total: number;
    unlocked: number;
  }
}

export function Achievements() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [stats, setStats] = useState({
    totalAchievements: 0,
    unlockedAchievements: 0,
    percentComplete: 0,
  });
  const [categoryStats, setCategoryStats] = useState<CategoryStats>({});

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/');
          return;
        }
        
        // Fetch all achievements
        const { data: allAchievements, error: achievementsError } = await supabase
          .from('achievements')
          .select('*')
          .order('category');
          
        if (achievementsError) throw achievementsError;
        
        // Fetch user's unlocked achievements
        const { data: playerAchievements, error: playerAchievementsError } = await supabase
          .from('player_achievements')
          .select('achievement_id, unlocked_at')
          .eq('player_id', user.id);
          
        if (playerAchievementsError) throw playerAchievementsError;
        
        // Fetch user's progress data
        const { data: leaderboardData, error: leaderboardError } = await supabase
          .from('leaderboard')
          .select('*')
          .eq('player_id', user.id)
          .single();
          
        if (leaderboardError && leaderboardError.code !== 'PGRST116') {
          throw leaderboardError;
        }
        
        // Create a set of unlocked achievement IDs for easy lookup
        const unlockedAchievementIds = new Set(
          playerAchievements?.map(pa => pa.achievement_id) || []
        );
        
        // Map of unlocked achievements with timestamps
        const unlockedMap = new Map();
        playerAchievements?.forEach(pa => {
          unlockedMap.set(pa.achievement_id, pa.unlocked_at);
        });
        
        // Map unlocked status to all achievements and calculate progress
        const achievementsWithStatus = allAchievements?.map(achievement => {
          const isUnlocked = unlockedAchievementIds.has(achievement.id);
          const unlocked_at = unlockedMap.get(achievement.id);
          
          // Calculate progress based on achievement type and user stats
          let progress = 0;
          if (leaderboardData) {
            switch (achievement.requirement_type) {
              case 'cumulative':
                switch (achievement.name) {
                  case 'Deadeye':
                    progress = (leaderboardData.shots_hit / achievement.requirement_value) * 100;
                    break;
                  case 'Assassin':
                    progress = (leaderboardData.total_kills / achievement.requirement_value) * 100;
                    break;
                  case 'Social Butterfly':
                  case 'Host Master':
                  case 'Veteran':
                    progress = (leaderboardData.games_played / achievement.requirement_value) * 100;
                    break;
                  default:
                    progress = 0;
                }
                break;
              default:
                progress = isUnlocked ? 100 : 0;
            }
          }
          
          return {
            ...achievement,
            unlocked: isUnlocked,
            unlocked_at,
            progress: Math.min(100, progress)
          };
        }) || [];
        
        // Calculate stats
        const totalCount = achievementsWithStatus.length;
        const unlockedCount = achievementsWithStatus.filter(a => a.unlocked).length;
        const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
        
        // Calculate category stats
        const categories = {} as CategoryStats;
        achievementsWithStatus.forEach(achievement => {
          if (!categories[achievement.category]) {
            categories[achievement.category] = { total: 0, unlocked: 0 };
          }
          
          categories[achievement.category].total++;
          if (achievement.unlocked) {
            categories[achievement.category].unlocked++;
          }
        });
        
        setAchievements(achievementsWithStatus);
        setStats({
          totalAchievements: totalCount,
          unlockedAchievements: unlockedCount,
          percentComplete: percentage
        });
        setCategoryStats(categories);
        
        // Select first achievement for details view
        if (achievementsWithStatus.length > 0) {
          setSelectedAchievement(achievementsWithStatus[0]);
        }
      } catch (error) {
        console.error('Error fetching achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [navigate]);

  const getAchievementIcon = (achievement: Achievement) => {
    // Use icon from achievement data or fallback to a default based on category
    switch (achievement.category) {
      case 'combat':
        return <Target className="h-6 w-6 text-red-400" />;
      case 'skill':
        return <Star className="h-6 w-6 text-yellow-400" />;
      case 'survival':
        return <Shield className="h-6 w-6 text-blue-400" />;
      case 'social':
        return <Users className="h-6 w-6 text-green-400" />;
      case 'progression':
        return <Trophy className="h-6 w-6 text-purple-400" />;
      default:
        return <Award className="h-6 w-6 text-indigo-400" />;
    }
  };

  const categoryIcons = {
    combat: <Target className="h-5 w-5" />,
    skill: <Star className="h-5 w-5" />,
    survival: <Shield className="h-5 w-5" />,
    social: <Users className="h-5 w-5" />,
    progression: <Trophy className="h-5 w-5" />,
  };

  const categories = Object.keys(categoryStats);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredAchievements = achievements
    .filter(a => filter ? a.category === filter : true)
    .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 a.description.toLowerCase().includes(searchTerm.toLowerCase()));

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
              <h1 className="text-3xl font-bold text-white">Achievements</h1>
            </div>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Search achievements..."
                value={searchTerm}
                onChange={handleSearch}
                className="bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            </div>
          </div>

          {/* Progress Overview */}
          <div className="bg-gradient-to-r from-indigo-800 to-indigo-900 rounded-lg shadow-xl p-6 mb-6 border border-indigo-700">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <Award className="mr-2 h-6 w-6 text-yellow-300" />
                  Your Achievement Progress
                </h2>
                <p className="text-indigo-200">
                  {stats.unlockedAchievements} of {stats.totalAchievements} achievements unlocked
                </p>
              </div>
              <div className="bg-indigo-950/70 px-4 py-2 rounded-lg">
                <div className="text-3xl font-bold text-white">{stats.percentComplete}%</div>
                <div className="text-xs text-indigo-300">Completion</div>
              </div>
            </div>
            <div className="w-full bg-indigo-950 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-indigo-400 to-indigo-300 h-3 rounded-full" 
                style={{ width: `${stats.percentComplete}%` }}
              ></div>
            </div>
            
            {/* Category progress */}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
              {categories.map(category => (
                <div key={category} className="bg-indigo-950/50 rounded-lg p-3" onClick={() => setFilter(category === filter ? null : category)} role="button">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      {categoryIcons[category as keyof typeof categoryIcons]}
                      <span className="ml-2 text-sm font-medium text-white capitalize">{category}</span>
                    </div>
                    <span className="text-xs text-indigo-300">
                      {categoryStats[category].unlocked}/{categoryStats[category].total}
                    </span>
                  </div>
                  <div className="w-full bg-indigo-950 rounded-full h-1.5">
                    <div 
                      className="bg-indigo-400 h-1.5 rounded-full" 
                      style={{ width: `${(categoryStats[category].unlocked / categoryStats[category].total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter(null)}
              className={`px-4 py-2 rounded-full whitespace-nowrap flex items-center ${
                filter === null 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              } transition-colors`}
            >
              <Filter className="mr-2 h-4 w-4" />
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setFilter(category === filter ? null : category)}
                className={`px-4 py-2 rounded-full capitalize whitespace-nowrap flex items-center ${
                  filter === category 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                } transition-colors`}
              >
                {categoryIcons[category as keyof typeof categoryIcons]}
                <span className="ml-2">{category}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-gray-400">Loading achievements...</p>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              {/* Achievement List */}
              <div className="col-span-1 lg:col-span-2">
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredAchievements.length === 0 ? (
                    <div className="md:col-span-2 bg-gray-800 rounded-lg p-10 text-center border border-gray-700">
                      <Award className="h-16 w-16 mx-auto text-gray-700 mb-4" />
                      <h3 className="text-white text-lg font-medium mb-2">No achievements found</h3>
                      <p className="text-gray-400">Try adjusting your search or filter criteria</p>
                    </div>
                  ) : (
                    filteredAchievements.map(achievement => (
                      <div 
                        key={achievement.id}
                        className={`rounded-lg p-4 cursor-pointer border ${
                          selectedAchievement?.id === achievement.id
                            ? 'border-indigo-500 bg-indigo-900/30' 
                            : achievement.unlocked
                              ? 'bg-gray-800 border-gray-700 hover:border-indigo-400'
                              : 'bg-gray-800/60 border-gray-700 hover:border-gray-600'
                        } transition-all`}
                        onClick={() => setSelectedAchievement(achievement)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-full ${
                            achievement.unlocked 
                              ? 'bg-indigo-600' 
                              : 'bg-gray-700'
                          }`}>
                            {achievement.unlocked ? (
                              getAchievementIcon(achievement)
                            ) : (
                              <Lock className="h-6 w-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h3 className="font-semibold text-white">{achievement.name}</h3>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                achievement.unlocked
                                  ? 'bg-green-900/60 text-green-300'
                                  : 'bg-gray-700 text-gray-400'
                              }`}>
                                {achievement.unlocked ? 'Unlocked' : 'Locked'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 mt-1 line-clamp-2">{achievement.description}</p>
                            
                            {/* Progress bar */}
                            <div className="mt-2">
                              <div className="w-full bg-gray-700 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    achievement.unlocked ? 'bg-green-500' : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${achievement.progress || 0}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-xs text-gray-400">
                                  {achievement.unlocked ? 'Completed' : `${Math.floor(achievement.progress || 0)}%`}
                                </span>
                                {achievement.unlocked && achievement.unlocked_at && (
                                  <span className="text-xs text-indigo-300">
                                    {new Date(achievement.unlocked_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Achievement Details */}
              <div className="col-span-1">
                {selectedAchievement && (
                  <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 sticky top-6">
                    <div className="flex justify-center mb-6">
                      <div className={`p-6 rounded-full ${
                        selectedAchievement.unlocked 
                          ? 'bg-gradient-to-br from-indigo-600 to-indigo-800'
                          : 'bg-gradient-to-br from-gray-700 to-gray-800'
                      }`}>
                        {selectedAchievement.unlocked ? (
                          getAchievementIcon(selectedAchievement)
                        ) : (
                          <Lock className="h-10 w-10 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    <h2 className="text-xl font-bold text-white text-center mb-2">
                      {selectedAchievement.name}
                    </h2>
                    
                    <div className="flex justify-center mb-4">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                        selectedAchievement.unlocked
                          ? 'bg-green-900/60 text-green-300'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {selectedAchievement.unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    
                    <p className="text-gray-300 text-center mb-6">{selectedAchievement.description}</p>
                    
                    <div className="mb-6">
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.floor(selectedAchievement.progress || 0)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            selectedAchievement.unlocked ? 'bg-green-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${selectedAchievement.progress || 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Category:</span>
                        <span className="text-white capitalize">{selectedAchievement.category}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Type:</span>
                        <span className="text-white capitalize">{selectedAchievement.requirement_type}</span>
                      </div>
                      
                      {selectedAchievement.unlocked && selectedAchievement.unlocked_at && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Unlocked on:</span>
                          <span className="text-white">
                            {new Date(selectedAchievement.unlocked_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {!selectedAchievement.unlocked && (
                      <div className="mt-8 p-4 bg-indigo-900/30 rounded-lg">
                        <h4 className="font-medium text-white mb-2 flex items-center">
                          <Zap className="h-4 w-4 mr-1" /> How to unlock
                        </h4>
                        <p className="text-sm text-indigo-300">
                          {selectedAchievement.requirement_type === 'single_game' && "Complete this in a single game"}
                          {selectedAchievement.requirement_type === 'cumulative' && "Progress across multiple games"}
                          {selectedAchievement.requirement_type === 'streak' && "Complete in consecutive games"}
                          {selectedAchievement.requirement_type === 'rank' && "Achieve a specific rank"}
                          {selectedAchievement.requirement_type === 'secret' && "Complete a hidden challenge"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}