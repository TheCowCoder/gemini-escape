import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useGame } from '../../hooks/useGame';
import { Terminal } from 'lucide-react';

export const ChatLog: React.FC = () => {
  const { chatHistory } = useGame();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="p-3 bg-gray-900 border-b border-gray-800 font-bold text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2">
        <Terminal size={14} className="text-teal-500" />
        Game Stream
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {chatHistory.filter(m => m.type !== 'chat').map((msg) => (
          <div key={msg.id} className={`text-sm ${msg.type === 'system' ? 'text-gray-600 italic text-[10px]' : ''}`}>
            {msg.type === 'narrative' && (
              <div className="bg-gray-900/50 border-l-2 border-teal-800 p-3 text-teal-100 font-serif leading-relaxed">
                {msg.text}
              </div>
            )}
            {msg.type === 'system' && (
              <span>{msg.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
