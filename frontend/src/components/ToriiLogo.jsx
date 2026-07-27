// frontend/src/components/ToriiLogo.jsx
import React from 'react';
import ToriiMiniLogo from './ToriiMiniLogo.jsx';
import ToriiWordmark from './ToriiWordmark.jsx';

/**
 * Torii Brand Logo Component (Vector Upgrade)
 * 
 * Supports variants:
 *  - 'full': Centered icon logo mark + Torii Wordmark + optional tagline
 *  - 'horizontal': Compact layout with icon mark + Torii Wordmark
 *  - 'icon': Icon mark (Torii Gate) only
 */
export default function ToriiLogo({ 
  variant = 'horizontal', 
  className = '', 
  showTagline = false, 
  size = 'md',
  dark = false
}) {
  const iconSizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const wordmarkSizeMap = {
    sm: 'h-4',
    md: 'h-5',
    lg: 'h-7',
    xl: 'h-10',
  };

  const iconClass = iconSizeMap[size] || 'w-9 h-9';
  const wordmarkClass = wordmarkSizeMap[size] || 'h-5';
  const textColor = dark ? 'white' : '#0f172a';

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center space-y-2.5 ${className}`}>
        <ToriiMiniLogo className={iconClass} />
        <div className="flex flex-col items-center">
          <span className="sr-only">Torii</span>
          <ToriiWordmark className={`${wordmarkClass} w-auto`} fill={textColor} animated />
          {showTagline && (
            <p className="text-[10px] font-bold text-cyan-600 tracking-widest uppercase mt-1.5">
              Legacy Behind. Resolution Ahead.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <ToriiMiniLogo className={iconClass} />
      </div>
    );
  }

  // Default 'horizontal' layout
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <ToriiMiniLogo className={iconClass} />
      <div>
        <div className="flex items-center space-x-1.5">
          <span className="sr-only">Torii</span>
          <ToriiWordmark className={`${wordmarkClass} w-auto`} fill={textColor} animated />
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
        </div>
        {showTagline && (
          <p className="text-[9px] font-bold text-cyan-600 tracking-wider uppercase mt-0.5">
            Legacy Behind. Resolution Ahead.
          </p>
        )}
      </div>
    </div>
  );
}
