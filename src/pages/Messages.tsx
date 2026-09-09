import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { systemSound } from '@/lib/system-sound';
import {
  fetchConversation,
  fetchHunters,
  fetchThreads,
  sendMessage,
  type HunterEntry,
  type MessageThread,
  type PlayerMessage,
} from '@/lib/messaging-service';

export default function Messages() {
  const navigate = useNavigate();
  const { subjectId } = useAuth();
  const userId = (subjectId || '').toUpperCase();
  const [searchParams, setSearchParams] = useSearchParams();
  const peerId = (searchParams.get('with') || '').toUpperCase();

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [hunters, setHunters] = useState<HunterEntry[]>([]);
  const [messages, setMessages] = useState<PlayerMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const nameFor = useCallback(
    (id: string) => hunters.find((h) => h.userId === id)?.fullName || `Subject ${id}`,
    [hunters]
  );

  const loadThreads = useCallback(async () => {
    if (!userId) return;
    setThreads(await fetchThreads(userId));
  }, [userId]);

  const loadConversation = useCallback(async () => {
    if (!userId || !peerId) return;
    setMessages(await fetchConversation(userId, peerId));
  }, [userId, peerId]);

  useEffect(() => {
    fetchHunters().then(setHunters);
  }, []);

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 15000);
    return () => clearInterval(t);
  }, [loadThreads]);

  useEffect(() => {
    if (!peerId) return;
    loadConversation();
    const t = setInterval(loadConversation, 8000);
    return () => clearInterval(t);
  }, [peerId, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const directory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hunters
      .filter((h) => h.userId && h.userId !== userId)
      .filter((h) => !q || h.fullName.toLowerCase().includes(q) || h.userId.toLowerCase().includes(q))
      .slice(0, 40);
  }, [hunters, query, userId]);

  const openThread = (id: string) => {
    systemSound.playClick();
    setSearchParams({ with: id });
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !peerId || !userId || sending) return;
    setSending(true);
    const optimistic: PlayerMessage = {
      from: userId,
      to: peerId,
      content: text,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    systemSound.playClick();
    const ok = await sendMessage(userId, peerId, text);
    setSending(false);
    if (ok) {
      loadConversation();
      loadThreads();
    }
  };

  const shell =
    'relative max-w-md w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono';

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex items-center justify-center px-3 sm:px-6 pt-8 pb-36 system-blueprint-bg">
      <div className={shell}>
        <div className="text-center mb-4">
          <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-1.5">
            <h1 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
              {peerId ? 'TRANSMISSION' : 'HUNTER COMMS'}
            </h1>
          </div>
          <p className="text-[10px] sm:text-xs font-mono text-white/70">
            {peerId ? `[ ${nameFor(peerId)} ]` : '[Encrypted hunter-to-hunter channel]'}
          </p>
        </div>

        <button
          onClick={() => {
            systemSound.playClick();
            if (peerId) setSearchParams({});
            else navigate('/?view=records');
          }}
          className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 border border-white/40 bg-[#061426]/70 text-[10px] text-[#9fd3ff] hover:bg-white/10 hover:border-white transition-all"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>{peerId ? '[ CHANNELS ]' : '[ RECORDS ]'}</span>
        </button>

        {!peerId && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] tracking-[0.2em] text-white/50 mb-1.5">ACTIVE CHANNELS</div>
              <div className="flex flex-col divide-y divide-white/10 border border-white/30 rounded-[2px]">
                {threads.length === 0 && (
                  <div className="px-3 py-3 text-[11px] text-white/50">No transmissions yet.</div>
                )}
                {threads.map((t) => (
                  <button
                    key={t.peerId}
                    onClick={() => openThread(t.peerId)}
                    className="flex items-center gap-2 px-3 py-2.5 text-left bg-[#061424]/60 hover:bg-white/10 transition-all group"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-xs sm:text-sm font-semibold text-white group-hover:text-[#9fd3ff]">
                        {nameFor(t.peerId)}
                      </span>
                      <span className="block truncate text-[10px] text-white/50">
                        {t.lastFrom === userId ? 'You: ' : ''}
                        {t.lastMessage}
                      </span>
                    </span>
                    {t.unread > 0 && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 border border-cyan-400/70 text-cyan-300 bg-cyan-400/10">
                        {t.unread} NEW
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] tracking-[0.2em] text-white/50 mb-1.5">HUNTER DIRECTORY</div>
              <div className="flex items-center gap-2 px-2 py-1.5 border border-white/30 bg-[#061424]/60 mb-2">
                <Search className="w-3.5 h-3.5 text-[#9fd3ff]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search hunters..."
                  className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-white/35"
                />
              </div>
              <div className="max-h-56 overflow-y-auto flex flex-col divide-y divide-white/10 border border-white/30 rounded-[2px]">
                {directory.length === 0 && (
                  <div className="px-3 py-3 text-[11px] text-white/50">No hunters found.</div>
                )}
                {directory.map((h) => (
                  <button
                    key={h.userId}
                    onClick={() => openThread(h.userId)}
                    className="flex items-center gap-2 px-3 py-2 text-left bg-[#061424]/60 hover:bg-white/10 transition-all group"
                  >
                    <span className="flex-1 min-w-0 truncate text-xs text-white group-hover:text-[#9fd3ff]">
                      {h.fullName}
                    </span>
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 border border-white/30 text-[#9fd3ff] bg-black/50">
                      LV.{h.level}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {peerId && (
          <div className="space-y-3">
            <div className="h-[45vh] min-h-[240px] overflow-y-auto border border-white/30 bg-[#061424]/60 p-2.5 space-y-2 rounded-[2px]">
              {messages.length === 0 && (
                <div className="text-[11px] text-white/50 text-center py-6">
                  No transmissions in this channel.
                </div>
              )}
              {messages.map((m, i) => {
                const mine = m.from === userId;
                return (
                  <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-2.5 py-1.5 text-[11px] sm:text-xs border rounded-[2px] break-words ${
                        mine
                          ? 'border-cyan-400/50 bg-cyan-400/10 text-white'
                          : 'border-white/25 bg-white/5 text-white/90'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className="mt-1 text-[9px] text-white/40">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Transmit message..."
                className="flex-1 px-2.5 py-2 bg-[#061424]/70 border border-white/30 text-xs text-white outline-none focus:border-white/70 placeholder:text-white/35"
              />
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                className="px-3 py-2 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] hover:bg-white/10 hover:border-white disabled:opacity-40 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
