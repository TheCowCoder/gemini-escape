const fs = require('fs');
let content = fs.readFileSync('src/components/game/Inventory.tsx', 'utf8');

const regex = /\{currentContainer && currentContainer\.maxSlots && \([\s\S]*?\}\)/;

const replacement = `{currentContainer && currentContainer.maxSlots && (
                  Array.from({ length: Math.max(0, currentContainer.maxSlots - currentItems.length) }).map((_, idx) => (
                    <div key={\`empty-\${idx}\`} className="flex items-center justify-center rounded-2xl border border-dashed border-black/10 bg-black/5 p-4 text-zinc-400/50">
                      <div className="text-[10px] font-bold uppercase tracking-widest">Empty Slot</div>
                    </div>
                  ))
                )}
                {currentContainer && currentContainer.maxSlots && (
                  Array.from({ length: Math.max(0, 10 - currentContainer.maxSlots) }).map((_, idx) => (
                    <div key={\`locked-\${idx}\`} className="flex items-center justify-center rounded-2xl border border-black/5 bg-black/10 p-4 text-zinc-400/30">
                      <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">Locked</div>
                    </div>
                  ))
                )}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/game/Inventory.tsx', content);
