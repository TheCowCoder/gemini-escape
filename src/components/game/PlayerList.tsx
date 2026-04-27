import React from 'react';
import { useGame } from '../../hooks/useGame';
import { PlayerAvatar } from './PlayerAvatar';
import { Users } from 'lucide-react';
import type { Player } from '../../types';

export const PlayerList: React.FC = () => {
  const { gameState, myId, chatHistory, botProgress, ignoreServerLock } = useGame();

  if (!gameState) return null;

  const players = Object.values(gameState.players) as Player[];
  const lastNarrativeTimestamp = [...chatHistory].reverse().find((message) => message.type === 'narrative')?.timestamp || 0;

  return (
    <div className="bg-white/20 p-3 backdrop-blur-sm">
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <Users size={14} className="text-teal-700" />
          Party Members ({players.length})
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/40 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          {gameState.mode} session • {gameState.sessionId}
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {players.map(player => (
          (() => {
            const lastPlayerLockTimestamp = [...chatHistory].reverse().find(
              (message) => message.type === 'system' && message.text === `${player.name} has locked in their action.`
            )?.timestamp || 0;
            const playerCompletedTurnOverride = player.id === myId && (ignoreServerLock || lastNarrativeTimestamp > lastPlayerLockTimestamp);

            return (
          <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${player.id === myId ? 'bg-teal-600/10 border border-teal-600/20' : 'bg-white/40 border border-black/5 shadow-sm'}`}>
            <PlayerAvatar player={player} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: player.color }}>
                {player.name} {player.id === myId && <span className="text-[9px] text-teal-700 ml-1">(YOU)</span>}
              </div>
              <div className="text-[9px] text-zinc-500 truncate font-medium">
                {player.id === myId && botProgress.isActive && (!botProgress.playerId || botProgress.playerId === myId)
                  ? `Bot ${botProgress.phase}`
                  : (playerCompletedTurnOverride ? false : player.isLockedIn)
                    ? 'READY'
                    : 'THINKING...'}
              </div>
            </div>
          </div>
            );
          })()
        ))}
      </div>
    </div>
  );
};
