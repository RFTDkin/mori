'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from './MoriInterface';

interface MessageLogProps {
  messages: Message[];
}

export default function MessageLog({ messages }: MessageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-80 border-r border-neon-cyan/30 bg-black/40 flex flex-col z-20">
      <div className="p-3 border-b border-neon-cyan/20 text-neon-cyan/70 text-xs font-bold tracking-widest bg-neon-cyan/5" style={{ fontFamily: 'Orbitron' }}>
        COMM_LOG //
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-neon-cyan/50 mb-1">{msg.timestamp} | {msg.sender === 'user' ? 'USR' : 'SYS'}</span>
            <div 
              className={`max-w-[90%] p-3 text-sm rounded ${
                msg.sender === 'user' 
                  ? 'bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan' 
                  : 'bg-neon-magenta/10 border border-neon-magenta/30 text-neon-magenta'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
