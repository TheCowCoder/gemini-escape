import React, { useEffect, useState } from 'react';
import type { GameMode, LevelSummary } from '../../../types';

interface MainMenuProps {
  onStart: (mode: GameMode, levelId: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  const [levels, setLevels] = useState<LevelSummary[]>([]);

  useEffect(() => {
    fetch('/api/levels')
      .then((response) => response.json())
      .then((nextLevels: LevelSummary[]) => setLevels(nextLevels))
      .catch(() => setLevels([]));
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_40%),linear-gradient(160deg,_#f0f9ff_0%,_#e0f2fe_45%,_#f8fafc_100%)] px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-sky-200/50 bg-white/40 p-8 shadow-xl backdrop-blur-xl">
            <div className="text-xs font-bold uppercase tracking-[0.35em] text-sky-600/80">Gemini Escape</div>
            <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-tight text-zinc-900 md:text-6xl">
              Semantic invention, multiplayer world memory, and authored levels that can breathe.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-600">
              Progression levels now seed the world instead of hard-bounding it. Freeplay keeps the toybox alive in a separate sandbox. The level editor mirrors the real game with prompt-first controls and visible model internals.
            </p>
          </div>

          <div className="grid gap-4 rounded-[2rem] border border-blue-200/50 bg-white/40 p-6 shadow-xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => onStart('freeplay', 'freeplay-forest')}
              className="rounded-[1.5rem] border border-blue-400/30 bg-blue-400/10 p-5 text-left transition-colors hover:bg-blue-400/15"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-600">Freeplay</div>
              <div className="mt-3 font-serif text-2xl text-zinc-900">Spawn wild props and test absurd inventions.</div>
              <div className="mt-2 text-sm leading-6 text-blue-800/70">Open sandbox forest, big spawn menu, friendly wildlife, and enough space for sharks, tanks, ladders, and nonsense.</div>
            </button>

            <div className="rounded-[1.5rem] border border-black/5 bg-black/5 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Multiplayer</div>
              <div className="mt-3 font-serif text-2xl text-zinc-800">Every mode is online.</div>
              <div className="mt-2 text-sm leading-6 text-zinc-600/75">Starting a session generates a shareable URL. Anyone opening that URL joins the same live world.</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-400">Authored Levels</div>
            <h2 className="mt-2 font-serif text-3xl text-zinc-900">Choose a level and either play it or open it in the editor.</h2>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {levels.map((level) => (
              <article key={level.id} className="rounded-[2rem] border border-sky-100 bg-white/60 p-6 shadow-xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-400">{level.id}</div>
                    <h3 className="mt-2 font-serif text-3xl text-zinc-900">{level.title}</h3>
                  </div>
                  <div className="rounded-full border border-sky-300/20 bg-sky-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-sky-700">
                    Online
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Starting Situation</span>
                  <p className="text-sm leading-7 text-zinc-600 line-clamp-3">{level.startingText}</p>
                </div>
                <div className="mt-4 flex flex-col gap-1 rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600/70">Level Goal</span>
                  <p className="text-sm leading-6 text-sky-900/85">{level.levelGoal}</p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onStart('level', level.id)}
                    className="rounded-full border border-sky-400/30 bg-sky-400/10 px-5 py-2 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-400/20"
                  >
                    Start Online Play
                  </button>
                  <button
                    type="button"
                    onClick={() => onStart('editor', level.id)}
                    className="rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-400/20"
                  >
                    Open Level Editor
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};