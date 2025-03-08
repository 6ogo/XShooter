import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Gamepad2, Trophy, Users, Twitter } from 'lucide-react';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/game/lobby');
      }
    };

    checkUser();
  }, [navigate]);

  const handleXAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`  // Explicit callback URL
        }
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate with X');
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // For sign up, require terms agreement
    if (isSignUp && !agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Check for existing username using proper query
        const { data: existingUsers, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username);

        if (checkError) throw checkError;
        if (existingUsers && existingUsers.length > 0) {
          throw new Error('Username already taken');
        }

        // Sign up with email and password, and set the username as the display name
        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: username // Set the display_name metadata
            }
          }
        });

        if (signUpError) throw signUpError;
        if (!user) throw new Error('Signup failed');

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            username
          }])
          .select()
          .single();

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
          }])
          .select()
          .single();

        if (leaderboardError) throw leaderboardError;

        // Redirect to game lobby after successful signup
        navigate('/game/lobby');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Redirect to game lobby after successful login
        navigate('/game/lobby');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">XShooter</h1>
          <p className="text-gray-400">The ultimate multiplayer shooting game</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center">
              <Gamepad2 className="mx-auto h-8 w-8 text-indigo-600" />
              <p className="mt-2 text-sm text-gray-600">Real-time Combat</p>
            </div>
            <div className="text-center">
              <Users className="mx-auto h-8 w-8 text-indigo-600" />
              <p className="mt-2 text-sm text-gray-600">Multiplayer</p>
            </div>
            <div className="text-center">
              <Trophy className="mx-auto h-8 w-8 text-indigo-600" />
              <p className="mt-2 text-sm text-gray-600">Leaderboards</p>
            </div>
          </div>

          {/* X Authentication Button */}
          <div className="mb-6">
            <button
              onClick={handleXAuth}
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <Twitter className="h-5 w-5 text-blue-400" />
              {loading ? 'Loading...' : 'Sign in with X'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            {isSignUp && (
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
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            )}

            {isSignUp && (
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="text-gray-600">
                    I agree to the{' '}
                    <Link to="/terms" className="text-indigo-600 hover:text-indigo-500" target="_blank">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-indigo-600 hover:text-indigo-500" target="_blank">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (isSignUp && !agreedToTerms)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Footer with policy links */}
        <div className="text-center mt-4">
          <nav className="flex justify-center space-x-4 text-xs text-gray-400">
            <Link to="/terms" className="hover:text-white">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          </nav>
        </div>
      </div>
    </div>
  );
}