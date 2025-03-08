import React, { useState } from 'react';
import { Twitter, Copy, Check, Send } from 'lucide-react';

interface ShareGameProps {
  roomCode: string;
  gameLink: string;
}

export function ShareGame({ roomCode, gameLink }: ShareGameProps) {
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Format tweet text
  const tweetText = `Join me for a game of XShooter! Use room code: ${roomCode} or click the link to join directly. #XShooter #Gaming`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(gameLink)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gameLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Send direct invite (simulated)
  const sendDirectInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    
    // Reset form
    e.currentTarget.reset();
    
    // Show success message
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    
    // In a real implementation, you would integrate with X API to send direct messages
    // For now, this is just a UI demonstration
    console.log(`Sending invite to: ${username}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Share Game</h2>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room Code</label>
          <div className="flex items-center">
            <div className="bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg font-bold tracking-wider flex-grow">
              {roomCode}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Game Link</label>
          <div className="flex rounded-md shadow-sm">
            <input
              type="text"
              readOnly
              value={gameLink}
              className="flex-grow focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
            />
            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              <span className="ml-2">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
        
        {/* Share on X */}
        <div>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-400 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
          >
            <Twitter size={16} />
            Share on X
          </a>
        </div>
        
        {/* Direct Invite */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invite by X Username
          </label>
          <form onSubmit={sendDirectInvite} className="flex mt-1">
            <div className="flex-grow flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                @
              </span>
              <input
                type="text"
                name="username"
                placeholder="username"
                required
                className="flex-grow focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-r-md sm:text-sm border-gray-300"
              />
            </div>
            <button
              type="submit"
              className="ml-2 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Send size={16} className="mr-2" />
              Send
            </button>
          </form>
          
          {/* Success message */}
          {showSuccess && (
            <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
              <Check size={14} />
              Invite sent successfully!
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            This will send a notification to the user on X with your game invite
          </p>
        </div>
      </div>
    </div>
  );
}

export default ShareGame;