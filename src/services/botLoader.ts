import { promises as fs } from 'node:fs';
import path from 'node:path';

const BOT_PROMPT_CANDIDATES = [
  path.join(process.cwd(), 'prompts', 'bot-prompt.md'),
  path.join(process.cwd(), 'dist', 'prompts', 'bot-prompt.md'),
];

export const loadBotPrompt = async () => {
  for (const candidate of BOT_PROMPT_CANDIDATES) {
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('Could not find prompts/bot-prompt.md.');
};