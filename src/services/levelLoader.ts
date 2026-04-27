import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { EditorDraft, LevelPackage, LevelSummary, LevelData } from '../../types';

export const FREEPLAY_LEVEL_ID = 'freeplay-forest';

let cachedLevelsRoot: string | null = null;
let cachedPromptsRoot: string | null = null;

const directoryExists = async (dirPath: string) => {
  try {
    return (await fs.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
};

const resolveLevelsRoot = async () => {
  if (cachedLevelsRoot) {
    return cachedLevelsRoot;
  }

  const candidates = [
    path.join(process.cwd(), 'levels'),
    path.join(process.cwd(), 'dist', 'levels'),
  ];

  for (const candidate of candidates) {
    if (await directoryExists(candidate)) {
      cachedLevelsRoot = candidate;
      return candidate;
    }
  }

  throw new Error('Could not find levels directory.');
};

const resolvePromptsRoot = async () => {
  if (cachedPromptsRoot) {
    return cachedPromptsRoot;
  }

  const candidates = [
    path.join(process.cwd(), 'prompts'),
    path.join(process.cwd(), 'dist', 'prompts'),
  ];

  for (const candidate of candidates) {
    if (await directoryExists(candidate)) {
      cachedPromptsRoot = candidate;
      return candidate;
    }
  }

  throw new Error('Could not find prompts directory.');
};

const readText = (filePath: string) => fs.readFile(filePath, 'utf8');

const readJson = async <T>(filePath: string) => JSON.parse(await fs.readFile(filePath, 'utf8')) as T;

const buildFallbackNpcPrompt = (npcName: string) => `# ${npcName}

Name: ${npcName}
Role: Unknown
Appearance: Unknown
Mental State: Neutral until discovered.
Physical State: Present in the world when appropriate.
Response style: Concise, grounded, and in-character.
Icon: 👤`;

export const loadGlobalSystemPrompt = async () => {
  const promptsRoot = await resolvePromptsRoot();
  return readText(path.join(promptsRoot, 'global-system.md'));
};

export const loadSemanticPhysicsPrompt = async () => {
  const promptsRoot = await resolvePromptsRoot();
  return readText(path.join(promptsRoot, 'semantic-physics.md'));
};

export const loadStarterCinematicPrompt = async () => {
  const promptsRoot = await resolvePromptsRoot();
  return readText(path.join(promptsRoot, 'starter-cinematic.md'));
};

export const loadInventorPrompt = async () => {
  const promptsRoot = await resolvePromptsRoot();
  return readText(path.join(promptsRoot, 'inventor-prompt.md'));
};

export const loadLevelPackage = async (levelId: string): Promise<LevelPackage> => {
  const levelsRoot = await resolveLevelsRoot();
  const levelDir = path.join(levelsRoot, levelId);

  const data = await readJson<LevelData>(path.join(levelDir, 'level.json'));
  
  const levelDescription = await readText(path.join(levelDir, data.levelDescription));
  
  // Load startingText from markdown file if specified
  let startingText = data.startingText;
  if (typeof startingText === 'string' && startingText.endsWith('.md')) {
    startingText = await readText(path.join(levelDir, startingText));
  }
  
  const npcPrompts: Record<string, string> = {};
  if (data.npcDefinitions) {
    for (const [npcName, fileName] of Object.entries(data.npcDefinitions)) {
      const npcPromptPath = path.join(levelDir, fileName as string);
      try {
        npcPrompts[npcName] = await readText(npcPromptPath);
      } catch (error) {
        console.warn(`[LEVEL LOADER] Missing NPC prompt for ${npcName} at ${npcPromptPath}. Using fallback.`);
        npcPrompts[npcName] = buildFallbackNpcPrompt(npcName);
      }
    }
  }

  return {
    data: {
      ...data,
      startingText,
      startingImageUrl: `/levels/${levelId}/starting_image.png`
    },
    prompts: {
      systemPrompt: await readText(path.join(levelDir, 'system-prompt.md')),
      userPrompt: await readText(path.join(levelDir, 'user-prompt.md')),
      npcPrompts,
      levelDescription,
    },
  };
};

export const listLevelSummaries = async (): Promise<LevelSummary[]> => {
  const levelsRoot = await resolveLevelsRoot();
  const entries = await fs.readdir(levelsRoot, { withFileTypes: true });
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name !== FREEPLAY_LEVEL_ID)
      .map(async (entry) => {
        const levelPackage = await loadLevelPackage(entry.name);
        return {
          id: levelPackage.data.id,
          title: levelPackage.data.title,
          startingText: levelPackage.data.startingText,
          levelDescription: levelPackage.prompts.levelDescription,
          levelGoal: levelPackage.data.levelGoal,
          startingImageUrl: levelPackage.data.startingImageUrl
        } satisfies LevelSummary;
      })
  );

  return summaries.sort((left, right) => left.title.localeCompare(right.title));
};

export const levelPackageToEditorDraft = (levelPackage: LevelPackage): EditorDraft => ({
  id: levelPackage.data.id,
  title: levelPackage.data.title,
  startingText: levelPackage.data.startingText,
  levelDescription: levelPackage.prompts.levelDescription,
  levelGoal: levelPackage.data.levelGoal,
  startingInventory: levelPackage.data.startingInventory,
  systemPrompt: levelPackage.prompts.systemPrompt,
  userPrompt: levelPackage.prompts.userPrompt,
});

export const editorDraftToLevelPackage = (draft: EditorDraft): LevelPackage => ({
  data: {
    id: draft.id,
    title: draft.title,
    startingText: draft.startingText,
    levelDescription: 'levelDescription.md',
    levelGoal: draft.levelGoal,
    startingInventory: draft.startingInventory,
    startingImageUrl: `/levels/${draft.id}/starting_image.png`
  },
  prompts: {
    systemPrompt: draft.systemPrompt,
    userPrompt: draft.userPrompt,
    levelDescription: draft.levelDescription,
  },
});