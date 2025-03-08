import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { 
  LogOut, 
  Trophy, 
  Settings as SettingsIcon, 
  Menu, 
  X as CloseIcon, 
  Award 
} from 'lucide-react';

interface NavigationBarProps {
  currentPage?: 'lobby' | 'game' | 'leaderboard' | 'achievements' | 'settings';
}

export function NavigationBar({ currentPage = 'lobby' }: NavigationBarProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  
  // Fetch profile data when component mounts
  useState(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
          
        if (profile) {
          setProfileData({
            username: profile.username,
            avatar_url: user.user_metadata?.avatar_url
          });
        }
      }
    };
    
    fetchProfile();
  });
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <nav className="bg-gray-800 text-white px-4 py-3">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link to="/game/lobby" className="text-xl font-bold">
          XShooter
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <Link
            to="/game/lobby"
            className={`hover:text-indigo-300 ${currentPage === 'lobby' ? 'text-indigo-400' : ''}`}
          >
            Lobby
          </Link>
          <Link
            to="/leaderboard"
            className={`flex items-center hover:text-indigo-300 ${currentPage === 'leaderboard' ? 'text-indigo-400' : ''}`}
          >
            <Trophy size={16} className="mr-1" />
            Leaderboard
          </Link>
          <Link
            to="/achievements"
            className={`flex items-center hover:text-indigo-300 ${currentPage === 'achievements' ? 'text-indigo-400' : ''}`}
          >
            <Award size={16} className="mr-1" />
            Achievements
          </Link>
          
          {/* Divider */}
          <div className="h-6 w-px bg-gray-600"></div>
          
          {/* Settings */}
          <Link 
            to="/settings"
            className={`hover:text-indigo-300 ${currentPage === 'settings' ? 'text-indigo-400' : ''}`}
          >
            <SettingsIcon size={18} />
          </Link>
          
          {/* Profile */}
          {profileData && (
            <div className="flex items-center">
              <Avatar 
                username={profileData.username} 
                imageUrl={profileData.avatar_url}
                size="sm"
              />
              <span className="ml-2">{profileData.username}</span>
            </div>
          )}
          
          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-white"
          >
            <LogOut size={18} />
          </button>
        </div>
        
        {/* Mobile menu button */}
        <button className="md:hidden" onClick={toggleMenu}>
          {menuOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden pt-2 pb-4 px-4">
          <div className="flex flex-col space-y-3">
            {profileData && (
              <div className="flex items-center py-2 border-b border-gray-700">
                <Avatar 
                  username={profileData.username} 
                  imageUrl={profileData.avatar_url}
                  size="sm"
                />
                <span className="ml-2">{profileData.username}</span>
              </div>
            )}
            
            <Link
              to="/game/lobby"
              className={`py-2 ${currentPage === 'lobby' ? 'text-indigo-400' : ''}`}
              onClick={toggleMenu}
            >
              Lobby
            </Link>
            <Link
              to="/leaderboard"
              className={`py-2 flex items-center ${currentPage === 'leaderboard' ? 'text-indigo-400' : ''}`}
              onClick={toggleMenu}
            >
              <Trophy size={16} className="mr-2" />
              Leaderboard
            </Link>
            <Link
              to="/achievements"
              className={`py-2 flex items-center ${currentPage === 'achievements' ? 'text-indigo-400' : ''}`}
              onClick={toggleMenu}
            >
              <Award size={16} className="mr-2" />
              Achievements
            </Link>
            <Link
              to="/settings"
              className={`py-2 flex items-center ${currentPage === 'settings' ? 'text-indigo-400' : ''}`}
              onClick={toggleMenu}
            >
              <SettingsIcon size={16} className="mr-2" />
              Settings
            </Link>
            <button
              onClick={() => {
                handleSignOut();
                toggleMenu();
              }}
              className="py-2 flex items-center text-red-400"
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}