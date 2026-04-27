import { createPartFromBase64, GoogleGenAI, Type } from '@google/genai';
import type { LevelPackage } from '../../types';
import type { CanonDelta, EngineDebugState, GameState, InventoryDelta, Item, RealismLabel, SketchAttachment, NPCDialogue } from '../types';
import { normalizeItem } from './itemCards';
import { conversationLogger } from './conversationLogger';

const useVertex = process.env.VERTEX === 'true';
const ai = useVertex
  ? new GoogleGenAI({ vertexai: true, apiKey: process.env.VERTEX_API_KEY || '' })
  : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

if (useVertex && !process.env.VERTEX_API_KEY) {
  console.warn('WARNING: VERTEX=true but VERTEX_API_KEY is not set.');
} else if (!useVertex && !process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not set in the environment.');
}

const measurementSchema = {
  type: Type.OBJECT,
  properties: {
    length: { type: Type.STRING },
    volume: { type: Type.STRING },
    count: { type: Type.STRING },
    weight: { type: Type.STRING },
    durability: { type: Type.STRING },
    fill: { type: Type.STRING },
    capacity: { type: Type.STRING },
    charge: { type: Type.STRING },
  },
};

const canonDeltaSchema = {
  type: Type.OBJECT,
  properties: {
    addFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
    removeFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
  },
  required: ['addFacts', 'removeFacts'],
};

const gameStateSchema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: 'A rich, atmospheric narrative describing the outcome of the players\' actions. Do not place direct quoted NPC speech here; use npcDialogues for any spoken lines.',
    },
    npcDialogues: {
      type: Type.ARRAY,
      description: 'If any NPCs speak during this turn, record every direct spoken line here. Keep quoted NPC dialogue out of narrative and do not duplicate it there.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          emoji: { type: Type.STRING },
          text: { type: Type.STRING, description: 'The exact quote spoken by the NPC. Narrative should not repeat this quote.' }
        },
        required: ['name', 'emoji', 'text']
      }
    },
    cinematicImagePrompt: {
      type: Type.STRING,
      description: 'The highly structured, bracketed English prompt specifically formatted for Nano Banana 2, incorporating the active visual canon, the current action, and the Texas Drone camera settings.',
    },
    environment: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Name of the current location.' },
        description: { type: Type.STRING, description: 'Visual description of the location.' },
        exits: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'List of obvious exits, routes, or leads.',
        },
      },
      required:['title', 'description', 'exits'],
    },
    inventoryDeltas: {
      type: Type.ARRAY,
      description: 'Deterministic inventory operations. Only remove listed item IDs and add the listed items.',
      items: {
        type: Type.OBJECT,
        properties: {
          playerId: { type: Type.STRING },
          removeItemIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          addItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                emoji: { type: Type.STRING },
                description: { type: Type.STRING },
                descriptionMd: { type: Type.STRING },
                semanticNotes: { type: Type.STRING },
                color: { type: Type.STRING },
                slot: { type: Type.STRING },
                origin: { type: Type.STRING },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                madeWith: { type: Type.STRING },
                materials: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                affordances: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                measurements: measurementSchema,
                condition: { type: Type.STRING },
              },
            },
          },
          summary: { type: Type.STRING },
        },
      },
    },
    canonDelta: canonDeltaSchema,
    visualCanonDeltas: canonDeltaSchema,
    levelComplete: {
      type: Type.BOOLEAN,
      description: 'Set to true only when the player has unambiguously achieved the level goal. Do not set prematurely.',
    },
    gameTime: {
      type: Type.STRING,
      description: 'The current time of day in the game world, formatted as "HH:MM AM/PM". You MUST progress this logically each turn based on the intensity of the actions (usually 10-60 minutes). This drives the moon/sun cycle.',
    },
    discoveredNPCs: {
      type: Type.ARRAY,
      description: 'If the player encounters a new NPC or learns more about an existing one, record their details here.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          appearance: { type: Type.STRING },
          personality: { type: Type.STRING },
          icon: { type: Type.STRING },
        },
        required: ['name'],
      },
    },
  },
  required:['narrative', 'cinematicImagePrompt', 'environment', 'inventoryDeltas', 'canonDelta', 'visualCanonDeltas', 'gameTime'],
};

const MODEL_STREAM_IDLE_TIMEOUT_MS = 60000;
const MODEL_STREAM_TOTAL_TIMEOUT_MS = 180000;
const MODEL_FALLBACK_TIMEOUT_MS = 120000;

