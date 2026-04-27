import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useGame } from '../../hooks/useGame';
import { useSocket } from '../../hooks/useSocket';
import { Compass, LoaderCircle, Image as ImageIcon, MessageSquare, Clock, Zap, MapPin, Search } from 'lucide-react';
import { GEN_STARTER } from '../../config/settings';
import type { ChatMessage } from '../../types';

const Typewriter: React.FC<{ text: string }> = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const words = text.split(' ');
    const interval = setInterval(() => {
      if (i < words.length) {
        setDisplayedText(words.slice(0, i + 1).join(' '));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 70);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayedText}</span>;
};

const RichMarkdown: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw]}
    components={{
      p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-bold text-zinc-900">{children}</strong>,
      ul: ({ children }) => <ul className="mb-4 list-disc space-y-2 pl-6 last:mb-0">{children}</ul>,
      ol: ({ children }) => <ol className="mb-4 list-decimal space-y-2 pl-6 last:mb-0">{children}</ol>,
      li: ({ children }) => <li>{children}</li>,
      code: ({ children }) => <code className="rounded bg-black/5 px-1 py-0.5 text-sm">{children}</code>,
    }}
  >
    {text}
  </ReactMarkdown>
);

const THOUGHT_STOPWORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'should', 'that', 'the', 'then', 'this', 'to', 'we', 'with']);

const titleCaseWord = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

