import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useGame } from '../../hooks/useGame';
import { useSocket } from '../../hooks/useSocket';
import { Backpack, ChevronDown, Search, Sparkles, X, Trash2, Users, Scissors, Zap, Download, Settings } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { Item } from '../../types';

type InventoryCard = Item & {
  contents?: InventoryCard[];
};

type InventoryViewMode = 'cards' | 'list';

const DraggableItem: React.FC<{ item: InventoryCard; children: React.ReactNode }> = ({ item, children }) => {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: item.id,
    data: { item },
  });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
};

const Droppable: React.FC<{ id: string; children: React.ReactNode; isContainer: boolean }> = ({ id, children, isContainer }) => {
  const {isOver, setNodeRef} = useDroppable({
    id,
  });
  
  const style = {
    transition: 'border-color 0.2s, box-shadow 0.2s',
    borderColor: isOver ? (isContainer ? '#2563eb' : '#9ca3af') : undefined,
    boxShadow: isOver ? (isContainer ? '0 0 0 3px rgba(37, 99, 235, 0.3)' : '0 0 0 3px rgba(156, 163, 175, 0.3)') : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full w-full">
      {children}
    </div>
  );
};

const originTone: Record<string, string> = {
  starter: 'bg-slate-800 text-slate-300 border-slate-700',
  found: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/40',
  spawned: 'bg-fuchsia-900/40 text-fuchsia-200 border-fuchsia-700/40',
  crafted: 'bg-amber-900/40 text-amber-200 border-amber-700/40',
  salvaged: 'bg-cyan-900/40 text-cyan-200 border-cyan-700/40',
};

const itemMarkdownComponents = {
  p: ({ children }: any) => <p className="m-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-gray-100">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-gray-300">{children}</em>,
  ul: ({ children }: any) => <ul className="my-1 list-disc space-y-1 pl-4">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-1 list-decimal space-y-1 pl-4">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  code: ({ children }: any) => <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10px] text-cyan-100">{children}</code>,
};