export const isRetriableModelError = (error: any) => {
  const message = String(error?.message || error || '');
  const status = error?.status || error?.response?.status;
  return status === 503
    || status === 500
    || status === 429
    || /\b503\b|\b500\b|\b429\b|overloaded|unavailable|temporarily unavailable|try again|internal error encountered|timeout|quota|exhausted|"status":"INTERNAL"|\bINTERNAL\b/i.test(message);
};

const buildGenerationConfig = ({
  includeThoughts,
  abortSignal,
  systemInstruction,
}: {
  includeThoughts: boolean;
  abortSignal?: AbortSignal;
  systemInstruction: string;
}) => ({
  systemInstruction,
  temperature: 0.7,
  responseMimeType: "application/json",
  responseSchema: gameStateSchema,
  ...(abortSignal ? { abortSignal } : {}),
  ...(includeThoughts
    ? {
        thinkingConfig: {
          includeThoughts: true,
        },
      }
    : {}),
});

const describeItem = (item: Item) => {
  const metadata =[
    item.semanticNotes ? `notes: ${item.semanticNotes}` : '',
    item.madeWith ? `madeWith: ${item.madeWith}` : '',
    item.materials?.length ? `materials: ${item.materials.join(', ')}` : '',
    item.affordances?.length ? `affordances: ${item.affordances.join(', ')}` : '',
    item.condition ? `condition: ${item.condition}` : '',
    item.measurements
      ? `measurements: ${Object.entries(item.measurements)
          .map(([label, value]) => `${label}=${value}`)
          .join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return `${item.id}: ${item.emoji} ${item.name} - ${item.descriptionMd || item.description}${metadata ? ` (${metadata})` : ''}`;
};

const describeInventory = (state: GameState) =>
  Object.values(state.players)
    .map((player) => {
      const inventory = player.inventory.length ? player.inventory.map(describeItem).join('; ') : 'Empty';
      return `- ${player.name} (ID: ${player.id}): Inventory: ${inventory}`;
    })
    .join('\n');

const applyInventoryDeltas = (state: GameState, deltas: InventoryDelta[] | undefined) => {
  const parseCountMeasurement = (value?: string) => {
    if (!value) {
      return 1;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const collapseDuplicateAdds = (addItems: Item[]) => {
    const groups = new Map<string, Item[]>();
    const order: string[] =[];

    addItems.forEach((item) => {
      const { count, ...restMeasurements } = item.measurements || {};
      const key = JSON.stringify({
        name: item.name,
        emoji: item.emoji,
        descriptionMd: item.descriptionMd,
        origin: item.origin,
        slot: item.slot,
        color: item.color,
        madeWith: item.madeWith,
        materials: item.materials || [],
        affordances: item.affordances ||[],
        condition: item.condition,
        measurements: restMeasurements,
      });

      if (!groups.has(key)) {
        groups.set(key,[]);
        order.push(key);
      }

      groups.get(key)!.push(item);
    });

    return order.map((key) => {
      const group = groups.get(key)!;
      if (group.length === 1) {
        return group[0];
      }

      const base = group[0];
      const totalCount = group.reduce((sum, item) => sum + parseCountMeasurement(item.measurements?.count), 0);

      return {
        ...base,
        measurements: {
          ...(base.measurements || {}),
          count: String(totalCount),
        },
      };
    });
  };

  const normalizedDeltas = (deltas ||[]).map((delta) => ({
    ...delta,
    addItems: collapseDuplicateAdds((delta.addItems || []) as Item[]),
  }));

  normalizedDeltas.forEach((delta) => {
    const player = state.players[delta.playerId];
    if (!player) {
      return;
    }

    const removeIds = new Set(delta.removeItemIds ||[]);
    player.inventory = player.inventory.filter((item) => !removeIds.has(item.id));
    player.inventory.push(...(delta.addItems ||[]).map((item) => normalizeItem(item, item.origin || 'crafted')));

    (Object.keys(player.equipped) as Array<keyof typeof player.equipped>).forEach((slot) => {
      if (player.equipped[slot] && removeIds.has(player.equipped[slot] as string)) {
        delete player.equipped[slot];
      }
    });
  });

  return normalizedDeltas;
};

const normalizeCanonDelta = (canonDelta: Partial<CanonDelta> | undefined): CanonDelta => ({
  addFacts: normalizeStringList(canonDelta?.addFacts),
  removeFacts: normalizeStringList(canonDelta?.removeFacts),
  summary: optionalModelText(canonDelta?.summary),
});

const applyCanonDelta = (state: GameState, canonDelta: CanonDelta) => {
  const removeSet = new Set(canonDelta.removeFacts);
  const nextCanon = state.sessionCanon.filter((fact) => !removeSet.has(fact));

  canonDelta.addFacts.forEach((fact) => {
    if (!nextCanon.includes(fact)) {
      nextCanon.push(fact);
    }
  });

  state.sessionCanon = nextCanon;
  return canonDelta;
};

const applyVisualCanonDelta = (state: GameState, visualDelta: CanonDelta) => {
  const removeSet = new Set(visualDelta.removeFacts);
  const nextVisualCanon = state.visualCanon.filter((fact) => !removeSet.has(fact));

  visualDelta.addFacts.forEach((fact) => {
    if (!nextVisualCanon.includes(fact)) {
      nextVisualCanon.push(fact);
    }
  });

  state.visualCanon = nextVisualCanon;
  return visualDelta;
};

const buildRuntimeSnapshot = (currentState: GameState, levelPackage: LevelPackage) => {
  const sessionCanon = currentState.sessionCanon.length
    ? currentState.sessionCanon.map((fact) => `- ${fact}`).join('\n')
    : '- No additional session canon has been established yet.';

  const visualCanon = currentState.visualCanon?.length
    ? currentState.visualCanon.map((fact) => `- ${fact}`).join('\n')
    : '- No persistent visual facts established yet.';

  const activeNPCs = Object.entries(currentState.discoveredNPCs || {})
    .map(([name, prompt]) => `[NPC: ${name}]\n${prompt}`)
    .join('\n\n');

  return[
    `MODE: ${currentState.mode}`,
    `LEVEL TITLE: ${levelPackage.data.title}`,
    `LEVEL GOAL: ${levelPackage.data.levelGoal}`,
    levelPackage.data.startingText
      ? `STARTING SCENE: ${levelPackage.data.startingText}\nLEVEL CONTEXT: ${levelPackage.prompts.levelDescription}`
      : `LEVEL DESCRIPTION: ${levelPackage.prompts.levelDescription}`,
    `CURRENT ENVIRONMENT TITLE: ${currentState.environment.title}`,
    `CURRENT ENVIRONMENT DESCRIPTION: ${currentState.environment.description}`,
    `CURRENT GAME TIME: ${currentState.gameTime}`,
    `CURRENT EXITS: ${currentState.environment.exits.join(', ') || 'None listed.'}`,
    `SESSION CANON:\n${sessionCanon}`,
    `VISUAL CANON (Persistent Objects in Scene):\n${visualCanon}`,
    `CURRENT PLAYERS:\n${describeInventory(currentState)}`,
    activeNPCs ? `ACTIVE NPCs (Present in the world):\n${activeNPCs}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

type TurnActionInput = {
  playerId: string;
  action: string;
  playerName?: string;
  sketch?: SketchAttachment;
};

const buildActionSnapshot = (
  currentState: GameState,
  actions: TurnActionInput[]
) => actions
  .map((entry) => `- ${entry.playerName || currentState.players[entry.playerId]?.name || entry.playerId}: ${entry.action}${entry.sketch ? ' [Sketch attached]' : ''}`)
  .join('\n');

const parseSketchAttachment = (sketch?: SketchAttachment) => {
  if (!sketch?.dataUrl) {
    return null;
  }

  const match = sketch.dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
};

const buildUserTurnParts = (userTurnContent: string, actions: TurnActionInput[]) => {
  const parts: any[] = [{ text: userTurnContent }];

  actions.forEach((entry) => {
    const sketch = parseSketchAttachment(entry.sketch);
    if (!sketch) {
      return;
    }

    parts.push({
      text: `Reference sketch from ${entry.playerName || entry.playerId} for this action: ${entry.action}`,
    });
    parts.push(createPartFromBase64(sketch.data, sketch.mimeType));
  });

  return[{
    role: 'user' as const,
    parts,
  }];
};

const mergeThoughtLog = (existingThoughts: string[], nextThoughts: string[]) => {
  const mergedThoughts = [...existingThoughts];

  nextThoughts.forEach((thought) => {
    const normalizedThought = thought.trim();
    if (!normalizedThought) {
      return;
    }

    const lastThought = mergedThoughts[mergedThoughts.length - 1];
    if (!lastThought) {
      mergedThoughts.push(normalizedThought);
      return;
    }

    if (normalizedThought === lastThought) {
      return;
    }

    if (normalizedThought.startsWith(lastThought)) {
      mergedThoughts[mergedThoughts.length - 1] = normalizedThought;
      return;
    }

    mergedThoughts.push(normalizedThought);
  });

  return mergedThoughts;
};

const mergeStreamText = (currentText: string, chunkText: string) => {
  if (!chunkText) {
    return currentText;
  }

  if (currentText && chunkText.startsWith(currentText)) {
    return chunkText;
  }

  return currentText + chunkText;
};

const normalizeJsonResponseText = (text: string) => {
  // Structured Outputs returns pure JSON, but we handle markdown-wrapped cases gracefully
  const trimmed = text.trim();
  
  // Try to extract from markdown code blocks if present
  if (trimmed.includes('```')) {
    const extracted = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    
    const firstBrace = extracted.indexOf('{');
    const lastBrace = extracted.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return extracted.slice(firstBrace, lastBrace + 1);
    }
  }
  
  // For pure JSON or when no markdown found, extract the JSON object itself
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  
  return trimmed;
};

const TEXTISH_OBJECT_KEYS =['name', 'title', 'label', 'text', 'description', 'summary'] as const;

const coerceModelText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => coerceModelText(entry, ''))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(', ');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = TEXTISH_OBJECT_KEYS
      .map((key) => coerceModelText(record[key], '').trim())
      .filter(Boolean);

    if (parts.length > 1) {
      return `${parts[0]}: ${parts[1]}`;
    }

    if (parts.length === 1) {
      return parts[0];
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const optionalModelText = (value: unknown) => {
  const normalized = coerceModelText(value, '').trim();
  return normalized || undefined;
};

const normalizeStringList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => coerceModelText(entry, '').trim())
        .filter(Boolean)
    :[];

