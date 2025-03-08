import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Gamepad2, Trophy, Users } from 'lucide-react';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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

        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
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

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
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
      </div>
    </div>
  );
}