const buildThoughtTitle = (thought: string) => {
  const normalized = thought.replace(/\*\*/g, '').replace(/\r/g, ' ').trim();
  const firstSentence = normalized.split(/\n+/)[0]?.split(/[.!?]/)[0] || normalized;
  const tokens: string[] = firstSentence.match(/[A-Za-z0-9']+/g) ||[];
  const filteredTokens = tokens.filter((token) => !THOUGHT_STOPWORDS.has(token.toLowerCase()));
  const sourceTokens = (filteredTokens.length > 0 ? filteredTokens : tokens).slice(0, 4);
  return sourceTokens.length === 0 ? 'Current Thought' : sourceTokens.map(titleCaseWord).join(' ');
};

export const WorldPanel: React.FC = () => {
  const { gameState, chatHistory, turnProgress, levelCompletePayload, onlyImages } = useGame();
  const { socket } = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
  const prosePanelClass = 'rounded-[2rem] border border-black/10 bg-white/72 px-5 py-4 shadow-xl backdrop-blur-md';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  },[chatHistory, turnProgress.phase]);

  if (!gameState) return <div className="p-4 text-gray-500 font-mono">Loading world...</div>;

  // Check if the currently generating image is the latest element in the history
  const isGeneratingImage = chatHistory.length > 0 && chatHistory[chatHistory.length - 1].type === 'image' && !chatHistory[chatHistory.length - 1].imageUrl;

  // We re-sort the history by turn, ensuring Images appear ABOVE narratives within a turn
  const processedHistory = useMemo(() => {
    let filtered = chatHistory.filter(m => onlyImages ? (m.type === 'prompt' || m.type === 'image') : (m.type === 'narrative' || m.type === 'prompt' || m.type === 'image'));
    
    // Group messages by turn: prompts mark turn boundaries, images come from the narrative after, group narratives with their preceding image
    if (!onlyImages) {
      const reordered: ChatMessage[] =[];
      for (let i = 0; i < filtered.length; i++) {
        const msg = filtered[i];
        if (msg.type === 'prompt') {
          reordered.push(msg);
        } else if (msg.type === 'narrative') {
          // Look ahead for images that should come after this narrative
          const images: ChatMessage[] =[];
          let j = i + 1;
          while (j < filtered.length && filtered[j].type === 'image') {
            images.push(filtered[j]);
            j++;
          }
          // Add images first, then narrative
          images.forEach(img => reordered.push(img));
          reordered.push(msg);
          i = j - 1; // Skip past the images we just added
        } else {
          reordered.push(msg);
        }
      }
      return reordered;
    }
    return filtered;
  }, [chatHistory, onlyImages]);

  const introText = gameState.levelStartingText || gameState.environment.description;
  const currentLocationLabel = gameState.environment.title && gameState.environment.title !== gameState.levelTitle
    ? `Current location: ${gameState.environment.title}`
    : 'Current location: Starting area';
  
  const latestThoughtTitle = useMemo(() => {
    const source = turnProgress.latestThought || turnProgress.thoughtLog[turnProgress.thoughtLog.length - 1] || '';
    return buildThoughtTitle(source);
  }, [turnProgress.latestThought, turnProgress.thoughtLog]);

  const parsedThoughtEntries = useMemo(
    () => turnProgress.thoughtLog.map((thought) => {
        const normalized = thought.replace(/\*\*/g, '').replace(/\r/g, '').trim();
        const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
        let title = buildThoughtTitle(normalized);
        let body = lines.slice(1).join('\n\n').trim();
        if (!body) {
          const sentenceParts = normalized.split(/(?<=[.!?])\s+/);
          if (sentenceParts.length > 1) body = sentenceParts.slice(1).join(' ').trim();
        }
        if (body.replace(/\s+/g, ' ').trim() === normalized.replace(/\s+/g, ' ').trim()) body = '';
        return { title, body };
      }), [turnProgress.thoughtLog]
  );

  useEffect(() => {
    if (turnProgress.phase === 'waiting') setIsThoughtExpanded(false);
  },[turnProgress.phase]);

  return (
    <div ref={scrollRef} className="absolute inset-0 overflow-y-auto bg-transparent p-5 scroll-smooth">
      <div className="mx-auto max-w-3xl space-y-8 pb-20">
          
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div>
              <h1 className="text-3xl font-bold text-teal-800 font-serif tracking-wide">{gameState.levelTitle}</h1>
              <div className="mt-2 flex items-center gap-4">
                <div className="text-xs font-mono uppercase tracking-widest text-zinc-500">Turn {gameState.turnNumber}</div>
                <div className="h-1 w-1 rounded-full bg-zinc-300" />
                <div className="max-w-md truncate text-xs font-mono italic text-teal-700/70">
                  {currentLocationLabel}
                </div>
              </div>
              <div className="mt-3 max-w-3xl rounded-2xl border border-black/5 bg-white/40 px-4 py-3 text-sm leading-6 text-amber-900/80 backdrop-blur-sm">
                Goal: {gameState.levelGoal}
              </div>
            </div>

            {/* Starter Image (Shown in both modes) */}
            {!GEN_STARTER && gameState.startingImageUrl && (
              <div className="rounded-2xl overflow-hidden shadow-xl border border-black/5">
                <img src={gameState.startingImageUrl} alt="Starting environment" className="w-full aspect-video object-cover" />
              </div>
            )}

            {!onlyImages && (
              <div className={prosePanelClass}>
                <div className="text-xl text-zinc-900 leading-relaxed font-serif whitespace-pre-line first-letter:text-4xl first-letter:font-bold first-letter:text-teal-700 first-letter:mr-2 first-letter:float-left">
                  {introText}
                </div>
              </div>
            )}
            
            {(chatHistory.length === 0 || !onlyImages) && (
              <div className="bg-white/30 rounded-lg p-4 border border-black/5 backdrop-blur-sm">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Compass size={14} /> Observations
                </h3>
                <ul className="space-y-2">
                  {gameState.environment.exits?.map((exit, i) => (
                    <li key={i} className="text-teal-700/80 text-sm flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-teal-600 before:rounded-full">
                      {exit}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gameState.players['groundLevel']?.inventory.length > 0 && (
              <div className="bg-amber-50/40 rounded-lg p-4 border border-amber-200/30 backdrop-blur-sm">
                <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Search size={14} /> On the ground
                </h3>
                <div className="flex flex-wrap gap-2">
                  {gameState.players['groundLevel'].inventory.map((item) => (
                    <button 
                      key={item.id} 
                      onClick={() => socket?.emit('pickupItem', item.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/60 pl-1.5 pr-3 py-1 border border-amber-200/50 text-xs font-medium text-amber-900 shadow-sm hover:bg-white hover:border-amber-400 transition-all active:scale-95 group" 
                      title={`Click to pick up: ${item.description}`}
                    >
                      <span className="group-hover:scale-110 transition-transform">{item.emoji}</span>
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {processedHistory.map((msg, idx) => {
            const isImage = msg.type === 'image';
            const isNarrative = msg.type === 'narrative';

            // Skip narrative if it's paired with an image (will be shown below image)
            if (isNarrative && idx > 0 && processedHistory[idx - 1].type === 'image') return null;

            // Find the narrative that follows this image
            const followingNarrative = isImage && idx + 1 < processedHistory.length && processedHistory[idx + 1].type === 'narrative'
              ? processedHistory[idx + 1]
              : null;

            const isLatestMessage = chatHistory.length > 0 && msg.id === chatHistory[chatHistory.length - 1].id;
            const showImageShell = Boolean(
              isImage && (
                msg.imageUrl
                || (msg.npcDialogues && msg.npcDialogues.length > 0)
                || (isLatestMessage && turnProgress.phase !== 'idle')
              )
            );

            return (
              <div key={msg.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {isImage ? (
                  <div className="flex flex-col gap-4">
                    {showImageShell && (
                      <div className="rounded-2xl overflow-hidden shadow-xl border border-black/5 bg-white/50 backdrop-blur-sm">
                        {msg.imageUrl ? (
                          <img src={msg.imageUrl} alt="POV" className="w-full aspect-video object-cover" />
                        ) : isLatestMessage && turnProgress.phase !== 'idle' ? (
                          <div className="w-full aspect-video rounded-t-2xl bg-[#faf7ef] flex flex-col items-center justify-center shadow-inner relative overflow-hidden animate-in fade-in duration-500">
                            <div className="flex flex-col items-center gap-6 w-full max-w-md px-10">
                              <div className="text-teal-700/10">
                                <ImageIcon size={100} strokeWidth={1} />
                              </div>
                              <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-teal-600 transition-all duration-700 ease-out"
                                  style={{ width: `${Math.min(turnProgress.imageProgress || 0, 58)}%` }}
                                />
                              </div>
                              <button
                                onClick={() => socket?.emit('cancelImageGeneration')}
                                className="px-4 py-2 rounded-lg bg-red-100/60 border border-red-300/40 text-red-700 hover:bg-red-100 hover:border-red-400 transition-colors text-xs font-bold uppercase tracking-wider"
                              >
                                Cancel
                              </button>
                              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-teal-800/40">
                                {turnProgress.waitingText?.includes('Retry') ? (
                                  <span className="text-orange-600 animate-pulse">{turnProgress.waitingText}</span>
                                ) : (
                                  'Materializing Vision...'
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {msg.npcDialogues && msg.npcDialogues.length > 0 && (
                          <div className={`space-y-3 bg-stone-50/90 p-4 ${msg.imageUrl || (isLatestMessage && turnProgress.phase !== 'idle') ? 'border-t border-black/5' : ''}`}>
                            {msg.npcDialogues.map((npc, i) => (
                              <div key={i} className="flex flex-col gap-1 rounded-2xl border border-black/5 bg-white/85 p-3 shadow-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{npc.emoji}</span>
                                  <span className="font-bold text-zinc-900 text-sm uppercase tracking-widest">{npc.name}</span>
                                </div>
                                <div className="text-zinc-800 italic font-serif leading-relaxed">"{npc.text}"</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Response Text Below Image */}
                    {followingNarrative && (
                      <div className="space-y-6">
                        <div className={prosePanelClass}>
                          <div className="text-xl text-zinc-900 leading-relaxed font-serif whitespace-pre-wrap first-letter:text-4xl first-letter:font-bold first-letter:text-teal-700 first-letter:mr-2 first-letter:float-left">
                            <RichMarkdown text={followingNarrative.text} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isNarrative ? (
                  <div className="space-y-6">
                    <div className={prosePanelClass}>
                      <div className="text-xl text-zinc-900 leading-relaxed font-serif whitespace-pre-wrap first-letter:text-4xl first-letter:font-bold first-letter:text-teal-700 first-letter:mr-2 first-letter:float-left">
                        <RichMarkdown text={msg.text} />
                      </div>
                    </div>
                  </div>
                ) : msg.type === 'prompt' ? (
                  <div className="flex justify-end pr-4">
                    <div className="bg-teal-600/10 border border-teal-600/20 rounded-2xl rounded-tr-none px-4 py-3 max-w-[80%] backdrop-blur-sm shadow-sm">
                      {msg.actionEntries?.length ? (
                        <div className="space-y-4">
                          {msg.actionEntries.map((entry) => (
                            <div key={`${msg.id}-${entry.playerId}`} className="space-y-2">
                              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800/60">{entry.playerName}</div>
                              <div className="text-teal-950 text-sm whitespace-pre-wrap italic font-serif">"{entry.text}"</div>
                              {entry.sketch && (
                                <img
                                  src={entry.sketch.dataUrl}
                                  alt="Sketch"
                                  className="w-full max-w-xl cursor-pointer rounded-2xl border border-teal-600/20 bg-[#faf7ef] p-2 shadow-lg transition-all hover:border-teal-400"
                                  onClick={() => window.dispatchEvent(new CustomEvent('gemini-escape-edit-sketch', { detail: entry.sketch }))}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-teal-950 text-sm whitespace-pre-wrap italic font-serif">"{msg.text}"</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {turnProgress.phase !== 'idle' && !isGeneratingImage && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {turnProgress.waitingText?.includes('Retry') && (
                <div className="text-sm font-bold text-orange-800 animate-pulse bg-orange-100/60 px-4 py-2 rounded-full inline-block backdrop-blur-sm shadow-sm border border-orange-200/50">
                  {turnProgress.waitingText}
                </div>
              )}

              {/* Large Spinner / Ghost Preview for Thinking/Waiting phases */}
              <div className="w-full aspect-video rounded-2xl bg-[#faf7ef] flex flex-col items-center justify-center shadow-inner relative overflow-hidden border border-black/5 animate-in fade-in duration-500 group">
                 <div className="text-center px-8">
                   <div className="font-serif text-3xl text-teal-900/80 italic leading-tight">
                     {turnProgress.thoughtLog.length > 0 ? (
                       <Typewriter text={latestThoughtTitle} />
                     ) : (
                       <span className="opacity-50">
                         {turnProgress.phase === 'waiting' ? (
                           <>
                             Waiting for model
                             <span className="inline-block animate-pulse">...</span>
                           </>
                         ) : (
                           'Thinking...'
                         )}
                       </span>
                     )}
                   </div>
                 </div>
                 
                 {/* RETRY BUTTON */}
                 <button
                   onClick={() => socket?.emit('forceRetryTurn')}
                   className="absolute bottom-4 right-4 px-4 py-2 rounded-lg bg-teal-100/60 border border-teal-300/40 text-teal-800 hover:bg-teal-200 transition-colors text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100"
                   title="Force restart this turn if it hangs"
                 >
                   Force Retry
                 </button>
              </div>
            </div>
          )}
          
          {levelCompletePayload && (
            <div className="animate-in fade-in zoom-in duration-700">
              <div className="rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-8 shadow-[0_0_50px_-12px_rgba(250,204,21,0.2)] text-center">
                <div className="text-4xl mb-3">🏆</div>
                <h2 className="text-2xl font-bold text-yellow-300 font-serif">Level Complete</h2>
                <p className="mt-2 text-yellow-100/70 text-sm leading-relaxed">
                  Congratulations! You've achieved the goal for <span className="font-bold text-yellow-200">{levelCompletePayload.levelTitle}</span> in {levelCompletePayload.turnNumber} turns.
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};