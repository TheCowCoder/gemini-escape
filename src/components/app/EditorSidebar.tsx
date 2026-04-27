import React, { useEffect, useMemo, useState } from 'react';
import type { EditorDraft } from '../../../types';
import { useSocket } from '../../hooks/useSocket';

interface EditorSidebarProps {
  levelId: string;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({ levelId }) => {
  const { socket } = useSocket();
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [startingInventoryText, setStartingInventoryText] = useState('[]');
  const [status, setStatus] = useState<string>('Loading level package...');

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/levels/${levelId}`)
      .then((response) => response.json())
      .then((nextDraft: EditorDraft) => {
        if (cancelled) {
          return;
        }

        setDraft(nextDraft);
        setStartingInventoryText(JSON.stringify(nextDraft.startingInventory, null, 2));
        setStatus('Editing authored draft. Apply changes, then reset the preview.');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('Failed to load level package.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [levelId]);

  const wordCount = useMemo(() => (draft?.levelDescription || '').trim().split(/\s+/).filter(Boolean).length, [draft]);

  const applyDraft = (shouldReset: boolean) => {
    if (!socket || !draft) {
      return;
    }

    try {
      const parsedInventory = JSON.parse(startingInventoryText);
      const nextDraft: EditorDraft = {
        ...draft,
        startingInventory: parsedInventory,
      };

      socket.emit('updateEditorDraft', nextDraft);
      setDraft(nextDraft);
      setStatus(shouldReset ? 'Draft applied and preview reset.' : 'Draft applied. Reset preview to replay the new seed.');

      if (shouldReset) {
        socket.emit('resetSession');
      }
    } catch {
      setStatus('Starting inventory JSON is invalid.');
    }
  };

  if (!draft) {
    return (
      <aside className="border-r border-stone-800 bg-stone-950/90 p-4 text-sm text-stone-400">
        {status}
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full max-w-[26rem] flex-col border-r border-stone-800 bg-stone-950/95">
      <div className="border-b border-stone-800 px-5 py-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">Level Editor</div>
        <div className="mt-2 font-serif text-2xl text-white">{draft.title}</div>
        <div className="mt-2 text-xs leading-6 text-stone-400">{status}</div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm text-stone-200">
        <section className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500">Title</label>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className="w-full rounded-2xl border border-stone-800 bg-black/30 px-3 py-2 outline-none focus:border-amber-400/60"
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500">Level Description</label>
            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-600">{wordCount} words</span>
          </div>
          <textarea
            value={draft.levelDescription}
            onChange={(event) => setDraft({ ...draft, levelDescription: event.target.value })}
            rows={10}
            className="w-full rounded-[1.5rem] border border-stone-800 bg-black/30 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </section>

        <section className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500">Level Goal</label>
          <textarea
            value={draft.levelGoal}
            onChange={(event) => setDraft({ ...draft, levelGoal: event.target.value })}
            rows={4}
            className="w-full rounded-[1.5rem] border border-stone-800 bg-black/30 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </section>

        <section className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500">System Prompt</label>
          <textarea
            value={draft.systemPrompt}
            onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
            rows={8}
            className="w-full rounded-[1.5rem] border border-stone-800 bg-black/30 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </section>

        <section className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500">User Prompt</label>
          <textarea
            value={draft.userPrompt}
            onChange={(event) => setDraft({ ...draft, userPrompt: event.target.value })}
            rows={6}
            className="w-full rounded-[1.5rem] border border-stone-800 bg-black/30 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </section>

        <section className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500">Starting Inventory JSON</label>
          <textarea
            value={startingInventoryText}
            onChange={(event) => setStartingInventoryText(event.target.value)}
            rows={8}
            className="w-full rounded-[1.5rem] border border-stone-800 bg-black/30 px-4 py-3 font-mono text-xs outline-none focus:border-amber-400/60"
          />
        </section>
      </div>

      <div className="grid gap-3 border-t border-stone-800 px-5 py-4">
        <button
          type="button"
          onClick={() => applyDraft(false)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-stone-100 transition-colors hover:bg-white/10"
        >
          Apply Draft
        </button>
        <button
          type="button"
          onClick={() => applyDraft(true)}
          className="rounded-full bg-amber-400 px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-amber-300"
        >
          Apply + Reset Preview
        </button>
        <button
          type="button"
          onClick={() => socket?.emit('resetSession')}
          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100 transition-colors hover:bg-emerald-400/20"
        >
          Reset Current Draft
        </button>
      </div>
    </aside>
  );
};