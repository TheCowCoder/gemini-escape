import React from 'react';
import { useGame } from '../hooks/useGame';

type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'midnight';

const timeConfigs: Record<TimeOfDay, { 
  gradient: string, 
  glow: string 
}> = {
  morning: {
    gradient: 'from-blue-400 via-sky-300 to-amber-100',
    glow: 'bg-yellow-200/40 shadow-[0_0_100px_40px_rgba(253,224,71,0.3)]',
  },
  noon: {
    gradient: 'from-blue-500 via-blue-400 to-sky-300',
    glow: 'bg-yellow-100 shadow-[0_0_150px_60px_rgba(255,255,255,0.4)]',
  },
  afternoon: {
    gradient: 'from-blue-400 via-sky-300 to-orange-100',
    glow: 'bg-yellow-200/50 shadow-[0_0_120px_50px_rgba(251,191,36,0.3)]',
  },
  evening: {
    gradient: 'from-indigo-900 via-purple-800 to-orange-400',
    glow: 'bg-orange-300/40 shadow-[0_0_100px_40px_rgba(249,115,22,0.4)]',
  },
  night: {
    gradient: 'from-slate-950 via-indigo-950 to-blue-900',
    glow: 'bg-blue-100/80 shadow-[0_0_80px_30px_rgba(219,234,254,0.2)]',
  },
  midnight: {
    gradient: 'from-black via-slate-950 to-indigo-950',
    glow: 'bg-white/60 shadow-[0_0_60px_20px_rgba(255,255,255,0.15)]',
  },
};

export const SkyBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { gameState } = useGame();
  
  const getDecimalHours = (timeStr: string): number => {
    if (!timeStr) return 10;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 10;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    return hours + minutes / 60;
  };

  const decimalHours = getDecimalHours(gameState?.gameTime || '10:00 AM');
  
  const getTimePhase = (hours: number): TimeOfDay => {
    if (hours >= 5 && hours < 10) return 'morning';
    if (hours >= 10 && hours < 15) return 'noon';
    if (hours >= 15 && hours < 18) return 'afternoon';
    if (hours >= 18 && hours < 21) return 'evening';
    if (hours >= 21 || hours < 4) return 'night';
    return 'midnight';
  };

  const timePhase = getTimePhase(decimalHours);
  const config = timeConfigs[timePhase];

  // Calculate Sun position (Visible 6 AM to 6 PM)
  const getSunPos = () => {
    const isDay = decimalHours >= 6 && decimalHours <= 18;
    const progress = (decimalHours - 6) / 12; // 0 at 6am, 1 at 6pm
    const left = progress * 100;
    const top = 80 - Math.sin(progress * Math.PI) * 70;
    return { left, top, opacity: isDay ? 1 : 0 };
  };

  // Calculate Moon position (Visible 6 PM to 6 AM)
  const getMoonPos = () => {
    let moonHours = decimalHours;
    if (moonHours < 6) moonHours += 24; // Normalized to 18 (6pm) through 30 (6am)
    const isNight = decimalHours >= 18 || decimalHours <= 6;
    const progress = (moonHours - 18) / 12; // 0 at 6pm, 1 at 6am
    const left = progress * 100;
    const top = 80 - Math.sin(progress * Math.PI) * 70;
    return { left, top, opacity: isNight ? 1 : 0 };
  };

  const sun = getSunPos();
  const moon = getMoonPos();

  return (
    <div className={`relative min-h-screen w-full overflow-hidden bg-gradient-to-b ${config.gradient} transition-all duration-1000`}>
      {/* Sun */}
      <div 
        className="absolute h-24 w-24 rounded-full transition-all duration-[3000ms] ease-in-out bg-yellow-100 shadow-[0_0_150px_60px_rgba(253,224,71,0.3)] flex items-center justify-center"
        style={{ 
          left: `${sun.left}%`, 
          top: `${sun.top}%`,
          opacity: sun.opacity,
          transform: `translate(-50%, -50%) scale(${sun.opacity})`,
          visibility: sun.opacity > 0 ? 'visible' : 'hidden'
        }}
      >
        <div className="h-full w-full rounded-full bg-yellow-100 opacity-90 blur-[2px]" />
      </div>

      {/* Moon */}
      <div 
        className="absolute h-20 w-20 rounded-full transition-all duration-[3000ms] ease-in-out bg-blue-50 shadow-[0_0_80px_30px_rgba(219,234,254,0.2)] flex items-center justify-center"
        style={{ 
          left: `${moon.left}%`, 
          top: `${moon.top}%`,
          opacity: moon.opacity,
          transform: `translate(-50%, -50%) scale(${moon.opacity})`,
          visibility: moon.opacity > 0 ? 'visible' : 'hidden'
        }}
      >
        <div className="relative h-full w-full rounded-full bg-blue-50 opacity-90 blur-[1px]">
          <div className="absolute top-4 left-4 h-4 w-4 rounded-full bg-blue-200/40" />
          <div className="absolute bottom-6 right-8 h-3 w-3 rounded-full bg-blue-200/40" />
        </div>
      </div>

      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/clouds.png')] opacity-10 pointer-events-none" />

      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
};