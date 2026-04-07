import React, { useState } from 'react';
import { SocketProvider } from './hooks/useSocket';
import { GameProvider, useGame } from './hooks/useGame';
import { useSocket } from './hooks/useSocket';
import { WorldPanel } from './components/game/WorldPanel';
import { ChatLog } from './components/game/ChatLog';
import { ActionInput } from './components/game/ActionInput';
import { PlayerList } from './components/game/PlayerList';
import { Inventory } from './components/game/Inventory';

const JoinScreen = () => {
  const { socket } = useSocket();
  const [name, setName] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && socket) {
      socket.emit('join', name.trim());
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex items-center justify-center font-mono">
      <form onSubmit={handleJoin} className="bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-teal-400 mb-2 text-center">Gemini Escape</h1>
        <p className="text-gray-400 text-center mb-8">The Chasm awaits.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-1">Traveler Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-4 py-3 text-white focus:outline-none focus:border-teal-500"
              placeholder="Enter your name..."
              autoFocus
            />
          </div>
          <button 
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 text-white font-bold py-3 rounded transition-colors"
          >
            Enter the World
          </button>
        </div>
      </form>
    </div>
  );
};

const GameLayout = () => {
  const { gameState, myId } = useGame();

  if (!gameState?.players[myId || '']) {
    return <JoinScreen />;
  }

  return (
    <div className="h-screen w-screen bg-gray-950 text-white flex flex-col md:flex-row font-mono overflow-hidden">
      {/* Left Column: Party & Game Stream */}
      <div className="w-full md:w-80 lg:w-96 h-1/3 md:h-full flex-shrink-0 border-r border-gray-800 flex flex-col bg-gray-900">
        <div className="flex-none">
          <PlayerList />
        </div>
        <div className="flex-1 overflow-hidden border-t border-gray-800">
          <ChatLog />
        </div>
      </div>

      {/* Main Column: World & Actions */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="flex-1 relative overflow-hidden">
          <WorldPanel />
        </div>
        <Inventory />
        <ActionInput />
      </div>
    </div>
  );
};

const App = () => {
  return (
    <SocketProvider>
      <GameProvider>
        <GameLayout />
      </GameProvider>
    </SocketProvider>
  );
};

export default App;
