import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import type { EditorDraft, GameMode, LevelPackage } from './src/types/index.js';
import { freeplaySpawnMenu } from './src/data/spawnCatalog.js';
import { decideBotAction } from './src/services/botEngine.js';
import { resolveTurn } from './src/services/engine.js';
import { conversationLogger } from './src/services/conversationLogger.js';
import { ONLY_IMAGES, GEN_STARTER } from './src/config/settings.js';
import {
  FREEPLAY_LEVEL_ID,
  editorDraftToLevelPackage,
  levelPackageToEditorDraft,
  listLevelSummaries,
  loadGlobalSystemPrompt,
  loadSemanticPhysicsPrompt,
  loadStarterCinematicPrompt,
  loadInventorPrompt,
  loadLevelPackage,
} from './src/services/levelLoader.js';
import { createStarterItem, normalizeInventory, makeItemId, spawnMenuItemToCard } from './src/services/itemCards.js';
import { generateSceneImage } from './src/services/visualizer.js';
import type {
  ActionPayload,
  BotProgress,
  ChatMessage,
  ClientToServerEvents,
  GameState,
  JoinPayload,
  Player,
  ServerToClientEvents,
  TurnProgress,
} from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GameSession {
  id: string;
  mode: GameMode;
  baseLevelPackage: LevelPackage;
  editorDraft: EditorDraft | null;
  gameState: GameState;
  chatHistory: ChatMessage[];
  botControllers: Record<string, BotController>;
  modelName: string;
  settings: {
    onlyImages: boolean;
    shouldGenerateImages: boolean;
  };
  imageGenerationAbortController: AbortController | null;
  turnResolutionAbortController: AbortController | null;
  manualRetryRequested: boolean;
}

interface BotController {
  active: boolean;
  running: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
  progress: BotProgress;
}

const PLAYER_COLORS =['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const idleTurnProgress: TurnProgress = { phase: 'idle', thoughtLog:[], responseText: '' };
const createIdleBotProgress = (playerId?: string): BotProgress => ({ playerId, isActive: false, phase: 'idle' });
const BOT_TYPING_STEP_MS = 45;
const BOT_TYPING_CHUNK_SIZE = 4;
const BOT_NEXT_TURN_DELAY_MS = 1400;
const BOT_RESET_DELAY_MS = 600;

const makeMessageId = () => Math.random().toString(36).slice(2, 9) + Date.now();

const pickSpawnMenu = (mode: GameMode) => (mode === 'level' ?[] : freeplaySpawnMenu);

const seedExits = (mode: GameMode) => {
  if (mode === 'freeplay') {
    return['Wander deeper into the forest', 'Look for useful materials', 'Clear space for an invention'];
  }
  return['Survey the area', 'Search for useful materials', 'Push farther into the world'];
};

const buildBaseGameState = (sessionId: string, mode: GameMode, levelPackage: LevelPackage): GameState => ({
  sessionId,
  mode,
  levelId: levelPackage.data.id,
  levelTitle: levelPackage.data.title,
  levelStartingText: levelPackage.data.startingText ?? levelPackage.prompts.levelDescription,
  levelGoal: levelPackage.data.levelGoal,
  startingImageUrl: levelPackage.data.startingImageUrl,
  environment: {
    title: levelPackage.data.title,
    description: levelPackage.data.startingText ?? levelPackage.prompts.levelDescription,
    exits: seedExits(mode),
  },
  players: {},
  turnNumber: 1,
  isResolving: false,
  spawnMenu: pickSpawnMenu(mode),
  sessionCanon: [],
  visualCanon:[],
  discoveredNPCs: levelPackage.prompts.npcPrompts || {},
  gameTime: '10:00 AM',
  debug: null,
});

const getActiveLevelPackage = (session: GameSession) =>
  session.editorDraft ? editorDraftToLevelPackage(session.editorDraft) : session.baseLevelPackage;

const buildStarterInventory = (levelPackage: LevelPackage) =>
  normalizeInventory(levelPackage.data.startingInventory.map((item) => createStarterItem(item)));

const buildEquippedState = (inventory: Player['inventory']) => {
  const equipped: Player['equipped'] = {};
  inventory.forEach((item) => {
    if (item.slot !== 'none' && !equipped[item.slot]) {
      equipped[item.slot] = item.id;
    }
  });
  return equipped;
};

const resetPlayersForLevel = (players: Record<string, Player>, levelPackage: LevelPackage) => {
  const nextPlayers: Record<string, Player> = {};
  Object.values(players).forEach((player) => {
    const inventory = buildStarterInventory(levelPackage);
    nextPlayers[player.id] = {
      ...player,
      inventory,
      equipped: buildEquippedState(inventory),
      isLockedIn: false,
      lastAction: undefined,
    };
  });
  return nextPlayers;
};

const getInventoryLookup = (inventory: any[]) => {
  const lookup = new Map<string, { item: any, parentList: any[], index: number }>();
  const traverse = (list: any[]) => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item.id) {
        lookup.set(item.id, { item, parentList: list, index: i });
      }
      if (item.contents) traverse(item.contents);
    }
  };
  traverse(inventory);
  return lookup;
};

