import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GameState, ChatMessage } from '../types';
import { useSocket } from './useSocket';

interface GameContextType {
  gameState: GameState | null;
  chatHistory: ChatMessage[];
  myId: string | null;
}

const GameContext = createContext<GameContextType>({ gameState: null, chatHistory: [], myId: null });

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const updateId = () => {
      setMyId(socket.id || null);
    };

    if (socket.connected) {
      updateId();
    }

    socket.on('connect', updateId);
    socket.on('disconnect', () => setMyId(null));

    socket.on('gameState', (state) => {
      setGameState(state);
    });

    socket.on('chatMessage', (msg) => {
      setChatHistory((prev) => [...prev, msg].slice(-100));
    });

    socket.on('narrativeLog', (history) => {
      setChatHistory(history);
    });

    return () => {
      socket.off('gameState');
      socket.off('chatMessage');
      socket.off('narrativeLog');
    };
  }, [socket]);

  return (
    <GameContext.Provider value={{ gameState, chatHistory, myId }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);
