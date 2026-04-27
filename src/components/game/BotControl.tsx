import React from 'react';
import { Bot, LoaderCircle, Play, Send, Square } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useSocket } from '../../hooks/useSocket';

const phaseLabel: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  typing: 'Typing',
  sending: 'Sending',
  error: 'Error',
};

export const BotControl: React.FC = () => {
  const { socket } = useSocket();
  const { gameState, myId, botProgress } = useGame();

  if (!socket || !gameState || !myId) {
    return null;
  }

  const isMyBot = !botProgress.playerId || botProgress.playerId === myId;
  const isActive = isMyBot && botProgress.isActive;
  const showPanel = isMyBot && (isActive || Boolean(botProgress.message) || Boolean(botProgress.draftText));
  const previewText = botProgress.draftText
    || (botProgress.phase === 'thinking' ? '...' : '');

  return (
    <div className="pointer-events-none absolute right-5 top-5 z-20 w-[min(24rem,calc(100%-2.5rem))] space-y-3">
      <div className="pointer-events-auto flex justify-end gap-2">
        <button
          type="button"
          onClick={() => socket.emit(isActive ? 'stopBot' : 'startBot')}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] shadow-xl backdrop-blur ${
            isActive
              ? 'border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
              : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
          }`}
        >
          {isActive ? <Square size={12} /> : <Play size={12} />}
          {isActive ? 'Stop bot' : 'Start bot'}
        </button>
      </div>

      {showPanel && (
        <div className="pointer-events-auto rounded-[1.75rem] border border-black/5 bg-white/60 p-4 text-zinc-900 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-cyan-600/30 bg-cyan-600/10 p-2 text-cyan-800">
                <Bot size={14} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-800">Gemini Bot</div>
                <div className="text-sm font-semibold text-zinc-900">{phaseLabel[botProgress.phase] || 'Idle'}</div>
              </div>
            </div>
            {botProgress.phase === 'thinking' && <LoaderCircle size={16} className="animate-spin text-cyan-600" />}
          </div>

          {botProgress.message && (
            <div className="mt-3 text-xs leading-6 text-zinc-600">{botProgress.message}</div>
          )}

          {botProgress.thinkingText && (
            <div className="mt-3 rounded-2xl border border-cyan-600/15 bg-cyan-600/5 px-3 py-2 text-xs leading-6 text-cyan-900/85">
              {botProgress.thinkingText}
            </div>
          )}

          <div className="mt-3 flex items-end gap-2">
            <div className="min-h-[5.5rem] flex-1 rounded-[1.4rem] border border-black/5 bg-white/40 px-4 py-3 text-sm leading-6 text-zinc-800 shadow-inner">
              {previewText ? (
                <span className="whitespace-pre-wrap">{previewText}</span>
              ) : (
                <span className="text-zinc-400">The bot will draft its next move here.</span>
              )}
            </div>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                botProgress.phase === 'sending'
                  ? 'border-emerald-600/40 bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'border-black/10 bg-black/5 text-zinc-400'
              }`}
            >
              <Send size={16} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
