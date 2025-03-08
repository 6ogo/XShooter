import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Award, Lock, ArrowLeft } from 'lucide-react';

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
}

export function Achievements() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAchievements: 0,
    unlockedAchievements: 0,
    percentComplete: 0,
  });

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
        
        // Create a set of unlocked achievement IDs for easy lookup
        const unlockedAchievementIds = new Set(
          playerAchievements?.map(pa => pa.achievement_id) || []
        );
        
        // Map unlocked status to all achievements
        const achievementsWithStatus = allAchievements?.map(achievement => {
          const isUnlocked = unlockedAchievementIds.has(achievement.id);
          const unlocked = playerAchievements?.find(
            pa => pa.achievement_id === achievement.id
          );
          
          return {
            ...achievement,
            unlocked: isUnlocked,
            unlocked_at: unlocked?.unlocked_at,
          };
        }) || [];
        
        // Calculate stats
        const totalCount = achievementsWithStatus.length;
        const unlockedCount = achievementsWithStatus.filter(a => a.unlocked).length;
        const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
        
        setAchievements(achievementsWithStatus);
        setStats({
          totalAchievements: totalCount,
          unlockedAchievements: unlockedCount,
          percentComplete: percentage
        });
      } catch (error) {
        console.error('Error fetching achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [navigate]);

  const getAchievementIcon = () => {
    // Use Award as default icon for all achievements
    return <Award className="h-6 w-6" />;
  };

  const categories = [...new Set(achievements.map(a => a.category))];

  const filteredAchievements = filter 
    ? achievements.filter(a => a.category === filter)
    : achievements;

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/game/lobby')}
              className="text-white hover:text-gray-300"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-white">Achievements</h1>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-indigo-900 rounded-lg shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Your Progress</h2>
              <p className="text-indigo-200">
                {stats.unlockedAchievements} of {stats.totalAchievements} achievements unlocked
              </p>
            </div>
            <div className="text-3xl font-bold text-white">{stats.percentComplete}%</div>
          </div>
          <div className="w-full bg-indigo-950 rounded-full h-2.5">
            <div 
              className="bg-indigo-400 h-2.5 rounded-full" 
              style={{ width: `${stats.percentComplete}%` }}
            ></div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter(null)}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              filter === null 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-4 py-2 rounded-full capitalize whitespace-nowrap ${
                filter === category 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-white">Loading achievements...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredAchievements.map(achievement => (
              <div 
                key={achievement.id}
                className={`rounded-lg p-4 ${
                  achievement.unlocked 
                    ? 'bg-gradient-to-r from-indigo-900 to-indigo-800' 
                    : 'bg-gray-800 opacity-75'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-full ${
                    achievement.unlocked 
                      ? 'bg-indigo-600' 
                      : 'bg-gray-700'
                  }`}>
                    {achievement.unlocked ? (
                      getAchievementIcon()
                    ) : (
                      <Lock className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{achievement.name}</h3>
                    <p className="text-sm text-gray-300">{achievement.description}</p>
                    {achievement.unlocked && achievement.unlocked_at && (
                      <p className="text-xs text-indigo-300 mt-1">
                        Unlocked on {new Date(achievement.unlocked_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}