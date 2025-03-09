// src/components/NavigationBar.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { notificationService, Notification } from '../lib/notificationService';
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
  Bell,
  Check,
  AlertCircle,
  MessageSquare,
  Gamepad
} from 'lucide-react';

interface UserData {
  id: string;
  username: string;
  avatar_url?: string;
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
  const [loading, setLoading] = useState(true);
  
  // Replace placeholder notifications with real ones
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  
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
          
          // Fetch real notifications
          await fetchNotifications();
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();

    // Set up real-time subscription for new notifications
    const setupSubscription = async () => {
      const subscription = await notificationService.subscribeToNotifications((notification) => {
        // Add new notification to state
        setNotifications(prev => [notification, ...prev]);
        // Update unread count
        setUnreadCount(prev => prev + 1);
        
        // Play notification sound if enabled
        // This could be tied to a user setting
        try {
          const notificationSound = new Audio('/notification.mp3');
          notificationSound.volume = 0.5;
          notificationSound.play().catch(e => console.error('Error playing notification sound:', e));
        } catch (error) {
          console.error('Error playing notification sound:', error);
        }
      });
      
      return subscription;
    };
    
    const subscription = setupSubscription();
    
    // Cleanup subscription on unmount
    return () => {
      subscription.then(sub => {
        if (sub) sub.unsubscribe();
      });
    };
  }, [navigate]);

  // Fetch notifications function
  const fetchNotifications = async () => {
    setNotificationsLoading(true);
    try {
      // Get all notifications
      const fetchedNotifications = await notificationService.getNotifications();
      setNotifications(fetchedNotifications);
      
      // Count unread
      const unreadNotifications = fetchedNotifications.filter(n => !n.isRead).length;
      setUnreadCount(unreadNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };
  
  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };
  
  // Mark a single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
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
  
  // Format relative time
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
  
  // Get notification icon based on type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'achievement':
        return <Award className="h-5 w-5 text-yellow-400" />;
      case 'game':
        return <Gamepad className="h-5 w-5 text-indigo-400" />;
      case 'social':
        return <MessageSquare className="h-5 w-5 text-green-400" />;
      case 'system':
      default:
        return <AlertCircle className="h-5 w-5 text-blue-400" />;
    }
  };

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
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
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
                    {notificationsLoading ? (
                      <div className="p-4 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-500 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-gray-400">Loading notifications...</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        <Bell className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                        <p>No notifications</p>
                        <p className="text-sm mt-1">Your notifications will appear here</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div 
                          key={notification.id}
                          className={`p-3 border-b border-gray-700 hover:bg-gray-750 ${!notification.isRead ? 'bg-indigo-900/20' : ''}`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex">
                            <div className="flex-shrink-0 mr-3">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <h4 className="font-medium text-sm">{notification.title}</h4>
                                <span className="text-xs text-gray-400">{formatTime(notification.createdAt)}</span>
                              </div>
                              <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
                              
                              {!notification.isRead && (
                                <div className="mt-2 flex justify-end">
                                  <button 
                                    className="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-1 rounded flex items-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notification.id);
                                    }}
                                  >
                                    <Check className="h-3 w-3 mr-1" /> Mark as read
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-2 border-t border-gray-700 text-center">
                      <button className="text-sm text-indigo-400 hover:text-indigo-300 p-1">
                        View all notifications
                      </button>
                    </div>
                  )}
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