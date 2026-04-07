import React from 'react';
import { useGame } from '../../hooks/useGame';
import { Map, Compass } from 'lucide-react';

export const WorldPanel: React.FC = () => {
  const { gameState } = useGame();

  if (!gameState) return <div className="p-4 text-gray-500">Loading world...</div>;

  return (
    <div className="absolute inset-0 overflow-y-auto p-6 bg-gray-900">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-teal-400 font-serif tracking-wide flex items-center gap-3">
            <Map className="text-teal-600" />
            {gameState.environment.title}
          </h1>
          <div className="text-xs text-gray-500 mt-2 uppercase tracking-widest">Turn {gameState.turnNumber}</div>
        </header>

        <div className="text-lg text-gray-300 leading-relaxed font-serif">
          {gameState.environment.description}
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Compass size={16} />
            Obvious Exits & Points of Interest
          </h3>
          <ul className="space-y-2">
            {gameState.environment.exits.map((exit, i) => (
              <li key={i} className="text-teal-200 flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-teal-500 before:rounded-full">
                {exit}
              </li>
            ))}
            {gameState.environment.exits.length === 0 && (
              <li className="text-gray-500 italic">No obvious exits. You are trapped.</li>
            )}
          </ul>
        </div>

        <div className="mt-8 p-4 bg-teal-900/10 border border-teal-900/30 rounded-lg">
          <h4 className="text-xs font-bold text-teal-500 uppercase tracking-widest mb-2">How to Play</h4>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Type your intent in the bottom box (e.g., "Search the house" or "Climb down").</li>
            <li>Click <span className="text-teal-400 font-bold">Lock Action</span> to commit.</li>
            <li>The world reacts once <span className="text-white">all players</span> have locked in.</li>
            <li>Use the right panel to chat with other travelers instantly.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
