import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ShareGame } from './ShareGame';
import { Layout } from './Layout';

// This is a partial implementation showing just the sharing UI integration
// The full Game component would include all the game mechanics from your original code

export function Game() {
  const { id } = useParams<{ id: string }>();
  const { players, roomCode, isHost } = useGameStore();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [gameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [] = useState<string | null>(null);
  const [isSingleplayer, setIsSingleplayer] = useState(false);

  // Generate the full game link for sharing
  const gameLink = `${window.location.origin}/game/${id}`;

  useEffect(() => {
    // Check if this is a singleplayer game
    if (id === 'singleplayer') {
      setIsSingleplayer(true);
    } else {
      // For multiplayer, show share dialog when hosting a new game
      // and waiting for players
      if (isHost && gameState === 'waiting' && players.size <= 1) {
        setShowShareDialog(true);
      }
    }
  }, [id, isHost, gameState, players.size]);

  // The rest of your Game component implementation would go here

  return (
    <Layout hideFooter={true}>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        {/* Game canvas and UI would go here */}

        {/* Share Dialog */}
        {showShareDialog && !isSingleplayer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="max-w-md w-full">
              <ShareGame 
                roomCode={roomCode || 'ERROR'} 
                gameLink={gameLink} 
              />
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowShareDialog(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Game;