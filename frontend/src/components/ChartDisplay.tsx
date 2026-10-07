'use client';

import React from 'react';

interface ChartDisplayProps {
  data: {
    title: string;
    labels: string[];
    values: number[];
    type: 'bar' | 'line';
  };
  onClose: () => void;
}

export default function ChartDisplay({ data, onClose }: ChartDisplayProps) {
  const maxVal = Math.max(...data.values);

  return (
    <div className="w-full max-w-2xl p-6 relative border border-neon-magenta/50 rounded bg-black/80 shadow-[0_0_20px_rgba(255,0,255,0.2)]">
      <button 
        onClick={onClose}
        className="absolute -top-4 -right-4 w-8 h-8 bg-black border border-neon-magenta text-neon-magenta rounded-full flex items-center justify-center hover:bg-neon-magenta hover:text-black transition-colors z-20"
      >
        ×
      </button>
      
      <h3 className="text-neon-magenta text-xl mb-6 font-bold tracking-widest" style={{ fontFamily: 'Orbitron' }}>
        {data.title}
      </h3>
      
      <div className="h-64 flex items-end justify-between gap-2 border-b border-l border-neon-magenta/30 pb-2 pl-2">
        {data.values.map((val, idx) => (
          <div key={idx} className="flex flex-col items-center flex-1 group">
            <div className="opacity-0 group-hover:opacity-100 text-xs text-neon-magenta mb-2 transition-opacity">
              {val}
            </div>
            <div 
              className="w-full bg-neon-magenta/60 hover:bg-neon-magenta transition-all"
              style={{ height: `${(val / maxVal) * 100}%` }}
            ></div>
            <div className="text-xs text-neon-magenta/70 mt-2 truncate w-full text-center">
              {data.labels[idx]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
