import { useState } from 'react';
import { Twitter, Copy, Check, Send, Share2, ExternalLink } from 'lucide-react';
import { CopyToClipboard } from '../utils/Clipboard';

interface ShareGameProps {
  roomCode: string;
  gameLink: string;
  onInvitePlayer?: () => void;
}

export function ShareGame({ roomCode, gameLink, onInvitePlayer }: ShareGameProps) {
  const [copied, setCopied] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const tweetText = `Join me for a game of XShooter! Use room code: ${roomCode} or click the link to join directly: ${gameLink} #XShooter #Gaming`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gameLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(gameLink)}`;

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
            <CopyToClipboard text={roomCode} className="ml-2" />
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
        <div className="grid grid-cols-2 gap-4">
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center gap-2 px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-400 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
          >
            <Twitter size={16} />
            Share on X
          </a>
          <button
            onClick={onInvitePlayer}
            className="inline-flex justify-center items-center gap-2 px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Send size={16} />
            Invite Player
          </button>
          <button
            onClick={() => setShowQRCode(!showQRCode)}
            className="inline-flex justify-center items-center gap-2 px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Share2 size={16} />
            {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`/join ${roomCode}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex justify-center items-center gap-2 px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ExternalLink size={16} />
            Copy Join Command
          </button>
        </div>
        {showQRCode && (
          <div className="mt-4 flex justify-center">
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <img
                src={qrCodeUrl}
                alt="QR Code for Game Link"
                className="w-48 h-48"
              />
              <p className="text-center text-sm text-gray-500 mt-2">Scan to join game</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareGame;