'use client';

import React from 'react';

interface VideoPlayerProps {
  videoId: string;
  onClose: () => void;
}

export default function VideoPlayer({ videoId, onClose }: VideoPlayerProps) {
  return (
    <div className="w-full max-w-3xl aspect-video relative border border-neon-cyan/50 rounded bg-black/80 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
      <button 
        onClick={onClose}
        className="absolute -top-4 -right-4 w-8 h-8 bg-black border border-neon-cyan text-neon-cyan rounded-full flex items-center justify-center hover:bg-neon-cyan hover:text-black transition-colors z-20"
      >
        ×
      </button>
      <div className="w-full h-full p-2">
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded"
        ></iframe>
      </div>
    </div>
  );
}
