import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { 
  LogOut, 
  Trophy, 
  Settings as SettingsIcon, 
  Menu, 
  X as CloseIcon, 
  Award,
  Home,
  Twitter,
  HelpCircle,
  Bell
} from 'lucide-react';

interface UserData {
  id: string;
  username: string;
  avatar_url?: string;
}

interface Notification {
  id: string;
  type: 'achievement' | 'game' | 'social' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  timestamp: string;
}

interface NavigationBarProps {
  currentPage?: 'lobby' | 'game' | 'leaderboard' | 'achievements' | 'settings';
}

export function NavigationBar({ currentPage = 'lobby' }: NavigationBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Detect active page from location if not provided as prop
  const activePage = currentPage || (
    location.pathname.includes('/leaderboard') ? 'leaderboard' :
    location.pathname.includes('/achievements') ? 'achievements' :
    location.pathname.includes('/settings') ? 'settings' :
    location.pathname.includes('/game/') ? 'game' : 
    'lobby'
  );

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
            
          if (profile) {
            setUserData({
              id: user.id,
              username: profile.username,
              avatar_url: user.user_metadata?.avatar_url
            });
            
            setTwitterHandle(user.user_metadata?.preferred_username || null);
          }
          
          // Fetch notifications (example - would be implemented with a real table)
          // This is just mockup data
          const mockNotifications: Notification[] = [
            {
              id: '1',
              type: 'achievement',
              title: 'Achievement Unlocked',
              message: 'You unlocked the "Sharpshooter" achievement!',
              isRead: false,
              timestamp: new Date(Date.now() - 30 * 60000).toISOString()
            },
            {
              id: '2',
              type: 'game',
              title: 'Game Invitation',
              message: 'Player123 invited you to join their game',
              isRead: true,
              timestamp: new Date(Date.now() - 2 * 3600000).toISOString()
            },
            {
              id: '3',
              type: 'system',
              title: 'Welcome to XShooter',
              message: 'Thanks for joining! Check out the tutorial to get started.',
              isRead: true,
              timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
            }
          ];
          
          setNotifications(mockNotifications);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    if (userDropdownOpen) setUserDropdownOpen(false);
    if (notificationsOpen) setNotificationsOpen(false);
  };
  
  const toggleUserDropdown = () => {
    setUserDropdownOpen(!userDropdownOpen);
    if (notificationsOpen) setNotificationsOpen(false);
  };
  
  const toggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
    if (userDropdownOpen) setUserDropdownOpen(false);
  };
  
  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Convert to minutes, hours, days
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  return (
    <nav className="bg-gray-800 text-white border-b border-gray-700 shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/game/lobby" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600">
            XShooter
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              to="/game/lobby"
              className={`px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors ${activePage === 'lobby' ? 'bg-indigo-600' : ''}`}
            >
              <div className="flex items-center">
                <Home size={18} className="mr-2" />
                Lobby
              </div>
            </Link>
            <Link
              to="/leaderboard"
              className={`px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors ${activePage === 'leaderboard' ? 'bg-indigo-600' : ''}`}
            >
              <div className="flex items-center">
                <Trophy size={18} className="mr-2" />
                Leaderboard
              </div>
            </Link>
            <Link
              to="/achievements"
              className={`px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors ${activePage === 'achievements' ? 'bg-indigo-600' : ''}`}
            >
              <div className="flex items-center">
                <Award size={18} className="mr-2" />
                Achievements
              </div>
            </Link>
            
            {/* Help button */}
            <button 
              onClick={() => navigate('/help')}
              className="px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              aria-label="Help"
            >
              <HelpCircle size={18} />
            </button>
          </div>
          
          {/* User Section */}
          <div className="flex items-center">
            {/* Notifications */}
            <div className="relative mr-2">
              <button 
                onClick={toggleNotifications}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
              
              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50">
                  <div className="flex justify-between items-center p-3 border-b border-gray-700">
                    <h3 className="font-medium">Notifications</h3>
                    <button 
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Mark all as read
                    </button>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-400">
                        No notifications
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div 
                          key={notification.id}
                          className={`p-3 border-b border-gray-700 hover:bg-gray-750 ${!notification.isRead ? 'bg-indigo-900/20' : ''}`}
                        >
                          <div className="flex">
                            <div className={`w-2 h-2 rounded-full mt-2 mr-2 ${!notification.isRead ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <h4 className="font-medium text-sm">{notification.title}</h4>
                                <span className="text-xs text-gray-400">{formatTime(notification.timestamp)}</span>
                              </div>
                              <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="p-2 border-t border-gray-700 text-center">
                    <button className="text-sm text-indigo-400 hover:text-indigo-300">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Settings */}
            <Link 
              to="/settings"
              className={`p-2 rounded-lg hover:bg-gray-700 transition-colors mr-2 ${activePage === 'settings' ? 'bg-gray-700' : ''}`}
              aria-label="Settings"
            >
              <SettingsIcon size={20} />
            </Link>
            
            {/* User Profile */}
            {!loading && userData && (
              <div className="relative">
                <button 
                  onClick={toggleUserDropdown}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Avatar 
                    username={userData.username} 
                    imageUrl={userData.avatar_url}
                    size="sm"
                  />
                  <span className="hidden lg:block">{userData.username}</span>
                </button>
                
                {/* User Dropdown */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50">
                    <div className="p-3 border-b border-gray-700">
                      <div className="font-medium">{userData.username}</div>
                      {twitterHandle && (
                        <div className="text-sm text-gray-400 flex items-center">
                          <Twitter size={12} className="mr-1 text-blue-400" />
                          @{twitterHandle}
                        </div>
                      )}
                    </div>
                    
                    <div className="py-1">
                      <Link 
                        to="/settings"
                        className="block px-4 py-2 text-sm hover:bg-gray-700"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        Profile Settings
                      </Link>
                      <Link 
                        to="/achievements"
                        className="block px-4 py-2 text-sm hover:bg-gray-700"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        My Achievements
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-gray-700 border-t border-gray-700 mt-1"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Mobile menu button */}
            <button 
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors md:hidden ml-2"
              onClick={toggleMenu}
            >
              {menuOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pt-4 pb-2">
            <div className="flex flex-col space-y-1">
              <Link
                to="/game/lobby"
                className={`px-3 py-2 rounded-lg ${activePage === 'lobby' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
                onClick={toggleMenu}
              >
                <div className="flex items-center">
                  <Home size={18} className="mr-3" />
                  Lobby
                </div>
              </Link>
              <Link
                to="/leaderboard"
                className={`px-3 py-2 rounded-lg ${activePage === 'leaderboard' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
                onClick={toggleMenu}
              >
                <div className="flex items-center">
                  <Trophy size={18} className="mr-3" />
                  Leaderboard
                </div>
              </Link>
              <Link
                to="/achievements"
                className={`px-3 py-2 rounded-lg ${activePage === 'achievements' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
                onClick={toggleMenu}
              >
                <div className="flex items-center">
                  <Award size={18} className="mr-3" />
                  Achievements
                </div>
              </Link>
              <Link
                to="/settings"
                className={`px-3 py-2 rounded-lg ${activePage === 'settings' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
                onClick={toggleMenu}
              >
                <div className="flex items-center">
                  <SettingsIcon size={18} className="mr-3" />
                  Settings
                </div>
              </Link>
              <Link
                to="/help"
                className={`px-3 py-2 rounded-lg hover:bg-gray-700`}
                onClick={toggleMenu}
              >
                <div className="flex items-center">
                  <HelpCircle size={18} className="mr-3" />
                  Help & Support
                </div>
              </Link>
              <button
                onClick={() => {
                  handleSignOut();
                  toggleMenu();
                }}
                className="flex items-center px-3 py-2 rounded-lg text-red-400 hover:bg-gray-700 mt-2 border-t border-gray-700 pt-3"
              >
                <LogOut size={18} className="mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}