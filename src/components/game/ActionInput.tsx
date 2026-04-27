import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useGame } from '../../hooks/useGame';
import { PencilLine, Send, Trash2 } from 'lucide-react';
import type { SketchAttachment } from '../../types';
import { Sketchpad } from './Sketchpad';

export const ActionInput: React.FC = () => {
  const { socket } = useSocket();
  const { gameState, myId, chatHistory, turnProgress, botProgress, ignoreServerLock, setIgnoreServerLock } = useGame();
  const [action, setAction] = useState('');
  const [sketch, setSketch] = useState<SketchAttachment | undefined>(undefined);
  const [isSketchpadOpen, setIsSketchpadOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const me = myId && gameState ? gameState.players[myId] : null;
  const lastNarrativeTimestamp = [...chatHistory].reverse().find((message) => message.type === 'narrative')?.timestamp || 0;
  const lastMyLockTimestamp = me
    ? [...chatHistory].reverse().find((message) => message.type === 'system' && message.text === `${me.name} has locked in their action.`)?.timestamp || 0
    : 0;
  const completedTurnOverride = lastNarrativeTimestamp > lastMyLockTimestamp;
  const isLockedIn = ignoreServerLock || completedTurnOverride ? false : me?.isLockedIn;
  const isBotActive = botProgress.isActive && (!botProgress.playerId || botProgress.playerId === myId);
  const isResolving = completedTurnOverride ? false : gameState?.isResolving || turnProgress.phase !== 'idle';
  const placeholder = isBotActive
    ? 'Bot autoplay is controlling this traveler.'
    : isResolving
    ? 'Waiting for model...'
    : isLockedIn
      ? 'Waiting for others...'
      : 'Describe the full invention, construction, salvage, or action sequence you want to attempt.';
  const buttonLabel = isBotActive ? 'Bot Active' : isResolving ? 'Resolving' : isLockedIn ? 'Locked In' : 'Lock Action';

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    const maxHeight = Math.floor(window.innerHeight * 0.5);
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.maxHeight = `${maxHeight}px`;
    textarea.style.height = `${Math.max(nextHeight, 44)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  const submitAction = () => {
    if (!action.trim() || isLockedIn || isResolving || isBotActive || !socket) return;
    
    setIgnoreServerLock(false);
    socket.emit('lockAction', {
      text: action.trim(),
      ...(sketch ? { sketch } : {}),
    });
    setAction('');
    setSketch(undefined);
    setIsSketchpadOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitAction();
  };

  useEffect(() => {
    const handleEditSketch = (e: Event) => {
      const customEvent = e as CustomEvent<SketchAttachment>;
      setSketch(customEvent.detail);
      setIsSketchpadOpen(true);
    };
    window.addEventListener('gemini-escape-edit-sketch', handleEditSketch);
    return () => window.removeEventListener('gemini-escape-edit-sketch', handleEditSketch);
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [action]);

  if (!me) return null;

  return (
    <div className="space-y-3 border-t border-black/5 bg-white/60 p-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={isLockedIn || isResolving || isBotActive}
          onClick={() => setIsSketchpadOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-600/20 bg-cyan-600/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-800 transition-colors hover:bg-cyan-600/20 disabled:opacity-50"
        >
          <PencilLine size={12} />
          {sketch ? 'Edit Sketch' : 'Add Sketch'}
        </button>

        {sketch && (
          <button
            type="button"
            disabled={isLockedIn || isResolving || isBotActive}
            onClick={() => {
              setSketch(undefined);
              setIsSketchpadOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 transition-colors hover:bg-white/60 disabled:opacity-50"
          >
            <Trash2 size={12} />
            Remove Sketch
          </button>
        )}
      </div>

      {isSketchpadOpen ? (
        <Sketchpad value={sketch} onChange={setSketch} disabled={isLockedIn || isResolving || isBotActive} />
      ) : isBotActive ? (
        <div className="rounded-2xl border border-emerald-600/20 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-900 backdrop-blur-sm">
          The bot is controlling this player. Stop the bot from the overlay to resume manual input.
        </div>
      ) : sketch ? (
        <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/40 p-3 shadow-sm">
          <img src={sketch.dataUrl} alt="Attached sketch preview" className="h-20 w-32 rounded-xl border border-black/10 bg-[#faf7ef] object-cover" />
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-800">Sketch Attached</div>
            <div className="text-sm text-zinc-600">This sketch will be shown in the prompt history and sent to the model as a planning image.</div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submitAction();
              return;
            }

            if (event.key === 'Enter' && event.shiftKey) {
              requestAnimationFrame(() => resizeTextarea());
            }
          }}
          placeholder={placeholder}
          disabled={isLockedIn || isResolving || isBotActive}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-black/5 bg-white/40 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-teal-500/50 focus:outline-none focus:ring-4 focus:ring-teal-500/5 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!action.trim() || isLockedIn || isResolving || isBotActive}
          className="self-end flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2 font-bold text-white transition-all hover:bg-teal-700 disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {buttonLabel}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
