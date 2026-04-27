const fs = require('fs');
let content = fs.readFileSync('src/components/game/Inventory.tsx', 'utf8');

const regex = /<Droppable id="root-inventory" isContainer={false}>([\s\S]*?)<\/Droppable>\s*<\/DndContext>/;

const replacement = `<Droppable id="root-inventory" isContainer={false}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-h-[32px]">
                {currentContainer && (
                  <Droppable id="parent-inventory" isContainer={true}>
                    <div
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-400 bg-white/40 p-4 text-zinc-500 hover:bg-white/60 hover:text-zinc-700 h-full"
                      onClick={() => setContainerPath(p => p.slice(0, -1))}
                    >
                      <Backpack size={16} />
                      <span className="text-xs font-bold uppercase tracking-widest">Back to {resolvedPath.length >= 2 ? resolvedPath[resolvedPath.length - 2].name : 'Inventory'}</span>
                    </div>
                  </Droppable>
                )}
                {currentItems.map(item => {
                  const isEquipped = Object.values(me.equipped).includes(item.id);
                  const isContainer = item.tags?.includes('container');
                  const stackCount = getStackCount(item.measurements?.count);
                  const stackOffsets = stackCount > 1 ? [6, 4, 2] : [];
                  return (
                    <DraggableItem key={item.id} item={item}>
                      <Droppable id={item.id} isContainer={!!isContainer}>
                        <div className={\`relative \${stackCount > 1 ? 'pr-2 pb-2' : ''}\`}>
                          {stackOffsets.map((offset, index) => (
                            <div
                              key={offset}
                              className="pointer-events-none absolute inset-0 rounded-2xl border bg-white/60"
                              style={{
                                transform: \`translate(\${offset}px, \${offset}px)\`,
                                opacity: 0.26 + index * 0.12,
                                borderColor: index === stackOffsets.length - 1 ? 'rgb(228 228 231 / 0.9)' : 'rgb(244 244 245 / 0.9)',
                              }}
                            />
                          ))}
                          <div 
                            className={\`relative rounded-2xl border p-3 transition-colors shadow-sm \${isContainer ? 'cursor-pointer' : 'cursor-pointer'} \${
                              isEquipped 
                                ? 'bg-teal-600/10 border-teal-500 text-teal-900 ring-1 ring-teal-500/20' 
                                : 'bg-white/80 border-black/5 text-zinc-800 hover:border-zinc-300'
                            }\`}
                            title={item.description}
                            onClick={() => {
                              if (isContainer) {
                                setContainerPath([...containerPath, item.id as string]);
                              } else if (item.slot !== 'none') {
                                handleEquip(item.id as string, isEquipped ? 'none' : item.slot as string);
                              }
                            }}
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
                                  <span className={\`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.25em] \${item.origin === 'starter' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}\`}>
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
                              </div>
                            </div>
                            {isContainer && item.contents && item.contents.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-black/5">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Contents</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.contents.map(content => (
                                    <span key={content.id} className="flex h-6 w-6 items-center justify-center rounded-md bg-black/5 text-sm shadow-inner" title={content.name}>
                                      {content.emoji}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Droppable>
                    </DraggableItem>
                  );
                })}
                {currentContainer && currentContainer.maxSlots && (
                  Array.from({ length: Math.max(0, currentContainer.maxSlots - currentItems.length) }).map((_, idx) => (
                    <div key={\`empty-\${idx}\`} className="flex items-center justify-center rounded-2xl border border-dashed border-black/10 bg-black/5 p-4 text-zinc-400/50">
                      <div className="text-[10px] font-bold uppercase tracking-widest">Empty Slot</div>
                    </div>
                  ))
                )}
                {!currentContainer && currentItems.length === 0 && (
                  <span className="text-zinc-400 text-xs italic">Your inventory is empty. Try exploring or searching the area.</span>
                )}
              </div>
            </Droppable>
          </DndContext>`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/game/Inventory.tsx', content);
