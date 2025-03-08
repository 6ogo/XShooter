import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface LeaderboardEntry {
  username: string;
  wins: number;
  total_kills: number;
  accuracy: number;
}

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data: topPlayers } = await supabase
        .from('leaderboard')
        .select('player_id, wins, total_kills, total_shots, shots_hit')
        .order('wins', { ascending: false })
        .limit(20);

      if (topPlayers) {
        const playerIds = topPlayers.map((p) => p.player_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', playerIds);

        const leaderboardData = topPlayers.map((player) => {
          const profile = profiles?.find((p) => p.id === player.player_id);
          return {
            username: profile?.username || 'Unknown',
            wins: player.wins,
            total_kills: player.total_kills,
            accuracy: player.total_shots > 0
              ? (player.shots_hit / player.total_shots) * 100
              : 0,
          };
        });

        setLeaderboard(leaderboardData);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Leaderboard</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">Player</th>
              <th className="px-4 py-2 text-right">Wins</th>
              <th className="px-4 py-2 text-right">Kills</th>
              <th className="px-4 py-2 text-right">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr
                key={entry.username}
                className={`border-t ${
                  index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2">{entry.username}</td>
                <td className="px-4 py-2 text-right">{entry.wins}</td>
                <td className="px-4 py-2 text-right">{entry.total_kills}</td>
                <td className="px-4 py-2 text-right">
                  {entry.accuracy.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {userRank && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Your Stats</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Wins</p>
              <p className="text-lg font-medium">{userRank.wins}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Kills</p>
              <p className="text-lg font-medium">{userRank.total_kills}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Accuracy</p>
              <p className="text-lg font-medium">
                {userRank.accuracy.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}