const normalizeMeasurements = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, rawValue]) => [key, coerceModelText(rawValue, '').trim()] as const)
    .filter(([key, normalizedValue]) => key.trim() && normalizedValue);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const normalizeEnvironmentPayload = (
  value: unknown,
  fallback: GameState['environment']
): GameState['environment'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const exits = normalizeStringList(record.exits);

  return {
    title: coerceModelText(record.title, fallback.title).trim() || fallback.title,
    description: coerceModelText(record.description, fallback.description).trim() || fallback.description,
    exits: exits.length > 0 ? exits : fallback.exits,
  };
};

const normalizeInventoryItemPayload = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const fallbackDescription = optionalModelText(record.description)
    || optionalModelText(record.descriptionMd)
    || optionalModelText(record.semanticNotes)
    || 'Unspecified item.';

  return normalizeItem(
    {
      id: optionalModelText(record.id),
      name: coerceModelText(record.name, fallbackDescription).trim() || fallbackDescription,
      emoji: optionalModelText(record.emoji),
      description: fallbackDescription,
      descriptionMd: optionalModelText(record.descriptionMd) || fallbackDescription,
      semanticNotes: optionalModelText(record.semanticNotes),
      color: optionalModelText(record.color),
      slot: typeof record.slot === 'string' ? (record.slot as Item['slot']) : undefined,
      origin: typeof record.origin === 'string' ? (record.origin as Item['origin']) : undefined,
      tags: normalizeStringList(record.tags),
      madeWith: optionalModelText(record.madeWith),
      materials: normalizeStringList(record.materials),
      affordances: normalizeStringList(record.affordances),
      measurements: normalizeMeasurements(record.measurements),
      condition: optionalModelText(record.condition),
    },
    typeof record.origin === 'string' ? (record.origin as Item['origin']) : 'crafted'
  );
};

