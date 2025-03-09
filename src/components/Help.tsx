import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gamepad, Target, Shield, Clock, Zap, Users, Award } from 'lucide-react';
import { Layout } from './Layout';

export function Help() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <button 
              onClick={() => navigate(-1)}
              className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-3xl font-bold text-white">How To Play XShooter</h1>
          </div>
          
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700 mb-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Gamepad className="mr-3" size={24} />
              Game Overview
            </h2>
            
            <p className="text-gray-300 mb-6">
              XShooter is a fast-paced 2D multiplayer shooter game where players compete to be the last one standing. 
              Players are represented by their profile pictures and shoot small balls at each other to reduce opponents' health.
            </p>
            
            <h3 className="text-xl font-semibold text-white mb-4">Game Basics</h3>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <div className="flex items-center mb-3">
                  <Shield className="text-blue-400 mr-2" size={20} />
                  <h4 className="font-medium text-white">Health System</h4>
                </div>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Every player starts with 100 HP</li>
                  <li>• Health is displayed above your avatar</li>
                  <li>• When your HP reaches 0, you're eliminated</li>
                  <li>• The last player standing wins the game</li>
                </ul>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <div className="flex items-center mb-3">
                  <Target className="text-red-400 mr-2" size={20} />
                  <h4 className="font-medium text-white">Combat System</h4>
                </div>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Fire up to 5 shots in a burst</li>
                  <li>• Each shot deals 20 damage</li>
                  <li>• After 5 shots, there's a 3-second cooldown</li>
                  <li>• Aim carefully to maximize your hit rate</li>
                </ul>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-4">Controls</h3>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <h4 className="font-medium text-white mb-3">Desktop Controls</h4>
                <ul className="space-y-3 text-gray-300 text-sm">
                  <li className="flex items-start">
                    <span className="font-bold text-indigo-400 mr-2">Movement:</span>
                    <span>WASD or Arrow Keys</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold text-indigo-400 mr-2">Shooting:</span>
                    <span>Click anywhere on screen to fire in that direction</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold text-indigo-400 mr-2">Settings:</span>
                    <span>Access via the settings icon in the top bar</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <h4 className="font-medium text-white mb-3">Mobile Controls</h4>
                <ul className="space-y-3 text-gray-300 text-sm">
                  <li className="flex items-start">
                    <span className="font-bold text-indigo-400 mr-2">Movement:</span>
                    <span>Virtual joystick on the left side</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold text-indigo-400 mr-2">Shooting:</span>
                    <span>Tap on the right side to fire in that direction</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold text-indigo-400 mr-2">D-Pad Option:</span>
                    <span>Toggle between joystick and D-pad controls</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-4">Game Modes</h3>
            
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <div className="flex items-center mb-3">
                  <Users className="text-green-400 mr-2" size={20} />
                  <h4 className="font-medium text-white">Create Game</h4>
                </div>
                <p className="text-gray-300 text-sm">
                  Host a private game and invite friends using a room code. You control when the game starts.
                </p>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <div className="flex items-center mb-3">
                  <Zap className="text-yellow-400 mr-2" size={20} />
                  <h4 className="font-medium text-white">Quickplay</h4>
                </div>
                <p className="text-gray-300 text-sm">
                  Join an active game or get matched with other players looking for a game.
                </p>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <div className="flex items-center mb-3">
                  <Gamepad className="text-purple-400 mr-2" size={20} />
                  <h4 className="font-medium text-white">Singleplayer</h4>
                </div>
                <p className="text-gray-300 text-sm">
                  Practice against AI opponents with different difficulty levels and personalities.
                </p>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-4">Tips & Strategies</h3>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <div className="flex items-center mb-3">
                  <Clock className="text-indigo-400 mr-2" size={20} />
                  <h4 className="font-medium text-white">Timing is Everything</h4>
                </div>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Plan your shots to avoid being caught in cooldown</li>
                  <li>• Move strategically during opponent cooldowns</li>
                  <li>• Use terrain and obstacles to your advantage</li>
                </ul>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <div className="flex items-center mb-3">
                  <Award className="text-yellow-400 mr-2" size={20} />
                  <h4 className="font-medium text-white">Achievement Hunting</h4>
                </div>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Try for high accuracy to unlock the Sharpshooter award</li>
                  <li>• Win multiple games in a row for streak achievements</li>
                  <li>• Check the Achievements page for specific challenges</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">How do I invite friends to play?</h3>
                <p className="text-gray-300">
                  Create a private game and share the room code or game link with your friends. They can enter the code in the "Join Game" field or click your shared link.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">How does the leaderboard work?</h3>
                <p className="text-gray-300">
                  The leaderboard tracks wins, kills, accuracy, and other stats across all your games. You can filter the leaderboard by different metrics to see where you rank.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">What are the different AI personalities?</h3>
                <p className="text-gray-300">
                  In singleplayer mode, AI opponents have different personalities that affect their behavior:
                </p>
                <ul className="space-y-1 text-gray-300 mt-2">
                  <li>• <span className="text-red-400 font-medium">Aggressive:</span> Rushes toward players and shoots frequently</li>
                  <li>• <span className="text-blue-400 font-medium">Defensive:</span> Maintains distance and shoots more selectively</li>
                  <li>• <span className="text-yellow-400 font-medium">Sniper:</span> Very accurate but slower movement</li>
                  <li>• <span className="text-purple-400 font-medium">Erratic:</span> Unpredictable movement and shooting patterns</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Can I change my controls?</h3>
                <p className="text-gray-300">
                  Yes, you can customize your controls in the Settings menu. You can switch between WASD and arrow keys on desktop, and between joystick and D-pad on mobile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Help;