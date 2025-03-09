import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Gamepad2, Trophy, Users, Twitter, Loader2, AlertCircle } from 'lucide-react';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          navigate('/game/lobby');
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkUser();
  }, [navigate]);

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const validateUsername = (username: string) => {
    return username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
  };

  const handleXAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
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

    try {
      // Form validation
      if (isSignUp) {
        if (!validateUsername(username)) {
          throw new Error('Username must be at least 3 characters and contain only letters, numbers, and underscores');
        }
        if (!agreedToTerms) {
          throw new Error('You must agree to the Terms of Service and Privacy Policy');
        }
      }

      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      if (!validatePassword(password)) {
        throw new Error('Password must be at least 6 characters');
      }

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

        // Sign up with email and password
        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: username,
              twitter_handle: null
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

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Loading XShooter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">XShooter</h1>
          <p className="text-gray-300">The ultimate multiplayer shooting game</p>
        </div>

        <div className="bg-white rounded-lg shadow-2xl p-8 border border-indigo-100">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center">
              <div className="bg-indigo-100 p-3 rounded-lg mx-auto w-14 h-14 flex items-center justify-center">
                <Gamepad2 className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="mt-2 text-sm text-gray-600">Real-time Combat</p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-100 p-3 rounded-lg mx-auto w-14 h-14 flex items-center justify-center">
                <Users className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="mt-2 text-sm text-gray-600">Multiplayer</p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-100 p-3 rounded-lg mx-auto w-14 h-14 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="mt-2 text-sm text-gray-600">Leaderboards</p>
            </div>
          </div>

          {/* X Authentication Button */}
          <div className="mb-6">
            <button
              onClick={handleXAuth}
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors duration-200"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              ) : (
                <Twitter className="h-5 w-5 text-blue-400" />
              )}
              {loading ? 'Authenticating...' : 'Sign in with X'}
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

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

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
              {isSignUp && (
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 6 characters
                </p>
              )}
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
                <p className="text-xs text-gray-500 mt-1">
                  Only letters, numbers, and underscores
                </p>
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

            <button
              type="submit"
              disabled={loading || (isSignUp && !agreedToTerms)}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
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