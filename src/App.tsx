
import React, { useEffect, useMemo, useState } from 'react';
import { SocketProvider } from './hooks/useSocket';
import { GameProvider, useGame } from './hooks/useGame';
import { useSocket } from './hooks/useSocket';
import type { GameMode } from '../types';
import { MainMenu } from './components/app/MainMenu';
import { SessionJoinScreen } from './components/app/SessionJoinScreen';
import { EditorSidebar } from './components/app/EditorSidebar';
import { WorldPanel } from './components/game/WorldPanel';
import { ChatLog } from './components/game/ChatLog';
import { ActionInput } from './components/game/ActionInput';
import { BotControl } from './components/game/BotControl';
import { PlayerList } from './components/game/PlayerList';
import { Inventory } from './components/game/Inventory';
import { SkyBackground } from './components/SkyBackground';
import { Clock, Image, ImageIcon } from 'lucide-react';
import { useModelStore } from './hooks/useModelStore';

type SessionRoute = {
  kind: 'session';
  mode: GameMode;
  levelId: string;
  sessionId: string;
};

type AppRoute = { kind: 'home' } | SessionRoute;

const createSessionId = () => Math.random().toString(36).slice(2, 8);

const withSessionQuery = (pathname: string) => {
  const currentUrl = new URL(window.location.href);
  let sessionId = currentUrl.searchParams.get('session');

  if (!sessionId) {
    sessionId = createSessionId();
    currentUrl.pathname = pathname;
    currentUrl.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', `${currentUrl.pathname}?${currentUrl.searchParams.toString()}`);
  }

  return sessionId;
};

const parseRoute = (): AppRoute => {
  const segments = window.location.pathname.split('/').filter(Boolean);

  if (segments[0] === 'play' && segments[1]) {
    return {
      kind: 'session',
      mode: 'level',
      levelId: segments[1],
      sessionId: withSessionQuery(window.location.pathname),
    };
  }

  if (segments[0] === 'editor' && segments[1]) {
    return {
      kind: 'session',
      mode: 'editor',
      levelId: segments[1],
      sessionId: withSessionQuery(window.location.pathname),
    };
  }

  if (segments[0] === 'freeplay') {
    return {
      kind: 'session',
      mode: 'freeplay',
      levelId: 'freeplay-forest',
      sessionId: withSessionQuery(window.location.pathname),
    };
  }

  return { kind: 'home' };
};

const SessionHeader: React.FC<{ route: SessionRoute; onBack: () => void }> = ({ route, onBack }) => {
  const { 
    gameState, 
    sendGameMessage 
  } = useGame();
  
  const { modelName, setModelName } = useModelStore();
  
  const label = route.mode === 'editor' ? 'LEVEL EDITOR' : route.mode === 'freeplay' ? 'FREEPLAY' : 'ONLINE PLAY';

  return (
    <div className="flex items-center justify-between border-b border-black/5 bg-white/60 px-4 py-2 text-zinc-900 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
        <span className="font-bold text-zinc-800">{label}</span>
        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <span className="truncate">Session {route.sessionId}</span>
        
        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <div className="flex items-center gap-1.5 font-mono font-bold text-teal-700">
           <Clock size={12} />
           {gameState?.gameTime || '10:00 AM'}
        </div>

        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <select 
          className="bg-transparent font-mono text-zinc-800 text-xs font-bold rounded-md border-zinc-300 focus:ring-teal-500 focus:border-teal-500"
          value={modelName}
          onChange={(e) => {
            const nextModel = e.target.value;
            setModelName(nextModel);
            sendGameMessage('set-model-name', { modelName: nextModel });
          }}
        >
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
        </select>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-black/10 bg-black/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-800 transition-colors hover:bg-black/10"
      >
        Main Menu
      </button>
    </div>
  );
};

const GameColumns = () => (
  <>
    <div className="flex h-[40vh] w-full flex-shrink-0 flex-col border-r border-black/5 bg-white/40 backdrop-blur-md md:h-full md:w-80 lg:w-96">
      <div className="flex-none">
        <PlayerList />
      </div>
      <div className="flex-1 overflow-hidden border-t border-black/5">
        <ChatLog />
      </div>
    </div>

    <div className="flex min-w-0 flex-1 flex-col bg-white/20 backdrop-blur-[2px]">
      <div className="relative flex-1 overflow-hidden">
        <WorldPanel />
        <BotControl />
      </div>
      <Inventory />
      <ActionInput />
    </div>
  </>
);

const SessionPage: React.FC<{ route: SessionRoute; onBack: () => void }> = ({ route, onBack }) => {
  const { socket } = useSocket();
  const { gameState, myId } = useGame();
  const modelName = useModelStore((s) => s.modelName);

  const joined = Boolean(gameState && gameState.sessionId === route.sessionId && myId && gameState.players[myId]);

  const handleJoin = (name: string) => {
    socket?.emit('join', {
      name,
      sessionId: route.sessionId,
      mode: route.mode,
      levelId: route.levelId,
      modelName,
    });
  };

  const joinCopy = useMemo(() => {
    if (route.mode === 'editor') {
      return 'Join the editor session and test the same live multiplayer world while prompt edits are applied between resets.';
    }
    if (route.mode === 'freeplay') {
      return 'Join the sandbox forest and invent with the shared spawn toybox in a live multiplayer session.';
    }
    return 'Join the authored multiplayer session and solve the level through semantic invention, crafting, and exploration.';
  }, [route.mode]);

  if (!joined) {
    return (
      <SessionJoinScreen
        title={route.mode === 'editor' ? 'Level Editor Session' : route.mode === 'freeplay' ? 'Freeplay Session' : 'Online Play Session'}
        subtitle={joinCopy}
        sessionId={route.sessionId}
        onJoin={handleJoin}
      />
    );
  }

  if (route.mode === 'editor') {
    return (
      <SkyBackground>
        <div className="flex h-screen flex-col text-zinc-900">
          <SessionHeader route={route} onBack={onBack} />
          <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
            <EditorSidebar levelId={route.levelId} />
            <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
              <GameColumns />
            </div>
          </div>
        </div>
      </SkyBackground>
    );
  }

  return (
    <SkyBackground>
      <div className="relative flex h-screen flex-col text-zinc-900">
        <SessionHeader route={route} onBack={onBack} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <GameColumns />
        </div>
      </div>
    </SkyBackground>
  );
};

const AppShell = () => {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
  const { clearGameSession } = useGame();

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (pathname: string) => {
    window.history.pushState({}, '', pathname);
    setRoute(parseRoute());
  };

  const handleStart = (mode: GameMode, levelId: string) => {
    const sessionId = createSessionId();
    const pathname = mode === 'freeplay' ? `/freeplay?session=${sessionId}` : `/${mode === 'editor' ? 'editor' : 'play'}/${levelId}?session=${sessionId}`;
    navigate(pathname);
  };

  const handleBack = () => {
    clearGameSession();
    navigate('/');
  };

  if (route.kind === 'home') {
    return <MainMenu onStart={handleStart} />;
  }

  return <SessionPage route={route} onBack={handleBack} />;
};

const App = () => {
  return (
    <SocketProvider>
      <GameProvider>
        <AppShell />
      </GameProvider>
    </SocketProvider>
  );
};

export default App;