const normalizeInventoryDeltasPayload = (value: unknown): InventoryDelta[] => {
  if (!Array.isArray(value)) {
    return[];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const playerId = coerceModelText(record.playerId, '').trim();
      if (!playerId) {
        return null;
      }

      const delta: InventoryDelta = {
        playerId,
        removeItemIds: normalizeStringList(record.removeItemIds),
        addItems: (Array.isArray(record.addItems) ? record.addItems :[])
          .map((item) => normalizeInventoryItemPayload(item))
          .filter((item): item is Item => Boolean(item)),
        summary: optionalModelText(record.summary),
      };

      return delta;
    })
    .filter((delta): delta is InventoryDelta => delta !== null);
};

const normalizeNPCDialogues = (value: unknown): NPCDialogue[] => {
  if (!Array.isArray(value)) return[];
  return value
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      return {
        name: coerceModelText(record.name, 'Unknown NPC').trim(),
        emoji: optionalModelText(record.emoji) || '👤',
        text: coerceModelText(record.text, '').trim()
      };
    })
    .filter((d): d is NPCDialogue => d !== null && d.text.length > 0);
};

interface ResolveTurnArgs {
  currentState: GameState;
  levelPackage: LevelPackage;
  globalSystemPrompt: string;
  semanticPhysicsPrompt: string;
  inventorPrompt: string;
  actions: TurnActionInput[];
  modelName: string;
  externalAbortSignal?: AbortSignal;
  onRetry?: (seconds: number, attempt: number, status: string) => void;
  onThoughtUpdate?: (thoughtLog: string[]) => void;
  onTextUpdate?: (text: string) => void;
  onLog?: (event: string, data?: any) => void;
}

