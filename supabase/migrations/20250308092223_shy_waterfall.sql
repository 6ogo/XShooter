/*
  # XShooter Game Schema

  1. New Tables
    - `profiles`
      - Stores user profile information
      - Links to Supabase auth.users
    - `games`
      - Stores game session information
    - `game_players`
      - Tracks players in each game
    - `leaderboard`
      - Stores player statistics

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT now(),
  room_code TEXT UNIQUE NOT NULL,
  max_players INT DEFAULT 4,
  current_players INT DEFAULT 0
);

-- Create game_players table
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  player_id UUID REFERENCES profiles(id),
  health INT DEFAULT 100,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  kills INT DEFAULT 0,
  shots_fired INT DEFAULT 0,
  shots_hit INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id),
  wins INT DEFAULT 0,
  total_kills INT DEFAULT 0,
  total_shots INT DEFAULT 0,
  shots_hit INT DEFAULT 0,
  games_played INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Games policies
CREATE POLICY "Anyone can read games"
  ON games FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Host can update own games"
  ON games FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Users can create games"
  ON games FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

-- Game players policies
CREATE POLICY "Players can read game data"
  ON game_players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Players can update own data"
  ON game_players FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Players can join games"
  ON game_players FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Leaderboard policies
CREATE POLICY "Anyone can read leaderboard"
  ON leaderboard FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can update leaderboard"
  ON leaderboard FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id);