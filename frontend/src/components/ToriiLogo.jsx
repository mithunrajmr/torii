// frontend/src/components/ToriiLogo.jsx
import React from 'react';

/**
 * Torii Brand Logo Component
 * 
 * Supports variants:
 *  - 'full': Displays image logo with brand name & tagline
 *  - 'horizontal': Compact header layout with image logo + brand text
 *  - 'icon': Icon mark only
 */
export default function ToriiLogo({ variant = 'horizontal', className = '', showTagline = false, size = 'md' }) {
  const sizeMap = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-16',
    xl: 'h-24',
  };

  const currentSize = sizeMap[size] || 'h-10';

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center space-y-2 ${className}`}>
        <img
          src="/torii-logo.jpg"
          alt="Torii - Legacy Behind. Resolution Ahead."
          className={`${currentSize} object-contain rounded-2xl shadow-sm border border-slate-200/50`}
        />
        {showTagline && (
          <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
            Legacy Behind. Resolution Ahead.
          </p>
        )}
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <img
        src="/torii-logo.jpg"
        alt="Torii Logo Icon"
        className={`${currentSize} w-auto object-contain rounded-xl shadow-sm ${className}`}
      />
    );
  }

  // Default 'horizontal' layout
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img
        src="/torii-logo.jpg"
        alt="Torii Logo"
        className={`${currentSize} w-auto object-contain rounded-xl shadow-sm border border-slate-200/30`}
      />
      <div>
        <div className="flex items-center space-x-1">
          <span className="text-lg font-extrabold tracking-tight text-slate-900">Torii</span>
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
        </div>
        {showTagline && (
          <p className="text-[9px] font-bold text-cyan-600 tracking-wider uppercase">
            Legacy Behind. Resolution Ahead.
          </p>
        )}
      </div>
    </div>
  );
}
