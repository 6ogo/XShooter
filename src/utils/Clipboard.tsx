import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyToClipboardProps {
  text: string;
  className?: string;
}

export function CopyToClipboard({ text, className = '' }: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    
    // Reset after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check size={16} className="text-green-600" />
      ) : (
        <Copy size={16} />
      )}
    </button>
  );
}