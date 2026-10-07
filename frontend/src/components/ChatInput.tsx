'use client';

import React, { useState } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  isListening: boolean;
  onToggleListen: () => void;
}

export default function ChatInput({ onSend, isListening, onToggleListen }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  return (
    <div className="mt-auto pt-4 relative z-20">
      <form onSubmit={handleSubmit} className="flex gap-4">
        <button
          type="button"
          onClick={onToggleListen}
          className={`w-12 h-12 flex items-center justify-center rounded border ${isListening ? 'bg-neon-magenta/20 border-neon-magenta text-neon-magenta shadow-[0_0_15px_rgba(255,0,255,0.5)]' : 'bg-black/50 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10'}`}
        >
          {isListening ? (
            <div className="w-4 h-4 rounded-full bg-neon-magenta animate-pulse"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
          )}
        </button>
        
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="コマンドを入力..."
          className="flex-1 bg-black/50 border border-neon-cyan/30 text-neon-cyan px-4 rounded focus:outline-none focus:border-neon-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] placeholder-neon-cyan/30 font-medium"
        />
        
        <button
          type="submit"
          className="px-6 h-12 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold rounded hover:bg-neon-cyan hover:text-black transition-colors"
          style={{ fontFamily: 'Orbitron' }}
        >
          SEND
        </button>
      </form>
    </div>
  );
}
