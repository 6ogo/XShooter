/*
  # Fix RLS Policies

  1. Changes
    - Add INSERT policies for profiles and leaderboard tables
    - Fix profiles policies to allow proper user creation
    - Update leaderboard policies for proper stat tracking

  2. Security
    - Maintain secure access control
    - Allow proper user registration flow
*/

-- Add INSERT policy for profiles
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Add INSERT policy for leaderboard
CREATE POLICY "System can create leaderboard entries"
  ON leaderboard FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- Update leaderboard policies to allow proper stat tracking
CREATE POLICY "Players can update their own stats"
  ON leaderboard FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);