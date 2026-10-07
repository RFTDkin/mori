'use client';

import React from 'react';

type AIStatus = 'idle' | 'listening' | 'speaking' | 'thinking';

interface CoreVisualProps {
  status: AIStatus;
}

export default function CoreVisual({ status }: CoreVisualProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'listening': return 'border-neon-magenta shadow-[0_0_30px_#ff00ff]';
      case 'speaking': return 'border-neon-green shadow-[0_0_30px_#00ff41]';
      case 'thinking': return 'border-yellow-400 shadow-[0_0_30px_#facc15]';
      default: return 'border-neon-cyan shadow-[0_0_30px_#00f0ff]';
    }
  };

  const getInnerColor = () => {
    switch (status) {
      case 'listening': return 'bg-neon-magenta';
      case 'speaking': return 'bg-neon-green';
      case 'thinking': return 'bg-yellow-400';
      default: return 'bg-neon-cyan';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Outer Ring */}
        <div className={`absolute w-full h-full rounded-full border-2 ${getStatusColor()} opacity-20 animate-spin`} style={{ animationDuration: '10s' }}></div>
        
        {/* Middle Ring */}
        <div className={`absolute w-48 h-48 rounded-full border-4 ${getStatusColor()} border-dashed animate-spin`} style={{ animationDuration: '15s', animationDirection: 'reverse' }}></div>
        
        {/* Core */}
        <div className={`w-24 h-24 rounded-full ${getInnerColor()} opacity-80 animate-breathing blur-[2px]`}></div>
        <div className={`absolute w-16 h-16 rounded-full bg-white opacity-90 animate-breathing`}></div>
      </div>
      
      <div className="mt-8 text-center">
        <h2 className="text-3xl font-bold tracking-[0.5em] text-neon-cyan drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]" style={{ fontFamily: 'Orbitron' }}>
          M.O.R.I.
        </h2>
        <p className="text-sm text-neon-cyan/60 tracking-widest mt-2 uppercase">
          {status === 'idle' ? 'STANDBY' : status === 'listening' ? 'AWAITING_INPUT' : status === 'speaking' ? 'TRANSMITTING' : 'PROCESSING'}
        </p>
      </div>
    </div>
  );
}
