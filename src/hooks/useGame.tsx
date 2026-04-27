import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BotProgress, GameState, ChatMessage, TurnProgress, LevelCompletePayload } from '../types';
import { useSocket } from './useSocket';

interface GameContextType {
  gameState: GameState | null;
  chatHistory: ChatMessage[];
  myId: string | null;
  turnProgress: TurnProgress;
  botProgress: BotProgress;
  ignoreServerLock: boolean;
  setIgnoreServerLock: (value: boolean) => void;
  levelCompletePayload: LevelCompletePayload | null;
  onlyImages: boolean;
  setOnlyImages: (value: boolean) => void;
  shouldGenerateImages: boolean;
  setShouldGenerateImages: (value: boolean) => void;
  clearGameSession: () => void;
  sendGameMessage: (type: string, payload?: any) => void;
}

const idleTurnProgress: TurnProgress = {
  phase: 'idle',
  thoughtLog:[],
  responseText: '',
};

const idleBotProgress: BotProgress = {
  isActive: false,
  phase: 'idle',
};

const GameContext = createContext<GameContextType>({
  gameState: null,
  chatHistory:[],
  myId: null,
  turnProgress: idleTurnProgress,
  botProgress: idleBotProgress,
  ignoreServerLock: false,
  setIgnoreServerLock: () => {},
  levelCompletePayload: null,
  onlyImages: false,
  setOnlyImages: () => {},
  shouldGenerateImages: true,
  setShouldGenerateImages: () => {},
  clearGameSession: () => {},
  sendGameMessage: () => {},
});

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const[chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [turnProgress, setTurnProgress] = useState<TurnProgress>(idleTurnProgress);
  const [botProgress, setBotProgress] = useState<BotProgress>(idleBotProgress);
  const [ignoreServerLock, setIgnoreServerLock] = useState(false);
  const[levelCompletePayload, setLevelCompletePayload] = useState<LevelCompletePayload | null>(null);
  const [onlyImages, setOnlyImages] = useState(false);
  const [shouldGenerateImages, setShouldGenerateImages] = useState(true);

  const clearGameSession = () => {
    setGameState(null);
    setChatHistory([]);
    setTurnProgress(idleTurnProgress);
    setBotProgress(idleBotProgress);
    setIgnoreServerLock(false);
    setLevelCompletePayload(null);
  };

  const sendGameMessage = (type: string, payload?: any) => {
    socket?.emit(type as any, payload);
  };

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
    socket.on('disconnect', () => setIgnoreServerLock(false));
    socket.on('disconnect', () => setBotProgress(idleBotProgress));

    socket.on('gameState', (state) => {
      setGameState(state);
    });

    socket.on('chatMessage', (msg) => {
      setChatHistory((prev) => [...prev, msg].slice(-100));
      if (msg.type === 'narrative') {
        setTurnProgress(idleTurnProgress);
        setIgnoreServerLock(true);
        setGameState((previousState) => {
          if (!previousState) {
            return previousState;
          }

          const players = Object.fromEntries(
            Object.entries(previousState.players).map(([playerId, player]) =>[
              playerId,
              {
                ...player,
                isLockedIn: false,
                lastAction: undefined,
              },
            ])
          );

          return {
            ...previousState,
            isResolving: false,
            players,
          };
        });
      }
    });

    socket.on('narrativeLog', (history) => {
      setChatHistory(history);
    });

    socket.on('turnProgress', (progress) => {
      setTurnProgress(progress);
      if (progress.phase !== 'idle') {
        setIgnoreServerLock(false);
      }
    });

    socket.on('botProgress', (progress) => {
      setBotProgress(progress);
    });

    socket.on('levelComplete', (payload) => {
      setLevelCompletePayload(payload);
    });

    socket.on('sessionSettings', (settings) => {
      setOnlyImages(settings.onlyImages);
      setShouldGenerateImages(settings.shouldGenerateImages);
    });

    // We intercept the sceneVisualized event to graft the new thought length data right onto the history log
    socket.on('sceneVisualized', (payload) => {
      setChatHistory((prev) =>
        prev.map((msg) => msg.id === payload.id ? { ...msg, imageUrl: payload.imageUrl, thoughtLength: payload.thoughtLength } : msg)
      );
    });

    return () => {
      socket.off('gameState');
      socket.off('chatMessage');
      socket.off('narrativeLog');
      socket.off('turnProgress');
      socket.off('botProgress');
      socket.off('levelComplete');
      socket.off('sceneVisualized');
    };
  },[socket]);

  return (
    <GameContext.Provider value={{ 
      gameState, chatHistory, myId, turnProgress, botProgress, 
      ignoreServerLock, setIgnoreServerLock, levelCompletePayload, 
      onlyImages, setOnlyImages, shouldGenerateImages, setShouldGenerateImages,
      clearGameSession, sendGameMessage 
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);