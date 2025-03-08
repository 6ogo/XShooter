import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';

interface AchievementNotificationProps {
  achievement: {
    name: string;
    description: string;
  } | null;
  onClose: () => void;
}

export function AchievementNotification({ 
  achievement, 
  onClose 
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 500); // Give time for animation to complete
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [achievement, onClose]);

  if (!achievement) return null;

  return (
    <div 
      className={`fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-lg p-4 max-w-sm transition-all duration-500 ${
        isVisible 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="bg-yellow-500 p-2 rounded-full">
          <Award className="h-6 w-6 text-gray-900" />
        </div>
        <div>
          <h3 className="font-bold text-yellow-400">Achievement Unlocked!</h3>
          <p className="font-medium">{achievement.name}</p>
          <p className="text-sm text-gray-300 mt-1">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}
