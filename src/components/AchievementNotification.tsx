// src/components/AchievementNotification.tsx
import { useEffect, useState } from 'react';
import { Award, X, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AchievementNotificationProps {
  achievement: {
    id?: string;
    name: string;
    description: string;
    category?: string;
  } | null;
  onClose: () => void;
}

export function AchievementNotification({ 
  achievement, 
  onClose 
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [achievementDetails, setAchievementDetails] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      setExpanded(false);
      
      // If we have the achievement ID, fetch additional details like category and icon
      if (achievement.id) {
        fetchAchievementDetails(achievement.id);
      } else {
        setAchievementDetails(achievement);
      }
      
      // Auto-hide after 5 seconds if not expanded
      const timer = setTimeout(() => {
        if (!expanded) {
          setIsVisible(false);
          setTimeout(onClose, 500); // Give time for animation to complete
        }
      }, 5000);
      
      // Play achievement sound
      try {
        const achievementSound = new Audio('/achievement.mp3');
        achievementSound.volume = 0.7;
        achievementSound.play().catch(e => console.error('Error playing achievement sound:', e));
      } catch (error) {
        console.error('Error playing achievement sound:', error);
      }
      
      return () => clearTimeout(timer);
    }
  }, [achievement, onClose, expanded]);

  const fetchAchievementDetails = async (achievementId: string) => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('id', achievementId)
        .single();
        
      if (error) throw error;
      if (data) {
        setAchievementDetails(data);
      }
    } catch (error) {
      console.error('Error fetching achievement details:', error);
      setAchievementDetails(achievement); // Fallback to basic info
    }
  };
  
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };
  
  // Get category-specific colors
  const getCategoryColor = () => {
    const category = achievementDetails?.category || 'default';
    
    switch (category.toLowerCase()) {
      case 'combat':
        return 'from-red-600 to-red-800';
      case 'skill':
        return 'from-yellow-600 to-amber-800';
      case 'survival':
        return 'from-green-600 to-green-800';
      case 'social':
        return 'from-blue-600 to-blue-800';
      case 'progression':
        return 'from-purple-600 to-purple-800';
      default:
        return 'from-indigo-600 to-indigo-800';
    }
  };
  
  // Get category icon
  const getCategoryIcon = () => {
    return <Award className="h-6 w-6 text-white" />;
  };

  if (!achievement) return null;

  return (
    <div 
      className={`fixed ${expanded ? 'inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50' : 'bottom-4 right-4 z-40'} transition-all duration-300`}
    >
      <div 
        className={`${
          expanded 
            ? 'w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-6' 
            : 'bg-gray-900 text-white rounded-lg shadow-xl p-4 max-w-sm transition-all duration-500'
        } ${
          isVisible 
            ? 'translate-x-0 opacity-100' 
            : 'translate-x-full opacity-0'
        }`}
      >
        {/* Header section */}
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-yellow-400 text-lg">Achievement Unlocked!</h3>
          <button 
            onClick={expanded ? toggleExpanded : onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Achievement content */}
        <div className="flex items-start gap-4">
          {/* Icon with gradient background based on category */}
          <div className={`p-3 rounded-full bg-gradient-to-br ${getCategoryColor()} flex items-center justify-center flex-shrink-0`}>
            {getCategoryIcon()}
          </div>
          
          <div className="flex-1">
            <h4 className="font-medium text-white text-lg">
              {achievementDetails?.name || achievement.name}
            </h4>
            <p className="text-gray-300 mt-1">
              {achievementDetails?.description || achievement.description}
            </p>
            
            {!expanded && (
              <button 
                onClick={toggleExpanded}
                className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm flex items-center"
              >
                Details <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            )}
          </div>
        </div>
        
        {/* Expanded details */}
        {expanded && achievementDetails && (
          <div className="mt-6 border-t border-gray-700 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-gray-400 text-sm">Category</h5>
                <p className="text-white capitalize">{achievementDetails.category || 'General'}</p>
              </div>
              <div>
                <h5 className="text-gray-400 text-sm">Type</h5>
                <p className="text-white capitalize">{achievementDetails.requirement_type?.replace(/_/g, ' ') || 'Special'}</p>
              </div>
              <div>
                <h5 className="text-gray-400 text-sm">Rarity</h5>
                <p className="text-white">
                  {achievementDetails.rarity === 'common' ? 'Common' :
                   achievementDetails.rarity === 'rare' ? 'Rare' :
                   achievementDetails.rarity === 'epic' ? 'Epic' :
                   achievementDetails.rarity === 'legendary' ? 'Legendary' : 
                   'Uncommon'}
                </p>
              </div>
              <div>
                <h5 className="text-gray-400 text-sm">Unlocked</h5>
                <p className="text-white">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
            
            {/* View all achievements button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/achievements';
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                View All Achievements
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}