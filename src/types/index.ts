export interface Item {
  id: string;
  name: string;
  description: string;
  color: string;
  slot: 'head' | 'body' | 'hands' | 'feet' | 'none';
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
  lastAction?: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  type: 'chat' | 'narrative' | 'system';
  text: string;
  author?: string;
  authorColor?: string;
  timestamp: number;
}

export interface GameState {
  environment: {
    title: string;
    description: string;
    exits: string[];
  };
  players: Record<string, Player>;
  turnNumber: number;
  isResolving: boolean;
}

export interface ClientToServerEvents {
  chat: (message: string) => void;
  lockAction: (action: string) => void;
  join: (name: string) => void;
  equip: (itemId: string, slot: string) => void;
}

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  chatMessage: (message: ChatMessage) => void;
  narrativeLog: (messages: ChatMessage[]) => void;
}
