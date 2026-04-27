import type { Item, ItemOrigin, SpawnMenuItem } from '../types';

const DEFAULT_COLOR = '#6b7280';
const DEFAULT_EMOJI = '🧰';

const EMOJI_HINTS: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /rope|string|cord|vine/i, emoji: '🪢' },
  { pattern: /ladder/i, emoji: '🪜' },
  { pattern: /knife|blade/i, emoji: '🔪' },
  { pattern: /bow/i, emoji: '🏹' },
  { pattern: /arrow/i, emoji: '🗡️' },
  { pattern: /stone|rock|boulder/i, emoji: '🪨' },
  { pattern: /pipe/i, emoji: '🔩' },
  { pattern: /tank|barrel/i, emoji: '🛢️' },
  { pattern: /shark/i, emoji: '🦈' },
  { pattern: /tunic|shirt|coat/i, emoji: '🧥' },
  { pattern: /sandals|boots|shoes/i, emoji: '🥾' },
  { pattern: /stick|branch|wood/i, emoji: '🪵' },
  { pattern: /magnet/i, emoji: '🧲' },
  { pattern: /tarpaulin|cloth|canvas/i, emoji: '🏕️' },
  { pattern: /radioactive|uranium/i, emoji: '☢️' },
  { pattern: /hook/i, emoji: '🪝' },
  { pattern: /pulley/i, emoji: '⚙️' },
  { pattern: /lantern|lamp/i, emoji: '🏮' },
];

const stripMarkdown = (value: string) => value.replace(/[*_`>#-]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').trim();

const inferEmoji = (name: string, description: string) => {
  const haystack = `${name} ${description}`;
  return EMOJI_HINTS.find(({ pattern }) => pattern.test(haystack))?.emoji || DEFAULT_EMOJI;
};

export const makeItemId = (name: string) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

  return `${slug}-${Math.random().toString(36).slice(2, 8)}`;
};

export const normalizeItem = (
  item: Partial<Item> & Pick<Item, 'name'>,
  defaultOrigin: ItemOrigin = 'crafted'
): Item => {
  const descriptionMd = item.descriptionMd || item.description || item.semanticNotes || `${item.name}.`;
  const description = item.description || stripMarkdown(descriptionMd);

  return {
    id: item.id || makeItemId(item.name),
    name: item.name,
    emoji: item.emoji || inferEmoji(item.name, descriptionMd),
    description,
    descriptionMd,
    semanticNotes: item.semanticNotes || description,
    color: item.color || DEFAULT_COLOR,
    slot: item.slot || 'none',
    origin: item.origin || defaultOrigin,
    tags: item.tags || [],
    madeWith: item.madeWith,
    materials: item.materials,
    affordances: item.affordances,
    measurements: item.measurements,
    condition: item.condition,
    maxSlots: item.maxSlots,
    toggles: item.toggles,
    contents: item.contents ? item.contents.map(i => normalizeItem(i as any, defaultOrigin)) : undefined,
  };
};

export const createStarterItem = (item: Partial<Item> & Pick<Item, 'name'>) => normalizeItem(item, 'starter');

export const spawnMenuItemToCard = (blueprint: SpawnMenuItem): Item =>
  normalizeItem(
    {
      id: makeItemId(blueprint.name),
      name: blueprint.name,
      emoji: blueprint.emoji,
      description: blueprint.description,
      descriptionMd: blueprint.descriptionMd,
      semanticNotes: blueprint.semanticNotes,
      color: blueprint.color,
      slot: blueprint.slot,
      origin: 'spawned',
      tags: blueprint.tags,
      madeWith: blueprint.madeWith,
      materials: blueprint.materials,
      affordances: blueprint.affordances,
      measurements: blueprint.measurements,
      condition: blueprint.condition,
    },
    'spawned'
  );

export const normalizeInventory = (inventory: Item[]) => inventory.map((item) => normalizeItem(item, item.origin));