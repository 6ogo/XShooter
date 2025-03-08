import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get session from URL
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error('No session found');
        }
        
        // Get user data
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('No user found');
        }
        
        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
          
        if (!existingProfile) {
          // Create a profile for the X user
          // Generate a username based on X info or email
          let username = user.user_metadata?.preferred_username || 
                          user.user_metadata?.full_name?.replace(/\s+/g, '_').toLowerCase() || 
                          user.email?.split('@')[0] || 
                          `player_${Math.random().toString(36).substring(2, 10)}`;
          
          // Make sure username is unique
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single();
            
          if (existingUser) {
            // Add random suffix if username exists
            username = `${username}_${Math.random().toString(36).substring(2, 6)}`;
          }
          
          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ 
              id: user.id, 
              username 
            }]);
            
          if (profileError) throw profileError;
          
          // Create leaderboard entry
          const { error: leaderboardError } = await supabase
            .from('leaderboard')
            .insert([{ 
              player_id: user.id,
              wins: 0,
              total_kills: 0,
              total_shots: 0,
              shots_hit: 0,
              games_played: 0
            }]);
            
          if (leaderboardError) throw leaderboardError;
        }
        
        // Redirect to game lobby
        setLoading(false);
        navigate('/game/lobby');
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setLoading(false);
        // Redirect to login after a short delay
        setTimeout(() => navigate('/'), 3000);
      }
    };
    
    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        {error ? (
          <>
            <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Failed</h2>
            <p className="text-gray-700 mb-4">{error}</p>
            <p className="text-gray-500">Redirecting to login page...</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-indigo-600 mb-2">
              {loading ? "Logging you in..." : "Authentication successful!"}
            </h2>
            <p className="text-gray-700">
              {loading 
                ? "Please wait while we complete your authentication." 
                : "You'll be redirected to the game lobby."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}