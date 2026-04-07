import React, { useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useGame } from '../../hooks/useGame';
import { Send } from 'lucide-react';

export const ActionInput: React.FC = () => {
  const { socket } = useSocket();
  const { gameState, myId } = useGame();
  const [action, setAction] = useState('');

  const me = myId && gameState ? gameState.players[myId] : null;
  const isLockedIn = me?.isLockedIn;
  const isResolving = gameState?.isResolving;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!action.trim() || isLockedIn || isResolving || !socket) return;
    
    socket.emit('lockAction', action);
    setAction('');
  };

  if (!me) return null;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-gray-800 border-t border-gray-700">
      <input
        type="text"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder={isLockedIn ? "Waiting for others..." : isResolving ? "The world is reacting..." : "What do you do next?"}
        disabled={isLockedIn || isResolving}
        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!action.trim() || isLockedIn || isResolving}
        className="bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
      >
        {isLockedIn ? 'Locked In' : 'Lock Action'}
        <Send size={16} />
      </button>
    </form>
  );
};
