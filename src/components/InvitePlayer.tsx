import React, { useState } from 'react';
import { Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CopyToClipboard } from '../utils/Clipboard';

interface InvitePlayerProps {
  roomCode: string;
  gameId: string;
  onClose: () => void;
}

export function InvitePlayer({ roomCode, gameId, onClose }: InvitePlayerProps) {
  const [twitterHandle, setTwitterHandle] = useState('');
  const [inviteMessage, setInviteMessage] = useState(`Join my XShooter game! Use room code: ${roomCode}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const gameLink = `${window.location.origin}/game/${gameId}`;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!twitterHandle) {
      setError('Please enter a Twitter handle');
      return;
    }
    
    setSending(true);
    setError(null);
    
    try {
      // In a real app, this would integrate with Twitter API
      // For this implementation, we'll simulate the invitation process
      
      // Validate the Twitter handle format
      const handle = twitterHandle.startsWith('@') ? twitterHandle.substring(1) : twitterHandle;
      
      if (!handle.match(/^[A-Za-z0-9_]{1,15}$/)) {
        throw new Error('Invalid Twitter handle format');
      }
      
      // Check if user exists in our system (optional)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', handle);
        
      if (profileError) throw profileError;
      
      // Log the invitation attempt - in real app, this would send to Twitter API
      console.log(`Sending invite to @${handle}:`, inviteMessage);
      console.log(`Game link: ${gameLink}`);
      
      // Simulate delay for sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Success!
      setSuccess(`Invitation sent to @${handle}`);
      setTwitterHandle('');
      
      // You could store the invitation in database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('invitations')
          .insert({
            game_id: gameId,
            sender_id: user.id,
            recipient_handle: handle,
            message: inviteMessage,
            status: 'sent'
          });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Invite Player</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>
      
      <div className="mb-6">
        <h3 className="font-medium mb-2">Game Info</h3>
        <div className="bg-gray-100 p-3 rounded-lg mb-2">
          <p className="text-sm font-medium">Room Code:</p>
          <div className="flex items-center mt-1">
            <span className="text-lg font-mono font-bold">{roomCode}</span>
            <CopyToClipboard text={roomCode} className="ml-2 text-indigo-600 hover:text-indigo-800" />
          </div>
        </div>
        
        <div className="bg-gray-100 p-3 rounded-lg">
          <p className="text-sm font-medium">Game Link:</p>
          <div className="flex items-center mt-1">
            <input
              type="text"
              value={gameLink}
              readOnly
              className="text-sm font-medium text-gray-700 bg-transparent border-none p-0 w-full focus:outline-none focus:ring-0"
            />
            <CopyToClipboard text={gameLink} className="text-indigo-600 hover:text-indigo-800" />
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSendInvite} className="space-y-4">
        <div>
          <label htmlFor="twitterHandle" className="block text-sm font-medium text-gray-700 mb-1">
            Twitter Handle
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
              @
            </span>
            <input
              id="twitterHandle"
              type="text"
              value={twitterHandle.startsWith('@') ? twitterHandle.substring(1) : twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value)}
              placeholder="username"
              className="focus:ring-indigo-500 focus:border-indigo-500 flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-gray-300"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="message"
            rows={3}
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
          />
        </div>
        
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md">
            {success}
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {sending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <Send size={16} className="mr-2" />
                Send Invite
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}