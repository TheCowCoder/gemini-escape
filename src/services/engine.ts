import { GoogleGenAI, Type } from '@google/genai';
import type { GameState, Player } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

if (!process.env.GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is not set in the environment.");
} else {
  console.log("GEMINI_API_KEY is present (length: " + process.env.GEMINI_API_KEY.length + ")");
}

const gameStateSchema = {
  type: Type.OBJECT,
  properties: {
    narrative: { 
      type: Type.STRING, 
      description: "A rich, atmospheric narrative describing the outcome of the players' actions. Be descriptive and engaging. Describe the environment and how the players interact with it." 
    },
    environment: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Name of the current location" },
        description: { type: Type.STRING, description: "Visual description of the location" },
        exits: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "List of obvious exits or paths (e.g., 'North towards the mountains', 'Down the cliff face')"
        }
      }
    },
    players: {
      type: Type.ARRAY,
      description: "The updated state of all players after resolving their actions.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "The player's ID (must match input)" },
          inventory: {
            type: Type.ARRAY,
            description: "The player's current inventory. Add or remove items based on their actions and crafting.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                color: { type: Type.STRING, description: "A valid CSS color (hex or name) representing the item visually" },
                slot: { type: Type.STRING, description: "One of: 'head', 'body', 'hands', 'feet', 'none'" }
              }
            }
          }
        }
      }
    }
  },
  required: ["narrative", "environment", "players"]
};

export async function resolveTurn(currentState: GameState, actions: {playerId: string, action: string}[]): Promise<{ newState: GameState, narrative: string }> {
  const prompt = `
You are the Game Engine for a multiplayer text-based RPG called "Gemini Escape: The Chasm".
You are responsible for resolving player actions, updating their inventories (crafting, finding items), and describing the world.

CURRENT ENVIRONMENT:
Title: ${currentState.environment.title}
Description: ${currentState.environment.description}
Exits: ${currentState.environment.exits.join(', ')}

CURRENT PLAYERS:
${Object.values(currentState.players).map(p => `- ${p.name} (ID: ${p.id}): Inventory: ${p.inventory.map(i => i.name).join(', ') || 'Empty'}`).join('\n')}

PLAYER ACTIONS THIS TURN:
${actions.map(a => `- ${currentState.players[a.playerId]?.name || a.playerId}: ${a.action}`).join('\n')}

INSTRUCTIONS:
1. Resolve all actions simultaneously. If players cooperate, reward them. If they try to do impossible things, they fail narratively.
2. Update the environment if they move to a new area. If they stay, keep the environment similar but update the description based on their actions.
3. Manage inventories strictly. If they craft something (e.g., "I tie the vines to the stick"), remove the ingredients and add the new item (e.g., "Vine Whip").
4. Provide a rich narrative of what happened.
5. Return the exact updated state in JSON format.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: gameStateSchema,
        temperature: 0.7,
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from model");
    
    const result = JSON.parse(resultText);
    
    // Merge the result back into our GameState structure
    const newState: GameState = {
      ...currentState,
      environment: result.environment,
      turnNumber: currentState.turnNumber + 1,
      isResolving: false,
    };

    // Update player inventories while preserving other player data (like equipped items, color, name)
    result.players.forEach((updatedPlayer: any) => {
      if (newState.players[updatedPlayer.id]) {
        newState.players[updatedPlayer.id].inventory = updatedPlayer.inventory;
        newState.players[updatedPlayer.id].isLockedIn = false;
        newState.players[updatedPlayer.id].lastAction = undefined;
      }
    });

    return { newState, narrative: result.narrative };

  } catch (error: any) {
    console.error("Error resolving turn:", error);
    
    const keyLength = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined';
    let errorMessage = `SYSTEM ERROR: ${error.message} (Key length: ${keyLength})`;

    return {
      newState: { ...currentState, isResolving: false },
      narrative: errorMessage
    };
  }
}