const findItemRecursive = (inventory: any[], itemId: string): any => {
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item.id === itemId) return { ownerList: inventory, item, index: i };
    if (item.contents) {
      const found = findItemRecursive(item.contents as any[], itemId);
      if (found) return found;
    }
  }
  return null;
};

const removeItemRecursive = (inventory: any[], itemId: string): any => {
  const found = findItemRecursive(inventory, itemId);
  if (found) {
    found.ownerList.splice(found.index, 1);
    return found.item;
  }
  return null;
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  const PORT = Number(process.env.PORT || 3001);
  const globalSystemPrompt = await loadGlobalSystemPrompt();
  const semanticPhysicsPrompt = await loadSemanticPhysicsPrompt();
  const starterCinematicPromptTemplate = await loadStarterCinematicPrompt();
  const inventorPrompt = await loadInventorPrompt();
  const sessions = new Map<string, GameSession>();

  const levelsPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, 'levels') 
    : path.join(process.cwd(), 'levels');
  app.use('/levels', express.static(levelsPath));

  const broadcastState = (session: GameSession) => {
    io.to(session.id).emit('gameState', session.gameState);
  };

  const broadcastHistory = (session: GameSession) => {
    io.to(session.id).emit('narrativeLog', session.chatHistory);
  };

  const emitTurnProgress = (session: GameSession, progress: TurnProgress) => {
    io.to(session.id).emit('turnProgress', progress);
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getBotController = (session: GameSession, playerId: string) => {
    if (!session.botControllers[playerId]) {
      session.botControllers[playerId] = {
        active: false,
        running: false,
        timeoutId: null,
        progress: createIdleBotProgress(playerId),
      };
    }
    return session.botControllers[playerId];
  };

  const clearBotTimeout = (controller: BotController) => {
    if (controller.timeoutId) {
      clearTimeout(controller.timeoutId);
      controller.timeoutId = null;
    }
  };

  const emitBotProgress = (session: GameSession, playerId: string, progress: BotProgress) => {
    const controller = getBotController(session, playerId);
    controller.progress = { ...progress, playerId };
    io.to(playerId).emit('botProgress', controller.progress);
  };

  const setBotInactive = (session: GameSession, playerId: string, message?: string) => {
    const controller = getBotController(session, playerId);
    controller.active = false;
    controller.running = false;
    clearBotTimeout(controller);
    emitBotProgress(session, playerId, { isActive: false, phase: 'idle', message });
  };

  const addChatMessage = (session: GameSession, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const fullMsg: ChatMessage = { ...msg, id: makeMessageId(), timestamp: Date.now() };
    session.chatHistory.push(fullMsg);
    if (session.chatHistory.length > 200) session.chatHistory.shift();
    io.to(session.id).emit('chatMessage', fullMsg);
  };

  const ensureSession = async (config: { sessionId: string; mode: GameMode; levelId: string; modelName: string }) => {
    const existing = sessions.get(config.sessionId);
    if (existing) {
      if (config.modelName) existing.modelName = config.modelName;
      return existing;
    }

    const levelId = config.mode === 'freeplay' ? FREEPLAY_LEVEL_ID : config.levelId;
    const baseLevelPackage = await loadLevelPackage(levelId);
    const session: GameSession = {
      id: config.sessionId,
      mode: config.mode,
      baseLevelPackage,
      editorDraft: config.mode === 'editor' ? levelPackageToEditorDraft(baseLevelPackage) : null,
      gameState: buildBaseGameState(config.sessionId, config.mode, baseLevelPackage),
      chatHistory:[],
      botControllers: {},
      modelName: config.modelName,
      settings: {
        onlyImages: ONLY_IMAGES,
        shouldGenerateImages: true,
      },
      imageGenerationAbortController: null,
      turnResolutionAbortController: null,
      manualRetryRequested: false,
    };
    sessions.set(session.id, session);

    // Log session start to conversation file
    conversationLogger.logConversationStart(session.id, levelId, []);

    if (GEN_STARTER) {
      const visualId = makeMessageId();
      const starterImageMsg: ChatMessage = {
        id: visualId,
        type: 'image',
        text: session.gameState.levelStartingText, 
        timestamp: Date.now()
      };
      session.chatHistory.push(starterImageMsg);

      const cinematicPrompt = starterCinematicPromptTemplate.replace('{LEVEL_STARTING_TEXT}', session.gameState.levelStartingText);

      generateSceneImage(cinematicPrompt, undefined, (seconds, attempt, status) => {
        console.log(`Retrying starter image in ${seconds}s, #${attempt} (Status: ${status})`);
      })
        .then(payload => {
          const msg = session.chatHistory.find(m => m.id === visualId);
          if (msg) {
            msg.imageUrl = payload.imageUrl;
            msg.thoughtLength = payload.thoughtLength;
          }
          io.to(session.id).emit('sceneVisualized', { 
            id: visualId, 
            imageUrl: payload.imageUrl!,
            thoughtLength: payload.thoughtLength
          });
        })
        .catch(err => console.error("Failed to generate starter image:", err));
    }
    return session;
  };

  const getSessionForSocket = (socketId: string) => {
    for (const session of sessions.values()) {
      if (session.gameState.players[socketId]) return session;
    }
    return null;
  };

  const lockPlayerAction = (session: GameSession, playerId: string, action: ActionPayload) => {
    if (session.gameState.isResolving) return false;
    const player = session.gameState.players[playerId];
    if (!player) return false;
    const normalizedActionText = action.text?.trim();
    if (!normalizedActionText) return false;
    player.lastAction = { text: normalizedActionText, sketch: action.sketch };
    player.isLockedIn = true;
    
    // Log player input to conversation file
    conversationLogger.logPlayerInput(session.id, playerId, player.name, normalizedActionText);
    
    addChatMessage(session, { type: 'system', text: `${player.name} has locked in their action.` });
    broadcastState(session);
    checkAndResolveTurn(session);
    return true;
  };

  function queueBotTurn(session: GameSession, playerId: string, delayMs = BOT_NEXT_TURN_DELAY_MS) {
    const controller = getBotController(session, playerId);
    const player = session.gameState.players[playerId];
    if (!controller.active || controller.running || !player || session.gameState.isResolving || player.isLockedIn || session.gameState.levelComplete) return;
    clearBotTimeout(controller);
    controller.timeoutId = setTimeout(() => {
      controller.timeoutId = null;
      void runBotTurn(session, playerId);
    }, delayMs);
  }

  function scheduleActiveBots(session: GameSession, delayMs = BOT_NEXT_TURN_DELAY_MS) {
    Object.keys(session.botControllers).forEach((playerId) => queueBotTurn(session, playerId, delayMs));
  }

  const runBotTurn = async (session: GameSession, playerId: string) => {
    const controller = getBotController(session, playerId);
    const player = session.gameState.players[playerId];
    if (!controller.active || controller.running || !player || session.gameState.isResolving || player.isLockedIn || session.gameState.levelComplete) return;
    controller.running = true;
    clearBotTimeout(controller);

    console.log(`[BOT ${playerId}] Starting turn for ${player.name}`);

    try {
      emitBotProgress(session, playerId, { isActive: true, phase: 'thinking', message: 'Bot is thinking...' });
      const { thinking, action } = await decideBotAction({
        currentState: session.gameState,
        levelPackage: getActiveLevelPackage(session),
        chatHistory: session.chatHistory,
        playerId,
        modelName: session.modelName,
      });
      if (!controller.active || !session.gameState.players[playerId] || session.gameState.isResolving) return;

      emitBotProgress(session, playerId, { isActive: true, phase: 'typing', thinkingText: thinking, draftText: '', message: 'Bot is typing...' });
      for (let index = 0; index < action.length; index += BOT_TYPING_CHUNK_SIZE) {
        emitBotProgress(session, playerId, { isActive: true, phase: 'typing', thinkingText: thinking, draftText: action.slice(0, index + BOT_TYPING_CHUNK_SIZE), message: 'Bot is typing...' });
        await sleep(BOT_TYPING_STEP_MS);
        if (!controller.active || !session.gameState.players[playerId] || session.gameState.isResolving) return;
      }

      emitBotProgress(session, playerId, { isActive: true, phase: 'sending', thinkingText: thinking, draftText: action, message: 'Bot pressed send.' });
      await sleep(220);
      if (!controller.active || !session.gameState.players[playerId] || session.gameState.isResolving) return;

      const locked = lockPlayerAction(session, playerId, { text: action });
      if (locked) {
        console.log(`[BOT ${playerId}] Action locked: "${action.substring(0, 50)}..."`);
        emitBotProgress(session, playerId, { isActive: true, phase: 'idle', thinkingText: thinking, draftText: action, message: 'Waiting for turn resolution...' });
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[BOT ${playerId}] Error: ${errorMsg}`);
      emitBotProgress(session, playerId, { isActive: true, phase: 'error', message: `Bot error: ${errorMsg}` });
    } finally {
      controller.running = false;
    }
  };

  const resetSessionState = (session: GameSession) => {
    const activeLevelPackage = getActiveLevelPackage(session);
    session.gameState = {
      ...buildBaseGameState(session.id, session.mode, activeLevelPackage),
      players: resetPlayersForLevel(session.gameState.players, activeLevelPackage),
    };
    session.chatHistory =[];
    emitTurnProgress(session, idleTurnProgress);
    addChatMessage(session, { type: 'system', text: `Session reset for ${activeLevelPackage.data.title}.` });
    
    if (GEN_STARTER) {
      const visualId = makeMessageId();
      const starterImageMsg: ChatMessage = {
        id: visualId,
        type: 'image',
        text: session.gameState.levelStartingText,
        timestamp: Date.now()
      };
      session.chatHistory.push(starterImageMsg);
      const cinematicPrompt = starterCinematicPromptTemplate.replace('{LEVEL_STARTING_TEXT}', session.gameState.levelStartingText);
      generateSceneImage(cinematicPrompt, undefined, (seconds, attempt, status) => {
        console.log(`Retrying starter image (reset) in ${seconds}s, #${attempt} (Status: ${status})`);
      })
        .then(payload => {
          const msg = session.chatHistory.find(m => m.id === visualId);
          if (msg) {
            msg.imageUrl = payload.imageUrl;
            msg.thoughtLength = payload.thoughtLength;
          }
          io.to(session.id).emit('sceneVisualized', { id: visualId, imageUrl: payload.imageUrl!, thoughtLength: payload.thoughtLength });
        })
        .catch(err => console.error("Failed to generate starter image on reset:", err));
    }
    broadcastHistory(session);
    broadcastState(session);
    scheduleActiveBots(session, BOT_RESET_DELAY_MS);
  };

  const checkAndResolveTurn = async (session: GameSession) => {
    if (session.gameState.isResolving) return;
    const activePlayers = Object.values(session.gameState.players);
    if (activePlayers.length === 0) return;
    const allLockedIn = activePlayers.every((player) => player.isLockedIn);
    if (!allLockedIn) return;

    session.gameState.isResolving = true;
    session.manualRetryRequested = false;
    broadcastState(session);
    console.log(`[SESSION ${session.id}] STARTING TURN RESOLUTION (Turn ${session.gameState.turnNumber})`);
    emitTurnProgress(session, { phase: 'waiting', waitingText: 'Waiting for model...', thoughtLog:[], responseText: '' });
    addChatMessage(session, { type: 'system', text: 'All players locked in. Resolving turn...' });

    const actions = activePlayers.map((player) => ({ playerId: player.id, playerName: player.name, action: player.lastAction?.text || 'Wait', sketch: player.lastAction?.sketch }));
    addChatMessage(session, { type: 'prompt', text: actions.map((entry) => `${entry.playerName}: ${entry.action}`).join('\n'), actionEntries: actions.map((entry) => ({ playerId: entry.playerId, playerName: entry.playerName, text: entry.action, sketch: entry.sketch })) });

    const activeLevelPackage = getActiveLevelPackage(session);
    let streamedThoughtLog: string[] =[];
    
    // Create a local logger function that emits immediately to this session
    const logEvent = (event: string, data?: any) => {
      const logEntry = { timestamp: Date.now(), event, data };
      io.to(session.id).emit('serverLog', logEntry);
      // Also log to console for Playwright capture
      if (event.includes('error') || event.includes('retry') || event.includes('abort')) {
        console.log(`[SESSION ${session.id}] ${event}:`, JSON.stringify(data));
      }
    };

    logEvent('turn_resolution_start', { turnNumber: session.gameState.turnNumber, actionCount: actions.length, timestamp: Date.now() });

    session.turnResolutionAbortController = new AbortController();

    try {
      const { newState, narrative, cinematicImagePrompt, npcDialogues, debug } = await resolveTurn({
        currentState: session.gameState, 
        levelPackage: activeLevelPackage, 
        globalSystemPrompt, 
        semanticPhysicsPrompt,
        inventorPrompt,
        actions, 
        modelName: session.modelName,
        externalAbortSignal: session.turnResolutionAbortController.signal,
        onLog: logEvent, 
        onRetry: (seconds, attempt, status) => {
          const retryText = `Waiting for model... Retry in ${seconds}s (#${attempt}, Status: ${status})`;
          emitTurnProgress(session, { phase: 'waiting', waitingText: retryText, thoughtLog: streamedThoughtLog, responseText: '', latestThought: streamedThoughtLog[streamedThoughtLog.length - 1] });
          addChatMessage(session, { type: 'retry', text: `Retrying turn resolution in ${seconds}s, #${attempt} (Status: ${status})` });
        },
        onThoughtUpdate: (thoughtLog) => {
          streamedThoughtLog = thoughtLog;
          emitTurnProgress(session, { phase: 'thinking', waitingText: 'Waiting for model...', latestThought: thoughtLog[thoughtLog.length - 1], thoughtLog, responseText: '' });
        },
        onTextUpdate: (text) => {
          let partialNarrative = '';
          
          try {
            const nKey = '"narrative"';
            const idx = text.indexOf(nKey);
            if (idx !== -1) {
              const colonIdx = text.indexOf(':', idx + nKey.length);
              if (colonIdx !== -1) {
                const quoteIdx = text.indexOf('"', colonIdx);
                if (quoteIdx !== -1) {
                  let endIdx = text.length;
                  for (let i = quoteIdx + 1; i < text.length; i++) {
                    if (text[i] === '"' && text[i-1] !== '\\') {
                      endIdx = i;
                      break;
                    }
                  }
                  partialNarrative = text.substring(quoteIdx + 1, endIdx).replace(/\\n/g, '\n').replace(/\\"/g, '"');
                }
              }
            }
          } catch (e) {
            // Failsafe catch for streaming extraction bounds errors
          }

          emitTurnProgress(session, { 
            phase: 'responding', 
            waitingText: 'Generating response...', 
            latestThought: streamedThoughtLog[streamedThoughtLog.length - 1], 
            thoughtLog: streamedThoughtLog, 
            responseText: partialNarrative || 'Writing narrative...' 
          });
        }
      });
      session.gameState = { ...newState, debug };
      Object.values(session.gameState.players).forEach((player) => { player.isLockedIn = false; player.lastAction = undefined; });
      console.log(`[SESSION ${session.id}] TURN RESOLVED SUCCESSFULLY`);
      logEvent('turn_resolution_success', { newTurnNumber: session.gameState.turnNumber });
      
      // Log to conversation file
      if (streamedThoughtLog.length > 0) {
        conversationLogger.logModelThinking(session.id, streamedThoughtLog);
      }
      conversationLogger.logTurnResolution(session.id, session.gameState.turnNumber, actions.length, true);
      addChatMessage(session, { type: 'narrative', text: narrative });

      const shouldGenImages = session.settings.onlyImages || session.settings.shouldGenerateImages;
      if (cinematicImagePrompt && shouldGenImages) {
        const visualId = makeMessageId();
        const imageMsg: ChatMessage = { id: visualId, type: 'image', text: cinematicImagePrompt, timestamp: Date.now(), npcDialogues: npcDialogues };
        session.chatHistory.push(imageMsg);
        if (session.chatHistory.length > 200) session.chatHistory.shift();
        io.to(session.id).emit('chatMessage', imageMsg);

        logEvent('image_generation_start', { visualId, promptLength: cinematicImagePrompt.length });

        emitTurnProgress(session, { 
          phase: 'responding', 
          waitingText: 'Generating image...', 
          thoughtLog: streamedThoughtLog, 
          responseText: narrative, 
          latestThought: streamedThoughtLog[streamedThoughtLog.length - 1],
          imageProgress: 0 
        });

        try {
          // Create abort controller for this image generation so it can be cancelled
          session.imageGenerationAbortController = new AbortController();
          const messagePayload = await generateSceneImage(cinematicImagePrompt, (progress) => {
            emitTurnProgress(session, { 
              phase: 'responding', 
              waitingText: 'Generating image...', 
              thoughtLog: streamedThoughtLog, 
              responseText: narrative, 
              latestThought: streamedThoughtLog[streamedThoughtLog.length - 1],
              imageProgress: progress 
            });
          }, (seconds, attempt, status) => {
            const retryText = `Generating image... Retry in ${seconds}s (#${attempt}, Status: ${status})`;
            logEvent('image_generation_retry', { attempt, seconds, status });
            emitTurnProgress(session, { 
              phase: 'responding', 
              waitingText: retryText, 
              thoughtLog: streamedThoughtLog, 
              responseText: narrative, 
              latestThought: streamedThoughtLog[streamedThoughtLog.length - 1],
              imageProgress: 0 
            });
            addChatMessage(session, { type: 'retry', text: `Retrying image in ${seconds}s, #${attempt} (Status: ${status})` });
          }, session.imageGenerationAbortController.signal);
          
          logEvent('image_generation_success', { visualId });
          session.imageGenerationAbortController = null;
          const msgToUpdate = session.chatHistory.find(m => m.id === visualId);
          if (msgToUpdate) {
            msgToUpdate.imageUrl = messagePayload.imageUrl;
            msgToUpdate.thoughtLength = messagePayload.thoughtLength; 
          }
          io.to(session.id).emit('sceneVisualized', { id: visualId, imageUrl: messagePayload.imageUrl!, thoughtLength: messagePayload.thoughtLength, npcDialogues });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[SESSION ${session.id}] Image generation failed:`, errorMsg);
          logEvent('image_generation_error', { error: errorMsg });
          
          // Log error to conversation file
          conversationLogger.logImageGeneration(session.id, 'error', { error: errorMsg });
          
          session.imageGenerationAbortController = null;
          addChatMessage(session, { type: 'system', text: 'Visual generation failed for this turn.' });
        }
      }
      if (session.gameState.levelComplete) {
        logEvent('level_complete', { levelId: session.gameState.levelId, turnNumber: session.gameState.turnNumber });
        
        // Log level complete to conversation file
        conversationLogger.logLevelComplete(session.id, session.gameState.levelId, session.gameState.turnNumber);
        
        io.to(session.id).emit('levelComplete', { levelId: session.gameState.levelId, levelTitle: session.gameState.levelTitle, turnNumber: session.gameState.turnNumber });
      } else {
        scheduleActiveBots(session, BOT_NEXT_TURN_DELAY_MS);
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg === 'MANUAL_RETRY_REQUESTED') {
        console.log(`[SESSION ${session.id}] Manual turn retry requested`);
        logEvent('turn_resolution_manual_retry_requested', {});
        session.manualRetryRequested = true;
        session.gameState = { ...session.gameState, isResolving: false };
      } else {
      console.error(`[SESSION ${session.id}] Turn resolution FATAL error:`, errorMsg);
      logEvent('turn_resolution_fatal_error', { errorMessage: errorMsg, errorName: error.name });
      
      // Log fatal error to conversation file
      conversationLogger.logError(session.id, 'Turn Resolution Failed', { error: errorMsg });
      conversationLogger.logTurnResolution(session.id, session.gameState.turnNumber, actions.length, false, errorMsg);
      session.gameState = { ...session.gameState, isResolving: false };
      Object.values(session.gameState.players).forEach((player) => { player.isLockedIn = false; player.lastAction = undefined; });
      addChatMessage(session, { type: 'narrative', text: `SYSTEM ERROR: ${errorMsg}` });
      scheduleActiveBots(session, BOT_NEXT_TURN_DELAY_MS * 2);
      }
    } finally {
      session.turnResolutionAbortController = null;
      if (session.manualRetryRequested) {
        emitTurnProgress(session, { phase: 'waiting', waitingText: 'Retrying model...', thoughtLog:[], responseText: '' });
      } else {
        emitTurnProgress(session, idleTurnProgress);
      }
      broadcastState(session);
      if (session.manualRetryRequested) {
        session.manualRetryRequested = false;
        setTimeout(() => {
          void checkAndResolveTurn(session);
        }, 0);
      }
    }
  };

  app.get('/api/levels', async (_req, res) => { res.json(await listLevelSummaries()); });
  app.get('/api/levels/:levelId', async (req, res) => {
    try {
      const levelPackage = await loadLevelPackage(req.params.levelId);
      res.json(levelPackageToEditorDraft(levelPackage));
    } catch { res.status(404).json({ error: 'Level not found.' }); }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    socket.on('join', async (payload: JoinPayload) => {
      console.log(`[SOCKET ${socket.id}] Join request: mode=${payload.mode}, sessionId=${payload.sessionId}, levelId=${payload.levelId}`);
      
      const session = await ensureSession({ sessionId: payload.sessionId, mode: payload.mode, levelId: payload.levelId, modelName: payload.modelName || 'gemini-3.1-pro-preview' });
      socket.join(session.id);
      if (!session.gameState.players[socket.id]) {
        const color = PLAYER_COLORS[Object.keys(session.gameState.players).length % PLAYER_COLORS.length];
        const activeLevelPackage = getActiveLevelPackage(session);
        const inventory = buildStarterInventory(activeLevelPackage);
        const playerName = payload.name || `Traveler ${socket.id.substring(0, 4)}`;
        session.gameState.players[socket.id] = { id: socket.id, name: playerName, inventory, equipped: buildEquippedState(inventory), isLockedIn: false, color };
        console.log(`[SOCKET ${socket.id}] Player added: ${playerName}`);
        addChatMessage(session, { type: 'system', text: `${playerName} has joined the session.` });
      }
      socket.emit('gameState', session.gameState);
      socket.emit('narrativeLog', session.chatHistory);
      socket.emit('turnProgress', idleTurnProgress);
      socket.emit('botProgress', getBotController(session, socket.id).progress);
      socket.emit('sessionSettings', session.settings);
      broadcastState(session);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });

    socket.on('updateSessionSettings', (payload) => {
      const session = sessions.get(payload.sessionId);
      if (session) {
        session.settings = payload.settings;
        io.to(session.id).emit('sessionSettings', session.settings);
      }
    });

    socket.on('moveItemToContainer', (itemId: string, containerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (!entry) return;

      // Remove from old location
      entry.parentList.splice(entry.index, 1);
      const targetItem = entry.item;

      if (containerId === 'root-inventory') {
        player.inventory.push(targetItem);
      } else {
        const containerEntry = lookup.get(containerId);
        if (containerEntry && (containerEntry.item.tags?.includes('container') || containerEntry.item.tags?.includes('assembly'))) {
          const container = containerEntry.item;
          if (!container.contents) container.contents =[];
          if (container.maxSlots && container.contents.length >= container.maxSlots) {
            player.inventory.push(targetItem); // Revert if full
          } else {
            container.contents.push(targetItem);
          }
        } else if (containerEntry) {
          // Rearrange: insert before the target item
          containerEntry.parentList.splice(containerEntry.index, 0, targetItem);
        } else {
          player.inventory.push(targetItem);
        }
      }

      broadcastState(session);
    });

    socket.on('removeItemFromContainer', (itemId: string, containerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (entry) {
        entry.parentList.splice(entry.index, 1);
        player.inventory.push(entry.item);
        broadcastState(session);
      }
    });

    socket.on('dropItem', (itemId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(Object.values(session.gameState.players).flatMap(p => p.inventory));
      const entry = lookup.get(itemId);
      if (entry) {
        entry.parentList.splice(entry.index, 1);

        addChatMessage(session, { 
          type: 'narrative', 
          text: `${player.name} dropped the ${entry.item.name}.` 
        });
        broadcastState(session);
      }
    });


    socket.on('pickupItem', (itemId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(session.gameState.players['groundLevel'].inventory);
      const entry = lookup.get(itemId);
      if (entry) {
        console.log(`[SOCKET ${socket.id}] Pickup: ${entry.item.name}`);
        entry.parentList.splice(entry.index, 1);
        player.inventory.push(entry.item);

        addChatMessage(session, { 
          type: 'narrative', 
          text: `${player.name} picked up the ${entry.item.name}.` 
        });
        broadcastState(session);
      }
    });

    socket.on('giveItem', (itemId: string, targetPlayerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      const targetPlayer = session.gameState.players[targetPlayerId];
      if (!player || !targetPlayer) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (entry) {
        console.log(`[SOCKET ${socket.id}] Give: ${entry.item.name} → ${targetPlayer.name}`);
        entry.parentList.splice(entry.index, 1);
        targetPlayer.inventory.push(entry.item);
        
        addChatMessage(session, { 
          type: 'narrative', 
          text: `${player.name} gave ${entry.item.name} to ${targetPlayer.name}.` 
        });
        broadcastState(session);
      }
    });

    socket.on('takeAllFromContainer', (containerId: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(containerId);
      if (entry && entry.item.contents && entry.item.contents.length > 0) {
        const items = entry.item.contents;
        entry.item.contents =[];
        player.inventory.push(...items);
        
        addChatMessage(session, { 
          type: 'narrative', 
          text: `${player.name} took everything out of the ${entry.item.name}.` 
        });
        broadcastState(session);
      }
    });

    socket.on('splitStack', (itemId: string, amount: number) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (entry && entry.item.measurements?.count) {
        const total = parseInt(entry.item.measurements.count);
        if (amount > 0 && amount < total) {
          const newItem = JSON.parse(JSON.stringify(entry.item));
          newItem.id = makeItemId(newItem.name);
          newItem.measurements.count = String(amount);
          entry.item.measurements.count = String(total - amount);
          entry.parentList.splice(entry.index + 1, 0, newItem);
          broadcastState(session);
        }
      }
    });

    socket.on('toggleItemState', (itemId: string, toggleKey: string) => {
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;

      const lookup = getInventoryLookup(player.inventory);
      const entry = lookup.get(itemId);
      if (entry) {
        if (!entry.item.toggles) entry.item.toggles = {};
        entry.item.toggles[toggleKey] = !entry.item.toggles[toggleKey];
        
        const stateStr = entry.item.toggles[toggleKey] ? 'on' : 'off';
        addChatMessage(session, { 
          type: 'narrative', 
          text: `${player.name} toggled ${toggleKey} ${stateStr} on the ${entry.item.name}.` 
        });
        broadcastState(session);
      }
    });

    socket.on('lockAction', (action) => {
      const session = getSessionForSocket(socket.id);
      if (!session || session.gameState.isResolving) return;
      const player = session.gameState.players[socket.id];
      if (!player) return;
      
      const actionText = typeof action === 'string' ? action : action.text;
      console.log(`[SOCKET ${socket.id}] Lock action: "${actionText.substring(0, 60)}..."`);
      
      if (getBotController(session, socket.id).active) {
        console.log(`[SOCKET ${socket.id}] Disabling bot (manual control taken)`);
        setBotInactive(session, socket.id, 'Bot stopped. Manual control restored.');
        addChatMessage(session, { type: 'system', text: `${player.name} took back manual control from the bot.` });
      }
      lockPlayerAction(session, socket.id, typeof action === 'string' ? { text: action } : action);
    });

    socket.on('resetSession', () => {
      const session = getSessionForSocket(socket.id);
      if (session) {
        console.log(`[SOCKET ${socket.id}] Reset session requested`);
        resetSessionState(session);
      }
    });

    socket.on('cancelImageGeneration', () => {
      const session = getSessionForSocket(socket.id);
      if (session && session.imageGenerationAbortController) {
        console.log(`[SOCKET ${socket.id}] Cancel image generation`);
        session.imageGenerationAbortController.abort();
        session.imageGenerationAbortController = null;
      }
    });

    socket.on('forceRetryTurn', () => {
      const session = getSessionForSocket(socket.id);
      if (session && session.turnResolutionAbortController) {
        console.log(`[SOCKET ${socket.id}] Force retry turn`);
        session.turnResolutionAbortController.abort();
        emitTurnProgress(session, { phase: 'waiting', waitingText: 'Retrying model...', thoughtLog:[], responseText: '' });
        const player = session.gameState.players[socket.id];
        if (player) {
          addChatMessage(session, { type: 'system', text: `${player.name} forced a manual turn retry.` });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
      const session = getSessionForSocket(socket.id);
      if (!session) return;
      const player = session.gameState.players[socket.id];
      if (player) {
        setBotInactive(session, socket.id);
        addChatMessage(session, { type: 'system', text: `${player.name} has left the session.` });
        delete session.gameState.players[socket.id];
      }
      if (Object.keys(session.gameState.players).length === 0) sessions.delete(session.id);
      else { broadcastState(session); checkAndResolveTurn(session); }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname);
    app.use(express.static(distPath));
    app.use((_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }
  httpServer.listen(PORT, '0.0.0.0', () => { console.log(`Server running on http://localhost:${PORT}`); });
}
startServer();