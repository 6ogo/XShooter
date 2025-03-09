import React, { useState } from 'react';
import { Twitter, Copy, Check, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ShareGameProps {
  roomCode: string;
  gameLink: string;
  onClose?: () => void;
}

export function ShareGame({ roomCode, gameLink, onClose }: ShareGameProps) {
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'link' | 'twitter'>('link');

  const tweetText = `Join me for a game of XShooter! Use room code: ${roomCode} or click the link to join directly. #XShooter #Gaming`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(gameLink)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gameLink).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
        setError('Failed to copy to clipboard');
      }
    );
  };

  const sendDirectInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;

    if (!username || username.trim() === '') {
      setError('Please enter a valid username');
      return;
    }

    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session || !session.provider_token || !session.provider_refresh_token) {
        setError('X/Twitter authentication required. Please sign in with X to use this feature.');
        return;
      }

      // Call the supabase function to send the invite
      const { error: invokeError } = await supabase.functions.invoke('send-invite', {
        body: {
          handle: username.replace('@', ''), // Remove @ if present
          gameLink,
          accessToken: session.provider_token,
          accessTokenSecret: session.provider_refresh_token,
        },
      });

      if (invokeError) throw invokeError;

      e.currentTarget.reset();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to send invite:', err);
      setError('Failed to send invite. Please try again later.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 relative max-w-md w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Share Game</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'link'
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('link')}
        >
          Share Link
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'twitter'
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('twitter')}
        >
          Invite via X
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room Code</label>
          <div className="bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg font-bold tracking-wider text-center">
            {roomCode}
          </div>
        </div>

        {activeTab === 'link' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Game Link</label>
              <div className="flex rounded-md shadow-sm">
                <input
                  type="text"
                  readOnly
                  value={gameLink}
                  className="flex-grow focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  <span className="ml-2">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
            
            <div>
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-400 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors"
              >
                <Twitter size={18} />
                Share on X (Twitter)
              </a>
            </div>
          </>
        )}

        {activeTab === 'twitter' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invite X User to Game</label>
            <form onSubmit={sendDirectInvite} className="space-y-4">
              <div className="flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                  @
                </span>
                <input
                  type="text"
                  name="username"
                  placeholder="username"
                  required
                  className="flex-grow focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-r-md sm:text-sm border-gray-300"
                />
              </div>
              
              <button
                type="submit"
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <Send size={18} />
                Send Invite
              </button>
            </form>
            
            {showSuccess && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2">
                <Check size={18} className="text-green-500" />
                Invite sent successfully!
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
            )}
            
            <p className="mt-4 text-sm text-gray-500">
              This will send a notification to the user on X with your game invite. The user must be following you on X to receive direct messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}