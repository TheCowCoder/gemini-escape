import React from 'react';
import { Player } from '../../types';

interface PlayerAvatarProps {
  player: Player;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player }) => {
  // Helper to get color of equipped item
  const getEquippedColor = (slot: keyof Player['equipped'], defaultColor: string) => {
    const itemId = player.equipped[slot];
    if (!itemId) return defaultColor;
    const item = player.inventory.find(i => i.id === itemId);
    return item ? item.color : defaultColor;
  };

  const headColor = getEquippedColor('head', '#fca5a5'); // default skin tone
  const bodyColor = getEquippedColor('body', '#d1d5db'); // default shirt
  const handsColor = getEquippedColor('hands', '#fca5a5'); // default skin tone
  const feetColor = getEquippedColor('feet', '#9ca3af'); // default pants/feet

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
          title={player.equipped.head ? `Head: ${player.inventory.find(i=>i.id === player.equipped.head)?.name}` : 'Head: Bare'}
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
            title={player.equipped.body ? `Body: ${player.inventory.find(i=>i.id === player.equipped.body)?.name}` : 'Body: Bare'}
          />
          {/* Right Arm */}
          <div 
            className="w-4 h-12 rounded-sm shadow-sm transition-colors duration-300 border border-black/20" 
            style={{ backgroundColor: handsColor }}
            title={player.equipped.hands ? `Hands: ${player.inventory.find(i=>i.id === player.equipped.hands)?.name}` : 'Hands: Bare'}
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
            title={player.equipped.feet ? `Feet: ${player.inventory.find(i=>i.id === player.equipped.feet)?.name}` : 'Feet: Bare'}
          />
        </div>

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
