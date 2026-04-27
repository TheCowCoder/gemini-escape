import React, { useState } from 'react';

interface SessionJoinScreenProps {
  title: string;
  subtitle: string;
  sessionId: string;
  onJoin: (name: string) => void;
}

export const SessionJoinScreen: React.FC<SessionJoinScreenProps> = ({ title, subtitle, sessionId, onJoin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    onJoin(name.trim());
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(180deg,_#050816_0%,_#0f172a_100%)] px-4 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-300">Join Session</div>
        <h1 className="mt-3 font-serif text-4xl text-white">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-stone-300/80">{subtitle}</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300">
          Session code: <span className="font-bold text-white">{sessionId}</span>
        </div>

        <label className="mt-6 block text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Traveler Name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Choose a name..."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none transition-colors focus:border-emerald-400/60"
          autoFocus
        />

        <button
          type="submit"
          disabled={!name.trim()}
          className="mt-6 w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
        >
          Enter Session
        </button>
      </form>
    </div>
  );
};