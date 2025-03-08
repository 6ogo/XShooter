import React from 'react';

interface AvatarProps {
  username: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
}

export function Avatar({ username, imageUrl, size = 'md', className = '' }: AvatarProps) {
  // Get first letter of username
  const initial = username?.charAt(0)?.toUpperCase() || '?';
  
  // Determine if email (for fallback)
  const isEmail = username?.includes('@');
  const emailProvider = isEmail ? username.split('@')[1].split('.')[0] : null;
  
  // Size classes for predefined sizes
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl'
  };
  
  // Handle numeric size
  const sizeStyle = typeof size === 'number' 
    ? { width: `${size}px`, height: `${size}px`, fontSize: `${size/2.5}px` } 
    : {};
  
  // Background color based on username (for consistent colors)
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
  const colorIndex = username
    ? username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    : 0;
  const bgColor = colors[colorIndex];
  
  // Choose fallback based on whether it's an email
  const renderFallback = () => {
    if (isEmail && emailProvider) {
      // For emails, show provider logo or initial
      if (emailProvider === 'gmail') {
        return (
          <div 
            className={`flex items-center justify-center bg-red-600 rounded-full text-white ${typeof size === 'string' ? sizeClasses[size] : ''} ${className}`}
            style={sizeStyle}
          >
            <span>G</span>
          </div>
        );
      } else if (emailProvider === 'yahoo') {
        return (
          <div 
            className={`flex items-center justify-center bg-purple-600 rounded-full text-white ${typeof size === 'string' ? sizeClasses[size] : ''} ${className}`}
            style={sizeStyle}
          >
            <span>Y</span>
          </div>
        );
      } else if (emailProvider === 'outlook' || emailProvider === 'hotmail') {
        return (
          <div 
            className={`flex items-center justify-center bg-blue-600 rounded-full text-white ${typeof size === 'string' ? sizeClasses[size] : ''} ${className}`}
            style={sizeStyle}
          >
            <span>M</span>
          </div>
        );
      }
    }
    
    // Default: show initial with color
    return (
      <div 
        className={`flex items-center justify-center ${bgColor} rounded-full text-white ${typeof size === 'string' ? sizeClasses[size] : ''} ${className}`}
        style={sizeStyle}
      >
        <span>{initial}</span>
      </div>
    );
  };
  
  // If image is provided, create an image element
  if (imageUrl) {
    return (
      <div className="relative">
        <img 
          src={imageUrl} 
          alt={username} 
          className={`rounded-full object-cover ${typeof size === 'string' ? sizeClasses[size] : ''} ${className}`}
          style={sizeStyle}
          onError={(e) => {
            // If image fails to load, replace with fallback
            const target = e.currentTarget;
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '';
              const fallback = renderFallback();
              if (typeof fallback === 'object') {
                // Create a DOM element from the React element
                const div = document.createElement('div');
                div.className = fallback.props.className;
                Object.assign(div.style, fallback.props.style || {});
                div.innerHTML = `<span>${initial}</span>`;
                parent.appendChild(div);
              }
            }
          }}
        />
      </div>
    );
  }
  
  return renderFallback();
}