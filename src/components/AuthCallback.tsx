import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log("Auth callback started");
        
        // Handle the hash fragment coming from OAuth redirect
        if (window.location.hash) {
          console.log("Hash fragment detected");
        }
        
        // Get session to verify authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }
        
        if (!session) {
          console.error("No session found");
          throw new Error('No session found');
        }
        
        // Get user data
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("User error:", userError);
          throw userError;
        }
        
        if (!user) {
          console.error("No user found");
          throw new Error('No user found');
        }
        
        console.log("User authenticated:", user.id);
        
        // Check if profile exists
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
          
        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Profile error:", profileError);
          throw profileError;
        }
        
        if (!existingProfile) {
          console.log("Creating new profile");
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
          
          // Update user metadata to include display_name
          await supabase.auth.updateUser({
            data: { display_name: username }
          });
          
          // Create profile
          const { error: createProfileError } = await supabase
            .from('profiles')
            .insert([{ 
              id: user.id, 
              username 
            }]);
            
          if (createProfileError) {
            console.error("Create profile error:", createProfileError);
            throw createProfileError;
          }
          
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
            
          if (leaderboardError) {
            console.error("Leaderboard error:", leaderboardError);
            throw leaderboardError;
          }
        }
        
        // Set success state
        setSuccess(true);
        setLoading(false);
        
        // Redirect to game lobby after a short delay
        setTimeout(() => navigate('/game/lobby'), 1000);
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
    <div className="min-h-screen bg-gray-900 bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center">
        {error ? (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Failed</h2>
            <p className="text-gray-700 mb-4">{error}</p>
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
            {loading && <div className="loading-spinner">Loading...</div>}
              <p className="text-gray-500">Redirecting to login page...</p>
            </div>
          </>
        ) : success ? (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-green-600 mb-2">Authentication Successful!</h2>
            <p className="text-gray-700 mb-4">Welcome to XShooter!</p>
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
            {loading && <div className="loading-spinner">Loading...</div>}
              <p className="text-gray-500">Redirecting to game lobby...</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="h-16 w-16 text-indigo-500 animate-spin" />
            </div>
            {loading && <div className="loading-spinner">Loading...</div>}
            <h2 className="text-xl font-semibold text-indigo-600 mb-2">
              Signing you in...
            </h2>
            <p className="text-gray-700">
              Please wait while we complete your authentication.
            </p>
          </>
        )}
      </div>
    </div>
  );
}