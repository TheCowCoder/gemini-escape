import React from 'react';
import { Player } from '../../types';

interface PlayerAvatarProps {
  player: Player;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player }) => {
  const equippedBySlot = player.equipped as Record<string, string | undefined>;
  const slottedItems = player.inventory.filter((item) => typeof item.slot === 'string' && item.slot !== 'none');

  const getEquippedColor = (slots: string[], defaultColor: string) => {
    const itemId = slots.map((slot) => equippedBySlot[slot]).find(Boolean);
    if (!itemId) return defaultColor;
    const item = player.inventory.find((inventoryItem) => inventoryItem.id === itemId);
    return item ? item.color : defaultColor;
  };

  const getEquippedLabel = (slots: string[], emptyLabel: string) => {
    const itemId = slots.map((slot) => equippedBySlot[slot]).find(Boolean);
    if (!itemId) return emptyLabel;
    const item = player.inventory.find((inventoryItem) => inventoryItem.id === itemId);
    return item ? item.name : emptyLabel;
  };

  const formatSlotLabel = (slot: string) => slot.replace(/-/g, ' ');

  const headColor = getEquippedColor(['head'], '#fca5a5');
  const bodyColor = getEquippedColor(['body'], '#d1d5db');
  const handsColor = getEquippedColor(['hands', 'right-hand'], '#fca5a5');
  const feetColor = getEquippedColor(['feet'], '#9ca3af');

  return (
    <div className="flex flex-col items-center justify-center p-2">
      {/* Name Tag */}
      <div className="text-xs font-bold mb-2 px-2 py-1 rounded bg-gray-800 border border-gray-700" style={{ color: player.color }}>
        {player.name}
      </div>
      
      {/* Avatar Container */}
      <div className="relative flex flex-col items-center group">
        {/* Head */}
        <div 
          className="w-10 h-10 rounded-sm shadow-sm z-10 transition-colors duration-300 border border-black/20" 
          style={{ backgroundColor: headColor }}
          title={`Head: ${getEquippedLabel(['head'], 'Bare')}`}
        />
        
        {/* Torso & Arms */}
        <div className="flex -mt-1 z-0">
          {/* Left Arm */}
          <div 
            className="w-4 h-12 rounded-sm shadow-sm transition-colors duration-300 border border-black/20" 
            style={{ backgroundColor: handsColor }}
          />
          {/* Body */}
          <div 
            className="w-14 h-14 rounded-sm shadow-sm mx-1 transition-colors duration-300 border border-black/20" 
            style={{ backgroundColor: bodyColor }}
            title={`Body: ${getEquippedLabel(['body'], 'Bare')}`}
          />
          {/* Right Arm */}
          <div 
            className="w-4 h-12 rounded-sm shadow-sm transition-colors duration-300 border border-black/20" 
            style={{ backgroundColor: handsColor }}
            title={`Hands: ${getEquippedLabel(['hands', 'right-hand'], 'Bare')}`}
          />
        </div>
        
        {/* Legs */}
        <div className="flex gap-1 -mt-1 z-0">
          <div 
            className="w-6 h-12 rounded-sm shadow-sm transition-colors duration-300 border border-black/20" 
            style={{ backgroundColor: feetColor }}
          />
          <div 
            className="w-6 h-12 rounded-sm shadow-sm transition-colors duration-300 border border-black/20" 
            style={{ backgroundColor: feetColor }}
            title={`Feet: ${getEquippedLabel(['feet'], 'Bare')}`}
          />
        </div>

        {slottedItems.length > 0 && (
          <div className="mt-2 flex max-w-[9rem] flex-wrap justify-center gap-1.5">
            {slottedItems.map((item) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-700 shadow-sm"
                title={`${formatSlotLabel(item.slot)}: ${item.name}`}
              >
                <span>{item.emoji}</span>
                <span>{formatSlotLabel(item.slot)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status Indicator */}
        {player.isLockedIn && (
          <div className="absolute -top-4 -right-4 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-lg border border-green-700">
            READY
          </div>
        )}
      </div>
    </div>
  );
};
