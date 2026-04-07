import React from 'react';
import { useGame } from '../../hooks/useGame';
import { PlayerAvatar } from './PlayerAvatar';
import { Users } from 'lucide-react';
import type { Player } from '../../types';

export const PlayerList: React.FC = () => {
  const { gameState, myId } = useGame();

  if (!gameState) return null;

  const players = Object.values(gameState.players) as Player[];

  return (
    <div className="bg-gray-900 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
        <Users size={14} className="text-teal-600" />
        Party Members ({players.length})
      </div>
      
      <div className="flex flex-col gap-3">
        {players.map(player => (
          <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${player.id === myId ? 'bg-teal-900/10 border border-teal-900/30' : 'border border-transparent'}`}>
            <PlayerAvatar player={player} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: player.color }}>
                {player.name} {player.id === myId && <span className="text-[9px] text-teal-500 ml-1">(YOU)</span>}
              </div>
              <div className="text-[9px] text-gray-500 truncate">
                {player.isLockedIn ? 'Locked In' : 'Thinking...'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
