import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useGame } from '../../hooks/useGame';
import { Terminal, Camera } from 'lucide-react';

export const ChatLog: React.FC = () => {
  const { chatHistory, onlyImages } = useGame();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-full bg-white/20 backdrop-blur-sm">
      <div className="p-2 bg-white/40 border-b border-black/5 font-bold text-zinc-500 text-xs uppercase tracking-widest flex items-center gap-2">
        <Terminal size={14} className="text-teal-600" /> Game Stream
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
        {chatHistory.filter(m => onlyImages ? m.type !== 'narrative' : true).map((msg) => (
          <div key={msg.id} className={`text-sm ${msg.type === 'system' ? 'text-zinc-500 italic text-[10px]' : ''}`}>
            {msg.type === 'chat' && (
              <div className="flex flex-col">
                <span className="text-[10px] font-bold opacity-70" style={{ color: msg.authorColor }}>{msg.author}</span>
                <span className="text-zinc-800">{msg.text}</span>
              </div>
            )}
             {msg.type === 'prompt' && (
              <div className="flex flex-col">
                <span className="text-zinc-800 font-serif italic text-xs">"{msg.text}"</span>
              </div>
            )}
            {msg.type === 'image' && (
              <div className="flex flex-col gap-1 rounded-lg border border-black/5 bg-white/40 p-2 shadow-sm">
                <div className="text-[9px] font-bold uppercase tracking-tighter text-teal-700 flex items-center gap-1">
                  <Camera size={10} /> POV
                </div>
                {msg.imageUrl && <img src={msg.imageUrl} alt="View" className="w-full aspect-video object-cover rounded-md mt-1" />}
                {msg.npcDialogues && msg.npcDialogues.length > 0 && (
                  <div className="flex flex-col gap-1 mt-2">
                    {msg.npcDialogues.map((npc, idx) => (
                      <span key={idx} className="text-[10px] text-zinc-800">
                        <span className="font-bold">{npc.emoji} {npc.name}:</span> "{npc.text}"
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {msg.type === 'retry' && (
              <div className="flex justify-center my-2">
                <span className="bg-yellow-600/10 border border-yellow-600/50 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter">{msg.text}</span>
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