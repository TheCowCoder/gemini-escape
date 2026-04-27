import type { EditorDraft, GameMode, ItemSlot, ItemTemplate } from '../../types';

export type { EditorDraft, GameMode, ItemSlot, ItemTemplate, LevelPackage } from '../../types';

export type ItemOrigin = 'starter' | 'found' | 'spawned' | 'crafted' | 'salvaged';

export interface Item extends ItemTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  descriptionMd: string;
  color: string;
  slot: ItemSlot;
  origin: ItemOrigin;
  tags: string[];
}

export interface SpawnMenuItem extends ItemTemplate {
  blueprintId: string;
  name: string;
  emoji: string;
  description: string;
  descriptionMd: string;
  color: string;
  slot: ItemSlot;
  tags: string[];
}

export interface SketchAttachment {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ActionPayload {
  text: string;
  sketch?: SketchAttachment;
}

export type RealismLabel = 'high' | 'medium' | 'low';

export interface PromptActionEntry {
  playerId: string;
  playerName: string;
  text: string;
  sketch?: SketchAttachment;
}

export interface InventoryDelta {
  playerId: string;
  removeItemIds: string[];
  addItems: Item[];
  summary?: string;
}

export interface Player {
  id: string;
  name: string;
  inventory: Item[];
  equipped: {
    head?: string;
    body?: string;
    hands?: string;
    feet?: string;
  };
  isLockedIn: boolean;
  lastAction?: ActionPayload;
  color: string;
}

export interface NPCDialogue {
  name: string;
  emoji: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  type: 'chat' | 'narrative' | 'system' | 'retry' | 'prompt' | 'image';
  text: string;
  actionEntries?: PromptActionEntry[];
  author?: string;
  authorColor?: string;
  timestamp: number;
  imageUrl?: string;
  thoughtLength?: number;
  npcDialogues?: NPCDialogue[];
  textOnly?: boolean;
}

export interface CanonDelta {
  addFacts: string[];
  removeFacts: string[];
  summary?: string;
}

export interface EngineDebugState {
  globalRules: string;
  levelSystemPrompt: string;
  levelUserPrompt: string;
  runtimeSnapshot: string;
  sessionCanon: string[];
  visualCanon: string[];
  fullPrompt: string;
  rawResponse: string;
  inventoryDeltas: InventoryDelta[];
  canonDelta: CanonDelta;
  visualCanonDelta: CanonDelta;
  cinematicImagePrompt: string;
  actions: Array<{
    playerId: string;
    playerName: string;
    action: string;
    hasSketch?: boolean;
    realismScore?: number;
    realismLabel?: RealismLabel;
    constraints?: string[];
  }>;
}

export interface TurnProgress {
  phase: 'idle' | 'waiting' | 'thinking' | 'responding';
  waitingText?: string;
  latestThought?: string;
  thoughtLog: string[];
  responseText: string;
  imageProgress?: number; // 0 to 100
}

export interface BotProgress {
  playerId?: string;
  isActive: boolean;
  phase: 'idle' | 'thinking' | 'typing' | 'sending' | 'error';
  thinkingText?: string;
  draftText?: string;
  message?: string;
}

export interface GameState {
  sessionId: string;
  mode: GameMode;
  levelId: string;
  levelTitle: string;
  levelStartingText: string;
  levelGoal: string;
  startingImageUrl?: string; // URL path to the static starting_image.png in levels/id/
  environment: {
    title: string;
    description: string;
    exits: string[];
  };
  players: Record<string, Player>;
  turnNumber: number;
  isResolving: boolean;
  levelComplete?: boolean;
  spawnMenu: SpawnMenuItem[];
  sessionCanon: string[];
  visualCanon: string[];
  discoveredNPCs: Record<string, string>;
  gameTime: string; // "10:00 AM", "2:30 PM", etc.
  debug: EngineDebugState | null;
}

export interface LevelData {
  id: string;
  title: string;
  startingText?: string;
  levelDescription: string;
  levelGoal: string;
  startingInventory: ItemTemplate[];
  npcDefinitions?: Record<string, string>;
  startingImageUrl?: string;
}

export interface LevelSummary {
  id: string;
  title: string;
  startingText?: string;
  levelDescription: string;
  levelGoal: string;
  startingImageUrl?: string;
}

export interface JoinPayload {
  name: string;
  sessionId: string;
  mode: GameMode;
  levelId: string;
  modelName: string;
}

export interface SessionSettings {
  onlyImages: boolean;
  shouldGenerateImages: boolean;
}

export interface ClientToServerEvents {
  chat: (message: string) => void;
  lockAction: (action: ActionPayload) => void;
  join: (payload: JoinPayload) => void;
  equip: (itemId: string, slot: string) => void;
  spawnItem: (blueprintId: string) => void;
  startBot: () => void;
  stopBot: () => void;
  resetSession: () => void;
  cancelImageGeneration: () => void;
  updateEditorDraft: (draft: EditorDraft) => void;
  updateSessionSettings: (payload: { sessionId: string; settings: SessionSettings }) => void;
  'set-model-name': (payload: { modelName: string }) => void;
  moveItemToContainer: (itemId: string, containerId: string) => void;
  removeItemFromContainer: (itemId: string, containerId: string) => void;
  dropItem: (itemId: string) => void;
  pickupItem: (itemId: string) => void;
  giveItem: (itemId: string, targetPlayerId: string) => void;
  takeAllFromContainer: (containerId: string) => void;
  splitStack: (itemId: string, amount: number) => void;
  toggleItemState: (itemId: string, toggleKey: string) => void;
  forceRetryTurn: () => void;
}

export interface LevelCompletePayload {
  levelId: string;
  levelTitle: string;
  turnNumber: number;
}

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  chatMessage: (message: ChatMessage) => void;
  narrativeLog: (messages: ChatMessage[]) => void;
  turnProgress: (progress: TurnProgress) => void;
  botProgress: (progress: BotProgress) => void;
  levelComplete: (payload: LevelCompletePayload) => void;
  sceneVisualized: (payload: { id: string; imageUrl: string; thoughtLength?: number; npcDialogues?: NPCDialogue[] }) => void;
  sessionSettings: (settings: SessionSettings) => void;
  serverLog: (payload: any) => void;
}