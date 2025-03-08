import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save } from 'lucide-react';
import { Avatar } from './Avatar';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  provider: string;
  avatar_url?: string;
}

export function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/');
          return;
        }
        
        // Get profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (profileError) throw profileError;
        
        // Determine auth provider
        const provider = user.app_metadata?.provider || 'email';
        
        setProfile({
          id: user.id,
          username: profileData.username,
          email: user.email || '',
          provider,
          avatar_url: user.user_metadata?.avatar_url
        });
        
        setUsername(profileData.username);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!profile) return;
      
      // Check if username changed
      if (username !== profile.username) {
        // Check if username is taken
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .neq('id', profile.id);
          
        if (checkError) throw checkError;
        if (existingUser && existingUser.length > 0) {
          throw new Error('Username already taken');
        }
        
        // Update username
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ username })
          .eq('id', profile.id);
          
        if (updateError) throw updateError;
        
        setProfile(prev => prev ? { ...prev, username } : null);
        setSuccess('Profile updated successfully');
      }
      
      // Update password if provided
      if (newPassword && profile.provider === 'email') {
        if (newPassword !== confirmPassword) {
          throw new Error('New passwords do not match');
        }
        
        if (!currentPassword) {
          throw new Error('Current password is required');
        }
        
        // Verify current password
        const { error: pwError } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: currentPassword
        });
        
        if (pwError) {
          throw new Error('Current password is incorrect');
        }
        
        // Update password
        const { error: updatePwError } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (updatePwError) throw updatePwError;
        
        // Clear password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        
        setSuccess('Password updated successfully');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => navigate('/game/lobby')}
            className="text-white hover:text-gray-300"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-white">Account Settings</h1>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar 
              username={profile?.username || 'User'} 
              imageUrl={profile?.avatar_url} 
              size="lg" 
            />
            <div>
              <h2 className="text-xl font-semibold">{profile?.username}</h2>
              <p className="text-gray-600">{profile?.email}</p>
              <p className="text-sm text-gray-500 mt-1">
                Sign-in method: {profile?.provider === 'twitter' ? 'X (Twitter)' : 'Email/Password'}
              </p>
            </div>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-gray-700"
              >
                Username
              </label>
              <input 
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            
            {profile?.provider === 'email' && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Change Password</h3>
                
                <div className="space-y-4">
                  <div>
                    <label 
                      htmlFor="currentPassword" 
                      className="block text-sm font-medium text-gray-700"
                    >
                      Current Password
                    </label>
                    <input 
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="newPassword" 
                      className="block text-sm font-medium text-gray-700"
                    >
                      New Password
                    </label>
                    <input 
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="confirmPassword" 
                      className="block text-sm font-medium text-gray-700"
                    >
                      Confirm New Password
                    </label>
                    <input 
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between">
              <button
                type="submit"
                disabled={updating}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <Save className="h-5 w-5 mr-2" />
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
              
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h3 className="text-lg font-medium mb-4">Game Statistics</h3>
          
          <p className="text-sm text-gray-600 mb-2">
            View your detailed game statistics on the leaderboard page.
          </p>
          
          <button
            onClick={() => navigate('/leaderboard')}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}