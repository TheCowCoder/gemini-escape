import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch {
  // .env file might not exist in all environments.
}

import { GoogleGenAI, Type } from '@google/genai';
import type { LevelPackage } from '../../types';
import type { ChatMessage, GameState } from '../types';
import { loadBotPrompt } from './botLoader';

const useVertex = process.env.VERTEX === 'true';
const ai = useVertex
  ? new GoogleGenAI({ vertexai: true, apiKey: process.env.VERTEX_API_KEY || '' })
  : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });


const botActionSchema = {
  type: Type.OBJECT,
  properties: {
    thinking: {
      type: Type.STRING,
      description: 'A brief private thought that sounds like a human planning their next move.',
    },
    action: {
      type: Type.STRING,
      description: 'The exact action text to submit for this turn.',
    },
  },
  required: ['thinking', 'action'],
};

const stripCodeFences = (text: string) =>
  text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

const describeRecentHistory = (chatHistory: ChatMessage[]) =>
  chatHistory
    .filter((message) => message.type === 'prompt' || message.type === 'narrative' || message.type === 'system')
    .slice(-8)
    .map((message) => {
      if (message.type === 'prompt') {
        const actionText = message.actionEntries?.length
          ? message.actionEntries.map((entry) => `${entry.playerName}: ${entry.text}`).join(' | ')
          : message.text;
        return `ACTION: ${actionText}`;
      }

      if (message.type === 'narrative') {
        return `NARRATIVE: ${message.text}`;
      }

      return `SYSTEM: ${message.text}`;
    })
    .join('\n');

const describeInventory = (currentState: GameState, playerId: string) => {
  const player = currentState.players[playerId];
  if (!player || player.inventory.length === 0) {
    return 'Empty.';
  }

  return player.inventory
    .map((item) => {
      const measurements = item.measurements
        ? Object.entries(item.measurements)
            .map(([key, value]) => `${key}=${value}`)
            .join(', ')
        : '';

      return `${item.name}${measurements ? ` (${measurements})` : ''}: ${item.descriptionMd || item.description}`;
    })
    .join('\n');
};

type DecideBotActionArgs = {
  currentState: GameState;
  levelPackage: LevelPackage;
  chatHistory: ChatMessage[];
  playerId: string;
  modelName: string;
};

export const decideBotAction = async ({
  currentState,
  levelPackage,
  chatHistory,
  playerId,
  modelName,
}: DecideBotActionArgs) => {
  const player = currentState.players[playerId];
  if (!player) {
    throw new Error('Bot player not found.');
  }

  const botPrompt = await loadBotPrompt();
  const sessionCanon = currentState.sessionCanon.length > 0
    ? currentState.sessionCanon.map((fact) => `- ${fact}`).join('\n')
    : '- No additional canon established yet.';
  const recentHistory = describeRecentHistory(chatHistory) || 'No turns have resolved yet.';

  const systemInstruction = botPrompt.trim();

  const userContent = [
    `PLAYER NAME: ${player.name}`,
    `LEVEL TITLE: ${currentState.levelTitle}`,
    `LEVEL GOAL: ${currentState.levelGoal}`,
    `LEVEL STARTING TEXT: ${currentState.levelStartingText}`,
    `LEVEL DESCRIPTION: ${levelPackage.data.levelDescription}`,
    `CURRENT LOCATION: ${currentState.environment.title}`,
    `CURRENT SCENE: ${currentState.environment.description}`,
    `VISIBLE EXITS OR LEADS: ${currentState.environment.exits.join(', ') || 'None listed.'}`,
    `SESSION CANON:\n${sessionCanon}`,
    `INVENTORY:\n${describeInventory(currentState, playerId)}`,
    `RECENT HISTORY:\n${recentHistory}`,
    'Return JSON with keys "thinking" and "action".',
  ].join('\n\n');

  const response = await ai.models.generateContent({
    model: modelName,
    contents: userContent,
    config: {
      systemInstruction,
      temperature: 0.9,
      responseMimeType: 'application/json',
      responseSchema: botActionSchema,
      maxOutputTokens: 300,
    },
  });

  const rawText = stripCodeFences(response.text || '');
  if (!rawText) {
    throw new Error('Bot model returned an empty response.');
  }

  const result = JSON.parse(rawText) as { thinking?: string; action?: string };
  const thinking = (result.thinking || '').trim();
  const action = (result.action || '').trim();

  if (!action) {
    throw new Error('Bot model returned an empty action.');
  }

  return {
    thinking: thinking || 'I should try the most tangible next step instead of overcommitting.',
    action,
    rawResponse: rawText,
  };
};