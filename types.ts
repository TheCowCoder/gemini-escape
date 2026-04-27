export interface GameMessage {
  role: 'user' | 'model';
  text: string;
}

export type GameMode = 'level' | 'editor' | 'freeplay';

export type ItemSlot = 'head' | 'body' | 'hands' | 'feet' | 'none';

export interface ItemTemplate {
  id?: string;
  name: string;
  emoji?: string;
  description?: string;
  descriptionMd?: string;
  semanticNotes?: string;
  color?: string;
  slot?: ItemSlot;
  tags?: string[];
  madeWith?: string;
  materials?: string[];
  affordances?: string[];
  measurements?: Record<string, string>;
  condition?: string;
  maxSlots?: number;
  toggles?: Record<string, boolean>;
  contents?: ItemTemplate[];
}

export interface LevelData {
  id: string;
  title: string;
  startingText?: string;
  levelDescription: string; // File path (e.g. "levelDescription.md")
  levelGoal: string;
  startingInventory: ItemTemplate[];
  npcDefinitions?: Record<string, string>;
  startingImageUrl?: string;
}

export interface PromptArtifacts {
  systemPrompt: string;
  userPrompt: string;
  npcPrompts?: Record<string, string>;
  levelDescription: string;
}

export interface LevelPackage {
  data: LevelData;
  prompts: PromptArtifacts;
}

export interface LevelSummary {
  id: string;
  title: string;
  startingText?: string;
  levelDescription: string;
  levelGoal: string;
  startingImageUrl?: string;
}

export interface EditorDraft {
  id: string;
  title: string;
  startingText?: string;
  levelDescription: string;
  levelGoal: string;
  systemPrompt: string;
  userPrompt: string;
  startingInventory: ItemTemplate[];
}
