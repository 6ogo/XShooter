// src/lib/achievementService.ts
import { supabase } from './supabase';

// Types of achievement checks
export enum AchievementCheckType {
  SINGLE_GAME = 'single_game',
  CUMULATIVE = 'cumulative',
  STREAK = 'streak',
  SINGLE_ACTION = 'single_action',
  RANK = 'rank'
}

// Interface for game completion data
export interface GameCompletionData {
  gameId: string;
  playerId: string;
  winner: boolean;
  killCount: number;
  finalHealth: number;
  damageReceived: number;
  shotsFired: number;
  shotsHit: number;
  accuracy: number;
  eliminations: string[]; // Array of player IDs eliminated
  eliminatedAllPlayers: boolean;
  firstKill: boolean;
  lastKill: boolean;
  killedInRow: number;
  multiKills: { count: number, timespan: number }[];
  lowestHealth: number;
  timeWithLowHealth: number;
}

// Achievement interface
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement_type: AchievementCheckType;
  requirement_value: number;
}

class AchievementService {
  /**
   * Checks and unlocks achievements based on game completion data
   */
  async checkGameAchievements(data: GameCompletionData): Promise<string[]> {
    try {
      // Get all possible achievements
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('*');
      
      if (error) throw error;
      if (!achievements) return [];
      
      // Get already unlocked achievements for this player
      const { data: unlockedAchievements, error: unlockedError } = await supabase
        .from('player_achievements')
        .select('achievement_id')
        .eq('player_id', data.playerId);
      
      if (unlockedError) throw unlockedError;
      
      // Create a set of already unlocked achievement IDs
      const unlockedSet = new Set((unlockedAchievements || []).map(ua => ua.achievement_id));
      
      // Filter achievements that need to be evaluated (not already unlocked)
      const achievementsToCheck = achievements.filter(a => !unlockedSet.has(a.id));
      
      // Check each achievement
      const newlyUnlocked: string[] = [];
      
      for (const achievement of achievementsToCheck) {
        const unlocked = await this.evaluateAchievement(achievement, data);
        
        if (unlocked) {
          // Record the unlocked achievement
          const { error: insertError } = await supabase
            .from('player_achievements')
            .insert({
              player_id: data.playerId,
              achievement_id: achievement.id,
              game_id: data.gameId
            });
          
          if (!insertError) {
            newlyUnlocked.push(achievement.id);
            
            // Notifications will be created automatically by database trigger
            // But we can also create them here in case the trigger fails
            try {
              // Check if notification was created (wait a moment)
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const { count } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', data.playerId)
                .eq('type', 'achievement')
                .eq('related_id', achievement.id)
                .gt('created_at', new Date(Date.now() - 10000).toISOString());
              
              // If notification wasn't created, create it manually
              if (!count) {
                // Create notification manually
                await supabase
                  .from('notifications')
                  .insert({
                    user_id: data.playerId,
                    type: 'achievement',
                    title: 'Achievement Unlocked',
                    message: `You unlocked the "${achievement.name}" achievement!`,
                    related_id: achievement.id
                  });
              }
            } catch (e) {
              console.error('Error handling achievement notification:', e);
            }
          }
        }
      }
      
      return newlyUnlocked;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }
  
  // Get all achievements for a player with unlock status
  async getPlayerAchievements(playerId: string) {
    try {
      // Get all achievements
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('*')
        .order('category');
        
      if (error) throw error;
      if (!achievements) return [];
      
      // Get unlocked achievements for the player
      const { data: playerAchievements, error: playerError } = await supabase
        .from('player_achievements')
        .select('achievement_id, unlocked_at')
        .eq('player_id', playerId);
        
      if (playerError) throw playerError;
      
      // Create a map of unlocked achievements
      const unlockedMap = new Map();
      (playerAchievements || []).forEach(pa => {
        unlockedMap.set(pa.achievement_id, pa.unlocked_at);
      });
      
      // Map achievements with unlock status
      return achievements.map(achievement => ({
        ...achievement,
        unlocked: unlockedMap.has(achievement.id),
        unlocked_at: unlockedMap.get(achievement.id) || null
      }));
    } catch (error) {
      console.error('Error getting player achievements:', error);
      return [];
    }
  }
  
  /**
   * Evaluate if a specific achievement is unlocked based on game data
   */
  private async evaluateAchievement(
    achievement: any, 
    data: GameCompletionData
  ): Promise<boolean> {
    const { requirement_type, requirement_value, name } = achievement;
    
    switch (requirement_type) {
      case AchievementCheckType.SINGLE_GAME:
        return this.checkSingleGameAchievement(name, requirement_value, data);
        
      case AchievementCheckType.CUMULATIVE:
        return this.checkCumulativeAchievement(name, requirement_value, data.playerId);
        
      case AchievementCheckType.STREAK:
        return this.checkStreakAchievement(name, requirement_value, data);
        
      case AchievementCheckType.RANK:
        return this.checkRankAchievement(name, requirement_value, data.playerId);
        
      default:
        return false;
    }
  }
  
  /**
   * Check achievements based on single game performance
   */
  private async checkSingleGameAchievement(
    name: string, 
    value: number, 
    data: GameCompletionData
  ): Promise<boolean> {
    switch (name) {
      case 'Sharpshooter':
        return data.accuracy >= 50;
        
      case 'Quick Draw':
        return data.shotsFired >= 5 && data.accuracy === 100;
        
      case 'Triple Threat':
        return data.eliminations.length >= 3;
        
      case 'Survivor':
        return data.winner && data.damageReceived === 0;
        
      case 'Last Stand':
        return data.winner && data.finalHealth === 1;
        
      case 'Rampage':
        return data.killCount >= 5;
        
      case 'First Blood':
        return data.firstKill;
        
      case 'Last Shot':
        return data.winner && data.lastKill;
        
      case 'Dominator':
        return data.winner && data.eliminatedAllPlayers;
        
      case 'Perfect Game':
        return data.winner && data.accuracy === 100;
        
      case 'Untouchable':
        return data.damageReceived === 0;
        
      case 'Close Call':
        return data.timeWithLowHealth >= 60; // 60 seconds with low health
        
      case 'Double Kill':
        return data.multiKills.some(mk => mk.count >= 2 && mk.timespan <= 3); // 2 kills within 3 seconds
        
      case 'Popular Player':
        return await this.checkGameParticipants(data.gameId) >= 5;
        
      case 'Comeback Kid':
        return data.winner && data.lowestHealth <= 20;
        
      default:
        return false;
    }
  }
  
  /**
   * Check achievements based on cumulative stats
   */
  private async checkCumulativeAchievement(
    name: string, 
    value: number, 
    playerId: string
  ): Promise<boolean> {
    switch (name) {
      case 'Deadeye':
        return await this.checkTotalShotsHit(playerId, value);
        
      case 'Assassin':
        return await this.checkTotalKills(playerId, value);
        
      case 'Social Butterfly':
        return await this.checkGamesWithFriends(playerId, value);
        
      case 'Host Master':
        return await this.checkGamesHosted(playerId, value);
        
      case 'Veteran':
        return await this.checkTotalGamesPlayed(playerId, value);
        
      default:
        return false;
    }
  }
  
  /**
   * Check achievements based on streaks
   */
  private async checkStreakAchievement(
    name: string, 
    value: number, 
    data: GameCompletionData
  ): Promise<boolean> {
    switch (name) {
      case 'Kill Streak':
        return data.killedInRow >= value;
        
      case 'Winning Streak':
        return await this.checkConsecutiveWins(data.playerId, value);
        
      default:
        return false;
    }
  }
  
  /**
   * Check achievements based on leaderboard rank
   */
  private async checkRankAchievement(
    name: string, 
    value: number, 
    playerId: string
  ): Promise<boolean> {
    switch (name) {
      case 'Top of the Board':
        return await this.checkLeaderboardRank(playerId, value);
        
      default:
        return false;
    }
  }
  
  /**
   * Utility methods for checking specific stats
   */
  
  private async checkTotalShotsHit(playerId: string, threshold: number): Promise<boolean> {
    const { data } = await supabase
      .from('leaderboard')
      .select('shots_hit')
      .eq('player_id', playerId)
      .single();
      
    return data?.shots_hit >= threshold;
  }
  
  private async checkTotalKills(playerId: string, threshold: number): Promise<boolean> {
    const { data } = await supabase
      .from('leaderboard')
      .select('total_kills')
      .eq('player_id', playerId)
      .single();
      
    return data?.total_kills >= threshold;
  }
  
  private async checkGamesWithFriends(playerId: string, threshold: number): Promise<boolean> {
    // This would require a more complex query or additional tracking
    // For now, just assuming it's based on total games played
    return await this.checkTotalGamesPlayed(playerId, threshold);
  }
  
  private async checkGamesHosted(playerId: string, threshold: number): Promise<boolean> {
    const { count } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', playerId);
      
    return (count || 0) >= threshold;
  }
  
  private async checkTotalGamesPlayed(playerId: string, threshold: number): Promise<boolean> {
    const { data } = await supabase
      .from('leaderboard')
      .select('games_played')
      .eq('player_id', playerId)
      .single();
      
    return data?.games_played >= threshold;
  }
  
  private async checkConsecutiveWins(playerId: string, threshold: number): Promise<boolean> {
    try {
      // Method 1: Check the player_stats table first (most efficient)
      const { data: playerStats, error: statsError } = await supabase
        .from('player_stats')
        .select('current_win_streak, max_win_streak')
        .eq('player_id', playerId)
        .single();
  
      // If we have stats and either current or max streak meets threshold
      if (!statsError && playerStats) {
        if (playerStats.current_win_streak >= threshold || playerStats.max_win_streak >= threshold) {
          return true;
        }
        
        // If max streak is less than threshold, no need to check game history
        if (playerStats.max_win_streak < threshold) {
          return false;
        }
      }
  
      // Method 2: Fallback to checking game history if needed
      const { data: recentGames, error: gamesError } = await supabase
        .from('games')
        .select('id, status, winner_id, created_at')
        .or(`winner_id.eq.${playerId},game_players.player_id.eq.${playerId}`)
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(threshold * 2); // Get enough games to potentially find a streak
  
      if (gamesError || !recentGames || recentGames.length === 0) {
        // Return false if we can't get game history
        return false;
      }
  
      // Count consecutive wins
      let winStreak = 0;
      
      // For each finished game the player participated in
      for (const game of recentGames) {
        // If player won this game
        if (game.winner_id === playerId) {
          winStreak++;
          if (winStreak >= threshold) {
            return true;
          }
        } else {
          // Streak broken - player participated but didn't win
          break;
        }
      }
  
      return false;
  
    } catch (error) {
      console.error('Error checking consecutive wins:', error);
      return false;
    }
  }
  
  
  private async checkLeaderboardRank(playerId: string, threshold: number): Promise<boolean> {
    const { data: topPlayers } = await supabase
      .from('leaderboard')
      .select('player_id')
      .order('wins', { ascending: false })
      .limit(threshold);
      
    return topPlayers?.some(p => p.player_id === playerId) || false;
  }
  
  private async checkGameParticipants(gameId: string): Promise<number> {
    const { count } = await supabase
      .from('game_players')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);
      
    return count || 0;
  }
}

export const achievementService = new AchievementService();