export const Inventory: React.FC = () => {
  const { gameState, myId } = useGame();
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(true);
  const [isSpawnerOpen, setIsSpawnerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [containerPath, setContainerPath] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<InventoryViewMode>('cards');

  if (!gameState || !myId) return null;

  const me = gameState.players[myId];
  if (!me) return null;

  const others = Object.values(gameState.players).filter(p => p.id !== myId);

  let currentLevel = me.inventory as InventoryCard[];
  const resolvedPath: InventoryCard[] = [];
  
  for (const id of containerPath) {
    const container = currentLevel.find((item) => item.id === id);
    if (container) {
      resolvedPath.push(container);
      currentLevel = container.contents || [];
    } else {
      break;
    }
  }

  React.useEffect(() => {
    if (resolvedPath.length !== containerPath.length) {
      setContainerPath(resolvedPath.map((container) => container.id));
    }
  }, [resolvedPath.length, containerPath.length]);

  const currentContainer = resolvedPath.length > 0 ? resolvedPath[resolvedPath.length - 1] : null;
  const currentItems = currentLevel;

  const handleEquip = (itemId: string, slot: string) => {
    if (socket) {
      socket.emit('equip', itemId, slot);
    }
  };

  const handleSpawn = (blueprintId: string) => {
    if (!socket || gameState.isResolving) return;
    socket.emit('spawnItem', blueprintId);
  };

  const canSpawn = gameState.spawnMenu.length > 0;

  const filteredSpawnMenu = gameState.spawnMenu.filter((item) => {
    const haystack = `${item.name} ${item.descriptionMd} ${item.tags?.join(' ') || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const findParentContainerId = (itemId: string) => {
    const findParent = (items: InventoryCard[]): string | null => {
      for (const item of items) {
        if (item.contents?.some((content: InventoryCard) => content.id === itemId)) {
          return item.id;
        }

        if (item.contents?.length) {
          const nestedParent = findParent(item.contents);
          if (nestedParent) {
            return nestedParent;
          }
        }
      }

      return null;
    };

    return findParent(me.inventory as InventoryCard[]);
  };

  const isContainerItem = (item: InventoryCard) => item.tags?.includes('container') || item.tags?.includes('assembly');

  const renderItemActions = (item: InventoryCard, isAssembly: boolean, stackCount: number) => (
    <div className="flex flex-wrap gap-2 pt-1">
      {isContainerItem(item) && item.contents && item.contents.length > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); socket?.emit('takeAllFromContainer', item.id); }}
          className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
          title={isAssembly ? 'Dismantle All' : 'Take All'}
        >
          <Download size={12} />
        </button>
      )}
      {others.length > 0 && (
        <div className="relative group">
          <button 
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
            title="Give to Player"
          >
            <Users size={12} />
          </button>
          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-white border border-black/5 shadow-lg rounded-xl p-1 z-50 min-w-[100px]">
            {others.map((player) => (
              <button
                key={player.id}
                onClick={(e) => { e.stopPropagation(); socket?.emit('giveItem', item.id, player.id); }}
                className="w-full text-left px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 hover:bg-zinc-50 rounded-lg whitespace-nowrap"
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {stackCount > 1 && (
        <button 
          onClick={(e) => { e.stopPropagation(); socket?.emit('splitStack', item.id, Math.floor(stackCount / 2)); }}
          className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
          title="Split Stack"
        >
          <Scissors size={12} />
        </button>
      )}
      {item.toggles && Object.entries(item.toggles).map(([key, value]) => (
        <button 
          key={key}
          onClick={(e) => { e.stopPropagation(); socket?.emit('toggleItemState', item.id, key); }}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${value ? 'bg-teal-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
        >
          <Zap size={10} className={value ? 'fill-current' : ''} />
          {key}
        </button>
      ))}
    </div>
  );

  const renderContainedItems = (item: InventoryCard, isAssembly: boolean) => {
    if (!isContainerItem(item) || !item.contents || item.contents.length === 0) {
      return null;
    }

    return (
      <div className="mt-2 pt-2 border-t border-black/5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
          {isAssembly ? 'Components' : 'Contents'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.contents.map((content) => (
            <span key={content.id} className="flex h-6 w-6 items-center justify-center rounded-md bg-black/5 text-sm shadow-inner" title={content.name}>
              {content.emoji}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderItemBody = (item: InventoryCard, isEquipped: boolean) => {
    const isAssembly = item.tags?.includes('assembly');
    const stackCount = getStackCount(item.measurements?.count);
    const originClasses = originTone[item.origin] || 'bg-zinc-100 text-zinc-600 border-zinc-200';

    if (viewMode === 'list') {
      return (
        <div className={`relative rounded-2xl border px-3 py-3 transition-colors shadow-sm ${isEquipped ? 'bg-teal-600/10 border-teal-500 text-teal-900 ring-1 ring-teal-500/20' : 'bg-white/90 border-black/5 text-zinc-800 hover:border-zinc-300'}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-black/5 text-2xl shadow-inner">
              {item.emoji}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900">{item.name}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.25em] ${originClasses}`}>
                  {item.origin}
                </span>
                {item.slot !== 'none' && (
                  <span className="rounded-full border border-teal-600/20 bg-teal-600/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-teal-800">
                    {item.slot}
                  </span>
                )}
                {stackCount > 1 && (
                  <span className="rounded-full border border-amber-600/30 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-900">
                    x{stackCount}
                  </span>
                )}
              </div>
              <div className="space-y-1 text-[11px] leading-relaxed text-zinc-600">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={itemMarkdownComponents}
                >
                  {item.descriptionMd || item.description || ''}
                </ReactMarkdown>
              </div>
              {item.semanticNotes && (
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600/80">{item.semanticNotes}</div>
              )}
              {item.madeWith && (
                <div className="text-[11px] leading-relaxed text-amber-700/80">Made with: {item.madeWith}</div>
              )}
              {item.measurements && Object.keys(item.measurements).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(item.measurements).map(([label, value]) => (
                    <span
                      key={label}
                      className="rounded-full border border-cyan-600/20 bg-cyan-50 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-800"
                    >
                      {label}: {value}
                    </span>
                  ))}
                </div>
              )}
              {renderItemActions(item, Boolean(isAssembly), stackCount)}
            </div>
          </div>
          {renderContainedItems(item, Boolean(isAssembly))}
        </div>
      );
    }

    const stackOffsets = stackCount > 1 ? [6, 4, 2] : [];

    return (
      <div className={`relative ${stackCount > 1 ? 'pr-2 pb-2' : ''}`}>
        {stackOffsets.map((offset, index) => (
          <div
            key={offset}
            className="pointer-events-none absolute inset-0 rounded-2xl border bg-white/60"
            style={{
              transform: `translate(${offset}px, ${offset}px)`,
              opacity: 0.26 + index * 0.12,
              borderColor: index === stackOffsets.length - 1 ? 'rgb(228 228 231 / 0.9)' : 'rgb(244 244 245 / 0.9)',
            }}
          />
        ))}
        <div 
          className={`relative rounded-2xl border p-3 transition-colors shadow-sm ${isEquipped ? 'bg-teal-600/10 border-teal-500 text-teal-900 ring-1 ring-teal-500/20' : 'bg-white/80 border-black/5 text-zinc-800 hover:border-zinc-300'}`}
          title={item.description}
        >
          {stackCount > 1 && (
            <div className="absolute -right-2 -top-2 rounded-full border border-amber-600/30 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900 shadow-md">
              x{stackCount}
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-black/5 text-3xl shadow-inner">
              {item.emoji}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900">{item.name}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.25em] ${originClasses}`}>
                  {item.origin}
                </span>
                {isEquipped && <span className="text-[9px] uppercase font-bold text-teal-700">({item.slot})</span>}
              </div>
              <div className="space-y-1 text-[11px] leading-relaxed text-zinc-600">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={itemMarkdownComponents}
                >
                  {item.descriptionMd || item.description || ''}
                </ReactMarkdown>
              </div>
              {item.semanticNotes && (
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600/80">{item.semanticNotes}</div>
              )}
              {item.madeWith && (
                <div className="text-[11px] leading-relaxed text-amber-700/80">Made with: {item.madeWith}</div>
              )}
              {item.measurements && Object.keys(item.measurements).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(item.measurements).map(([label, value]) => (
                    <span
                      key={label}
                      className="rounded-full border border-cyan-600/20 bg-cyan-50 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-800"
                    >
                      {label}: {value}
                    </span>
                  ))}
                </div>
              )}
              {renderItemActions(item, Boolean(isAssembly), stackCount)}
            </div>
          </div>
          {renderContainedItems(item, Boolean(isAssembly))}
        </div>
      </div>
    );
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!active) return;

    const itemId = active.id;
    if (!over) {
      // Dragged outside inventory, drop it
      socket?.emit('dropItem', itemId);
      return;
    }

    const containerId = over.id;

    if (itemId !== containerId) {
      if (containerId === 'root-inventory') {
        // Drop into the open container or root inventory
        const targetContainer = currentContainer ? currentContainer.id : 'root-inventory';
        const sourceContainerId = findParentContainerId(itemId as string);

        if (targetContainer === 'root-inventory') {
          if (sourceContainerId) {
            socket?.emit('removeItemFromContainer', itemId, sourceContainerId);
          } else {
            socket?.emit('moveItemToContainer', itemId, 'root-inventory');
          }
        } else {
          socket?.emit('moveItemToContainer', itemId, targetContainer);
        }
      } else if (containerId === 'parent-inventory') {
         // Moving up one level
         const sourceContainerId = findParentContainerId(itemId as string);
 
         if (sourceContainerId) {
           // We are currently in sourceContainerId. Its parent is resolvedPath[resolvedPath.length - 2]
           const parentContainer = resolvedPath.length >= 2 ? resolvedPath[resolvedPath.length - 2].id : 'root-inventory';
           if (parentContainer === 'root-inventory') {
             socket?.emit('removeItemFromContainer', itemId, sourceContainerId);
           } else {
             socket?.emit('moveItemToContainer', itemId, parentContainer);
           }
         }
      } else {
        socket?.emit('moveItemToContainer', itemId, containerId);
      }
    }
  };

  const getStackCount = (countValue?: string) => {
    if (!countValue) {
      return 1;
    }

    const parsed = Number.parseInt(countValue, 10);
    return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
  };

  const renderMiniStackIcon = (emoji: string, stackCount: number) => {
    const previewOffsets = stackCount > 1 ? [4, 2] : [];

    return (
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        {previewOffsets.map((offset) => (
          <span
            key={offset}
            className="pointer-events-none absolute inset-0 rounded-lg border border-gray-700 bg-gray-950"
            style={{ transform: `translate(${offset}px, ${offset}px)`, opacity: 0.55 }}
          />
        ))}
        <span className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-black/20 text-base shadow-inner">
          {emoji}
        </span>
      </span>
    );
  };

  const isCurrentAssembly = currentContainer?.tags?.includes('assembly');

  return (
    <div className="bg-white/40 border-t border-black/5 shadow-xl transition-all duration-300 relative backdrop-blur-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-white/20 transition-colors group gap-3"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest group-hover:text-teal-700">
          <Backpack size={14} className={isOpen ? "text-teal-700" : "text-zinc-400"} />
          Equipment & Items ({me.inventory.length})
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && me.inventory.length > 0 && (
            <div className="max-w-[40rem] overflow-hidden text-xs text-zinc-500">
              <div className="flex items-center gap-4 overflow-x-auto pb-1 no-scrollbar whitespace-nowrap">
                {me.inventory.map((item) => (
                  <span key={item.id} className="inline-flex min-w-0 items-center gap-2 shrink-0">
                    {renderMiniStackIcon(item.emoji, getStackCount(item.measurements?.count))}
                    <span className="max-w-[100px] truncate font-medium">{item.name}{getStackCount(item.measurements?.count) > 1 ? ` x${getStackCount(item.measurements?.count)}` : ''}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <ChevronDown size={14} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {isOpen && (
        <div className="p-3 pt-0 overflow-hidden">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[10px] text-zinc-500 italic">Drag items into containers, or click wearables to equip.</div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-black/10 bg-white/70 p-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-full px-3 py-1 transition-colors ${viewMode === 'cards' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-black/5'}`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-full px-3 py-1 transition-colors ${viewMode === 'list' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-black/5'}`}
                >
                  List
                </button>
              </div>
              {canSpawn && (
                <button
                  type="button"
                  onClick={() => setIsSpawnerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-fuchsia-600/30 bg-fuchsia-600/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-800 transition-colors hover:bg-fuchsia-600/20"
                >
                  <Sparkles size={12} />
                  {gameState.mode === 'freeplay' ? 'Spawn Toybox' : 'Debug Spawn'}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[min(48vh,34rem)] overflow-y-auto pr-1">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <Droppable id="root-inventory" isContainer={false}>
                <div className={viewMode === 'cards' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-h-[32px]' : 'flex min-h-[32px] flex-col gap-3'}>
                  {currentContainer && (
                    <Droppable id="parent-inventory" isContainer={true}>
                      <div
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-400 bg-white/40 p-4 text-zinc-500 hover:bg-white/60 hover:text-zinc-700 h-full min-h-[80px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContainerPath((path) => path.slice(0, -1));
                        }}
                      >
                        {isCurrentAssembly ? <Settings size={16} /> : <Backpack size={16} />}
                        <span className="text-xs font-bold uppercase tracking-widest">Back to {resolvedPath.length >= 2 ? resolvedPath[resolvedPath.length - 2].name : 'Inventory'}</span>
                      </div>
                    </Droppable>
                  )}
                  {currentItems.map((item) => {
                    const isEquipped = Object.values(me.equipped).includes(item.id);
                    const isContainer = isContainerItem(item);

                    return (
                      <DraggableItem key={item.id} item={item}>
                        <Droppable id={item.id} isContainer={isContainer}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isContainer) {
                                setContainerPath((path) => [...path, item.id]);
                              } else if (item.slot !== 'none') {
                                handleEquip(item.id, isEquipped ? 'none' : item.slot);
                              }
                            }}
                          >
                            {renderItemBody(item, isEquipped)}
                          </div>
                        </Droppable>
                      </DraggableItem>
                    );
                  })}
                  {currentContainer && currentContainer.maxSlots && (
                    Array.from({ length: Math.max(0, currentContainer.maxSlots - currentItems.length) }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="flex items-center justify-center rounded-2xl border border-dashed border-black/10 bg-black/5 p-4 text-zinc-400/50">
                        <div className="text-[10px] font-bold uppercase tracking-widest">Empty Slot</div>
                      </div>
                    ))
                  )}
                  {currentContainer && currentContainer.maxSlots && (
                    Array.from({ length: Math.max(0, 10 - currentContainer.maxSlots) }).map((_, idx) => (
                      <div key={`locked-${idx}`} className="flex items-center justify-center rounded-2xl border border-black/5 bg-black/10 p-4 text-zinc-400/30">
                        <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">Locked</div>
                      </div>
                    ))
                  )}
                  {!currentContainer && currentItems.length === 0 && (
                    <span className="text-zinc-400 text-xs italic">Your inventory is empty. Try exploring or searching the area.</span>
                  )}
                </div>
              </Droppable>
            </DndContext>
          </div>
        </div>
      )}

      {isSpawnerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 md:items-center"
          onClick={() => setIsSpawnerOpen(false)}
        >
          <div
            className="w-full max-w-6xl rounded-3xl border border-fuchsia-500/20 bg-gray-950/95 p-4 shadow-2xl backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-fuchsia-300">
                  {gameState.mode === 'freeplay' ? 'Freeplay Toybox' : 'Editor Debug Spawner'}
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  {gameState.mode === 'freeplay'
                    ? 'Sandbox props you can pull straight into your cards and immediately prompt with.'
                    : 'Editor-only debug items for fast semantic playtesting.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSpawnerOpen(false)}
                className="rounded-full border border-gray-700 p-2 text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <label className="mb-4 flex items-center gap-2 rounded-2xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-400">
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ladder, shark, rope, tank..."
                className="w-full bg-transparent text-white outline-none placeholder:text-gray-600"
              />
            </label>

            <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSpawnMenu.map((item) => (
                <button
                  key={item.blueprintId}
                  type="button"
                  onClick={() => handleSpawn(item.blueprintId)}
                  className="rounded-2xl border border-gray-800 bg-gray-900/80 p-3 text-left transition-colors hover:border-fuchsia-500/40 hover:bg-gray-900"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-3xl">
                      {item.emoji}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-white">{item.name}</div>
                      <div className="space-y-1 text-[11px] leading-relaxed text-gray-400">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={itemMarkdownComponents}
                        >
                          {item.descriptionMd}
                        </ReactMarkdown>
                      </div>
                      {item.tags?.length ? (
                        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{item.tags.join(' • ')}</div>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
              {filteredSpawnMenu.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-800 px-4 py-8 text-center text-sm text-gray-500 sm:col-span-2 xl:col-span-3">
                  Nothing in this level menu matches that search.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};