export async function resolveTurn({
  currentState,
  levelPackage,
  globalSystemPrompt,
  semanticPhysicsPrompt,
  inventorPrompt,
  actions,
  modelName,
  externalAbortSignal,
  onRetry,
  onThoughtUpdate,
  onTextUpdate,
  onLog
}: ResolveTurnArgs): Promise<{ newState: GameState; narrative: string; cinematicImagePrompt: string; npcDialogues: NPCDialogue[]; debug: EngineDebugState }> {
  const levelSystemPrompt = levelPackage.prompts.systemPrompt.trim();
  const levelUserPrompt = levelPackage.prompts.userPrompt.trim();
  const runtimeSnapshot = buildRuntimeSnapshot(currentState, levelPackage);
  const actionSnapshot = buildActionSnapshot(currentState, actions);

  const systemInstruction =[
    globalSystemPrompt,
    semanticPhysicsPrompt,
    inventorPrompt,
    '# LEVEL SYSTEM PROMPT',
    levelSystemPrompt,
    '# REQUIRED OUTPUT FORMAT',
    'You MUST return ONLY a valid JSON object matching the following OpenAPI schema. Do NOT wrap it in markdown formatting blocks. Schema:',
    JSON.stringify(gameStateSchema, null, 2)
  ].join('\n\n');

  const userTurnContent =[
    '# LEVEL USER PROMPT',
    levelUserPrompt,
    '# RUNTIME SNAPSHOT',
    runtimeSnapshot,
    '# PLAYER ACTIONS THIS TURN',
    actionSnapshot,
  ].join('\n\n');

  const fullPrompt =[
    '# SYSTEM INSTRUCTION',
    systemInstruction,
    '# USER CONTENT',
    userTurnContent,
  ].join('\n\n');

  const finalizeResolvedTurn = (resultText: string) => {
    onLog?.('finalize_start', { timestamp: Date.now(), textSample: resultText.substring(0, 100) });
    
    let result;
    try {
      const normalized = normalizeJsonResponseText(resultText);
      onLog?.('normalize_complete', { normalized: normalized.substring(0, 200) });
      result = JSON.parse(normalized);
      
      // Log model output to conversation file
      conversationLogger.logModelOutput(
        currentState.sessionId,
        result.narrative || '',
        result.npcDialogues || [],
        result.cinematicImagePrompt
      );
    } catch (parseError: any) {
      onLog?.('json_parse_error', {
        error: parseError.message,
        position: parseError.message.match(/position (\d+)/)?.[1],
        responseLength: resultText.length,
        responseSample: resultText.substring(0, 500),
      });
      conversationLogger.logError(currentState.sessionId, 'JSON Parse Error', {
        error: parseError.message,
        position: parseError.message.match(/position (\d+)/)?.[1],
        responseLength: resultText.length
      });
      throw parseError;
    }
    const normalizedEnvironment = normalizeEnvironmentPayload(result.environment, currentState.environment);
    const normalizedInventoryDeltas = normalizeInventoryDeltasPayload(result.inventoryDeltas);
    const npcDialogues = normalizeNPCDialogues(result.npcDialogues);

    const nextDiscoveredNPCs = { ...currentState.discoveredNPCs };
    if (Array.isArray(result.discoveredNPCs)) {
      result.discoveredNPCs.forEach((npc: any) => {
        if (npc.name) {
          nextDiscoveredNPCs[npc.name] = `Name: ${npc.name}\nRole: ${npc.role || 'Unknown'}\nAppearance: ${npc.appearance || 'Unknown'}\nPersonality: ${npc.personality || 'Neutral'}\nIcon: ${npc.icon || '👤'}`;
        }
      });
    }

    const newState: GameState = {
      ...currentState,
      environment: normalizedEnvironment,
      turnNumber: currentState.turnNumber + 1,
      isResolving: false,
      levelComplete: result.levelComplete === true ? true : currentState.levelComplete,
      discoveredNPCs: nextDiscoveredNPCs,
      gameTime: result.gameTime || currentState.gameTime || '10:00 AM',
      debug: null,
    };

    const inventoryDeltas = applyInventoryDeltas(newState, normalizedInventoryDeltas);
    const canonDelta = applyCanonDelta(newState, normalizeCanonDelta(result.canonDelta as CanonDelta | undefined));
    const visualCanonDelta = applyVisualCanonDelta(newState, normalizeCanonDelta(result.visualCanonDeltas as CanonDelta | undefined));

    Object.values(newState.players).forEach((player) => {
      player.lastAction = undefined;
    });

    const debug: EngineDebugState = {
      globalRules: globalSystemPrompt,
      levelSystemPrompt,
      levelUserPrompt,
      runtimeSnapshot: `${runtimeSnapshot}\n\nPLAYER ACTIONS:\n${actionSnapshot}`,
      sessionCanon: [...newState.sessionCanon],
      visualCanon:[...newState.visualCanon],
      fullPrompt,
      rawResponse: resultText,
      inventoryDeltas,
      canonDelta,
      visualCanonDelta,
      cinematicImagePrompt: result.cinematicImagePrompt || '',
      actions: actions.map((entry) => ({
        playerId: entry.playerId,
        playerName: entry.playerName || currentState.players[entry.playerId]?.name || entry.playerId,
        action: entry.action,
        hasSketch: Boolean(entry.sketch),
      })),
    };

    onLog?.('finalize_complete', { timestamp: Date.now() });
    return {
      newState,
      narrative: coerceModelText(result.narrative, 'SYSTEM ERROR: Model returned an invalid narrative payload.'),
      npcDialogues,
      cinematicImagePrompt: result.cinematicImagePrompt || '',
      debug,
    };
  };

  const generateStreamedResult = (): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      onLog?.('stream_init', {
        modelName,
        timeoutMs: MODEL_STREAM_TOTAL_TIMEOUT_MS,
        idleTimeoutMs: MODEL_STREAM_IDLE_TIMEOUT_MS,
        systemInstructionLength: systemInstruction.length,
        userTurnContentLength: userTurnContent.length
      });

      const abortController = new AbortController();
      let timedOutBy: 'idle' | 'total' | 'manual' | null = null;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      
      const handleAbort = (reason: 'idle' | 'total' | 'manual') => {
        if (timedOutBy) return;
        timedOutBy = reason;
        onLog?.(`abort_${reason}_fired`, { timestamp: Date.now() });
        abortController.abort();
        reject(new Error(`MODEL_STREAM_${reason.toUpperCase()}_ABORT`));
      };

      const totalTimer = setTimeout(() => handleAbort('total'), MODEL_STREAM_TOTAL_TIMEOUT_MS);

      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => handleAbort('idle'), MODEL_STREAM_IDLE_TIMEOUT_MS);
      };

      const onExternalAbort = () => handleAbort('manual');
      if (externalAbortSignal) {
        externalAbortSignal.addEventListener('abort', onExternalAbort);
      }

      const cleanup = () => {
        clearTimeout(totalTimer);
        if (idleTimer) clearTimeout(idleTimer);
        if (externalAbortSignal) externalAbortSignal.removeEventListener('abort', onExternalAbort);
      };

      let resultText = '';
      let streamedThoughts: string[] =[];
      let chunkIndex = 0;

      resetIdleTimer();

      try {
        onLog?.('api_call_init', {
          model: modelName,
          method: 'generateContentStream',
          systemInstructionLength: systemInstruction.length,
          userContentLength: userTurnContent.length,
          userPartsCount: buildUserTurnParts(userTurnContent, actions).length,
        });

        const response = await ai.models.generateContentStream({
          model: modelName,
          contents: buildUserTurnParts(userTurnContent, actions),
          config: buildGenerationConfig({
            includeThoughts: true,
            abortSignal: abortController.signal,
            systemInstruction,
          }),
        });

        onLog?.('api_call_success', { model: modelName, method: 'generateContentStream' });

        onLog?.('stream_connected', { timestamp: Date.now() });

        for await (const chunk of response) {
          if (timedOutBy) break; // Exit if already aborted
          chunkIndex++;
          resetIdleTimer();

          let chunkText = '';
          let thoughtParts: string[] =[];

          try {
            // Safely extract ONLY text parts, ignoring thoughts for the final JSON result
            const textParts = chunk.candidates?.[0]?.content?.parts
              ?.filter((part) => !part.thought && typeof part.text === 'string')
              .map((part) => part.text) || [];
            chunkText = textParts.join('');

            thoughtParts = chunk.candidates?.[0]?.content?.parts
              ?.filter((part) => part.thought && typeof part.text === 'string' && part.text.trim().length > 0)
              .map((part) => part.text!.trim()) ||[];

            onLog?.('stream_chunk', {
              chunkIndex,
              timestamp: Date.now(),
              textLength: chunkText.length,
              thoughtLength: thoughtParts.join('').length,
              finishReason: chunk.candidates?.[0]?.finishReason,
              rawParts: chunk.candidates?.[0]?.content?.parts?.map(p => ({ type: p.thought ? 'thought' : 'text', len: p.text?.length }))
            });
          } catch (err: any) {
            onLog?.('stream_chunk_parse_error', { chunkIndex, error: err.message });
          }

          if (chunkText) {
            resultText = mergeStreamText(resultText, chunkText);
            onTextUpdate?.(resultText);
          }

          if (thoughtParts.length > 0) {
            const mergedThoughts = mergeThoughtLog(streamedThoughts, thoughtParts);
            const changed = mergedThoughts.length !== streamedThoughts.length || mergedThoughts.some((thought, index) => thought !== streamedThoughts[index]);

            if (changed) {
              streamedThoughts = mergedThoughts;
              onThoughtUpdate?.([...streamedThoughts]);
            }
          }
        }
        
        cleanup();
        if (timedOutBy) return;

        if (!resultText) {
          onLog?.('stream_empty_result', { timestamp: Date.now() });
          reject(new Error('No response from model'));
        } else {
          onLog?.('stream_complete', { timestamp: Date.now(), totalChunks: chunkIndex, finalLength: resultText.length });
          resolve(resultText);
        }
      } catch (error: any) {
        cleanup();
        if (timedOutBy) return;
        
        onLog?.('stream_error', { timestamp: Date.now(), error: error.message, stack: error.stack, chunkIndex });
        reject(error);
      }
    });
  };

  const generateFallbackResult = (): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      onLog?.('fallback_init', { timestamp: Date.now() });
      
      const abortController = new AbortController();
      let timedOutBy: 'total' | 'manual' | null = null;
      
      const handleAbort = (reason: 'total' | 'manual') => {
        if (timedOutBy) return;
        timedOutBy = reason;
        onLog?.(`fallback_abort_${reason}_fired`, { timestamp: Date.now() });
        abortController.abort();
        reject(new Error(`MODEL_FALLBACK_${reason.toUpperCase()}_ABORT`));
      };

      const timeout = setTimeout(() => handleAbort('total'), MODEL_FALLBACK_TIMEOUT_MS);

      const onExternalAbort = () => handleAbort('manual');
      if (externalAbortSignal) {
        externalAbortSignal.addEventListener('abort', onExternalAbort);
      }

      const cleanup = () => {
        clearTimeout(timeout);
        if (externalAbortSignal) externalAbortSignal.removeEventListener('abort', onExternalAbort);
      };

      try {
        onLog?.('api_call_init', {
          model: modelName,
          method: 'generateContent',
          systemInstructionLength: systemInstruction.length,
          userContentLength: userTurnContent.length,
          userPartsCount: buildUserTurnParts(userTurnContent, actions).length,
          includeThoughts: false,
        });

        const response = await ai.models.generateContent({
          model: modelName,
          contents: buildUserTurnParts(userTurnContent, actions),
          config: buildGenerationConfig({
            includeThoughts: false,
            abortSignal: abortController.signal,
            systemInstruction,
          }),
        });
        
        onLog?.('api_call_success', { model: modelName, method: 'generateContent' });
        
        cleanup();
        if (timedOutBy) return;

        onLog?.('fallback_complete', { timestamp: Date.now() });
        
        const textParts = response.candidates?.[0]?.content?.parts
          ?.filter((part) => !part.thought && typeof part.text === 'string')
          .map((part) => part.text) ||[];
        const resultText = textParts.length > 0 ? textParts.join('') : response.text;

        if (!resultText) {
          reject(new Error('No response from model'));
        } else {
          onTextUpdate?.(resultText);
          resolve(resultText);
        }
      } catch (error: any) {
        cleanup();
        if (timedOutBy) return;
        
        onLog?.('fallback_error', { timestamp: Date.now(), error: error.message });
        reject(error);
      }
    });
  };

  let attempt = 0;
  let transientRetryCount = 0;
  let useStreaming = true;

  while (true) {
    try {
      const resultText = useStreaming ? await generateStreamedResult() : await generateFallbackResult();
      return finalizeResolvedTurn(resultText);
    } catch (error: any) {
      let resolvedError = error;
      const isManualRetry = error.message === 'MODEL_STREAM_MANUAL_ABORT' || error.message === 'MODEL_FALLBACK_MANUAL_ABORT';
      const isStreamTimeout = error.message === 'MODEL_STREAM_IDLE_ABORT' || error.message === 'MODEL_STREAM_TOTAL_ABORT';

      onLog?.('error_caught', {
        attempt: attempt + 1,
        isManualRetry,
        isStreamTimeout,
        errorMessage: error.message,
        errorName: error.name,
        useStreaming,
      });

      if (isManualRetry) {
        onLog?.('manual_retry_requested', { reason: error.message, attempt: attempt + 1, useStreaming });
        throw new Error('MANUAL_RETRY_REQUESTED');
      }

      if (isStreamTimeout && useStreaming) {
        useStreaming = false;
        attempt += 1;
        onLog?.('retry_triggered', { attempt, type: 'stream_fallback', reason: error.message });
        onRetry?.(1, attempt, 'TIMEOUT');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const isRetryable = isRetriableModelError(error);

      onLog?.('error_classification', {
        isRetryable,
        errorStatus: error?.status || error?.response?.status,
        errorMessage: error.message,
      });

      if (isRetryable) {
        let status = error?.status || error?.response?.status;
        if (!status && typeof error.message === 'string') {
          const match = error.message.match(/\b(503|500|429)\b/);
          if (match) status = match[1];
        }
        const statusStr = status ? String(status) : 'Unknown';
        
        transientRetryCount += 1;
        attempt += 1;
        const backoffSeconds = Math.min(Math.pow(2, transientRetryCount), 10);
        onLog?.('retry_triggered', { attempt, type: 'transient_backoff', backoffSeconds, statusStr, transientRetryCount });
        onRetry?.(backoffSeconds, attempt, statusStr);
        await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
        continue;
      }

      const errorMessage = `SYSTEM ERROR: ${resolvedError.message}`;
      const emptyCanonDelta = normalizeCanonDelta(undefined);
      
      onLog?.('fatal_error_handled', { 
        timestamp: Date.now(), 
        errorMessage,
        totalAttempts: attempt + 1,
        useStreaming,
      });

      return {
        newState: {
          ...currentState,
          isResolving: false,
          debug: null,
        },
        narrative: errorMessage,
        npcDialogues:[],
        cinematicImagePrompt: '',
        debug: {
          globalRules: globalSystemPrompt,
          levelSystemPrompt,
          levelUserPrompt,
          runtimeSnapshot: `${runtimeSnapshot}\n\nPLAYER ACTIONS:\n${actionSnapshot}`,
          sessionCanon: [...currentState.sessionCanon],
          visualCanon:[...currentState.visualCanon],
          fullPrompt,
          rawResponse: errorMessage,
          inventoryDeltas:[],
          canonDelta: emptyCanonDelta,
          visualCanonDelta: emptyCanonDelta,
          cinematicImagePrompt: '',
          actions: actions.map((entry) => ({
            playerId: entry.playerId,
            playerName: currentState.players[entry.playerId]?.name || entry.playerId,
            action: entry.action,
          })),
        },
      };
    }
  }
}