import React, { useState } from 'react';
import { useGame } from '../../hooks/useGame';
import { useSocket } from '../../hooks/useSocket';
import { Backpack, ChevronDown } from 'lucide-react';

export const Inventory: React.FC = () => {
  const { gameState, myId } = useGame();
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(true);

  if (!gameState || !myId) return null;

  const me = gameState.players[myId];
  if (!me) return null;

  const handleEquip = (itemId: string, slot: string) => {
    if (socket) {
      socket.emit('equip', itemId, slot);
    }
  };

  return (
    <div className="bg-gray-900 border-t border-gray-800 shadow-2xl transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800 transition-colors group"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-teal-500">
          <Backpack size={14} className={isOpen ? "text-teal-600" : "text-gray-600"} />
          Equipment & Items ({me.inventory.length})
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && me.inventory.length > 0 && (
            <div className="flex -space-x-1">
              {me.inventory.slice(0, 3).map(item => (
                <div key={item.id} className="w-3 h-3 rounded-full border border-gray-900" style={{ backgroundColor: item.color }} />
              ))}
            </div>
          )}
          <ChevronDown size={14} className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0">
          <div className="text-[10px] text-gray-600 italic mb-3">Click to equip/unequip</div>
          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {me.inventory.length === 0 ? (
              <span className="text-gray-600 text-xs italic">Your inventory is empty. Try exploring or searching the area.</span>
            ) : (
              me.inventory.map(item => {
                const isEquipped = Object.values(me.equipped).includes(item.id);
                return (
                  <div 
                    key={item.id} 
                    className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${
                      isEquipped 
                        ? 'bg-teal-900/50 border-teal-500 text-teal-200' 
                        : 'bg-gray-900 border-gray-600 text-gray-300 hover:border-gray-400'
                    }`}
                    title={item.description}
                    onClick={() => {
                      if (item.slot !== 'none') {
                        handleEquip(item.id, isEquipped ? 'none' : item.slot);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                      {isEquipped && <span className="text-[9px] uppercase ml-1 opacity-70">({item.slot})</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
