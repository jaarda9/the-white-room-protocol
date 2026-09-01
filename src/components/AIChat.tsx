import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Trash2,
  User,
  Loader2,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { chatMemoryService, ChatMessage } from '@/lib/chat-memory-service';
import aiGatewayClient from '@/lib/ai-gateway-client';
import { getUserProfile } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { systemSound } from '@/lib/system-sound';

const sessionKey = (userId: string) => `whiteroom_instructor_session:${userId}`;
const safeParseSession = (raw: string | null): ChatMessage[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m === 'object')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
        timestamp: new Date(m.timestamp || Date.now()),
      })) as ChatMessage[];
  } catch {
    return [];
  }
};

interface AIChatProps {
  systemPrompt?: string;
  title?: string;
  placeholder?: string;
  className?: string;
}

const AIChat = ({
  systemPrompt = `You are The Architect / System Core for the Hunter Solo Leveling System.

Personality:
- Omniscient, precise, commanding, yet encouraging player growth
- Authentic Solo Leveling "System Window" tone (analytical, strategic, direct)
- Treats the user as an awakened Player/Hunter ascending the ranks
- Provides tactical conditioning advice, stat optimization strategies, and protocol guidance
- Keeps responses sharp, concise, and actionable without fluff`,
  title = 'THE ARCHITECT',
  placeholder = 'Query the System or request training guidance...',
  className = '',
}: AIChatProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<'synced' | 'degraded'>('synced');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadUserAndHistory = async () => {
      try {
        const profile = getUserProfile();
        if (profile?.id) {
          setUserId(profile.id);
          const local = safeParseSession(localStorage.getItem(sessionKey(profile.id)));
          if (local.length > 0) setMessages(local);
          const history = await chatMemoryService.loadHistory(profile.id);
          if (history.length > 0) {
            setMessages(history);
            try {
              localStorage.setItem(sessionKey(profile.id), JSON.stringify(history.slice(-80)));
            } catch {}
          }
          setMemoryStatus('synced');
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        setMemoryStatus('degraded');
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadUserAndHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !userId) return;
    systemSound.playClick();

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      localStorage.setItem(sessionKey(userId), JSON.stringify(newMessages.slice(-80)));
    } catch {}

    try {
      const historyContext = newMessages
        .slice(-10)
        .map((m) => `${m.role === 'user' ? 'Hunter' : 'System'}: ${m.content}`)
        .join('\n');

      const fullPrompt = `${systemPrompt}\n\nRecent Memory:\n${historyContext}\n\nHunter: ${userMessage.content}\nSystem:`;

      const response = await aiGatewayClient.complete(fullPrompt, {
        temperature: 0.8,
        maxTokens: 900,
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response || '[ System failed to generate response ]',
        timestamp: new Date(),
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      systemSound.playSystemChime();

      try {
        localStorage.setItem(sessionKey(userId), JSON.stringify(finalMessages.slice(-80)));
      } catch {}

      await chatMemoryService.saveMessage(userId, 'user', userMessage.content);
      await chatMemoryService.saveMessage(userId, 'assistant', assistantMessage.content);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'System Communication Error',
        description: 'Failed to reach System Core. Please retry.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (!userId) return;
    systemSound.playClick();
    try {
      await chatMemoryService.clearHistory(userId);
      localStorage.removeItem(sessionKey(userId));
      setMessages([]);
      toast({
        title: 'System Memory Purged',
        description: 'Conversation context reset to default.',
      });
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  return (
    <div className={`system-window flex flex-col h-full ${className}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between p-3 border-b border-primary/30 bg-[#061026]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 border border-primary/50 bg-primary/10 text-primary">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-display font-black text-xs sm:text-sm text-white tracking-wider system-glow-text">
              [{title}]
            </h4>
            <div className="text-[10px] font-mono text-primary/80">
              {memoryStatus === 'synced' ? 'NEURAL LINK: SYNCED' : 'NEURAL LINK: LOCAL'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            className="p-1.5 border border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-400 disabled:opacity-30 transition-colors"
            title="Purge Memory"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <ScrollArea className="flex-1 min-h-0 p-3">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full text-xs font-mono text-primary">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            [ ACCESSING MEMORY ARCHIVE... ]
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 font-mono text-xs py-8">
            <Sparkles className="w-8 h-8 text-primary/40 mb-2 animate-pulse" />
            <p className="text-white font-tech font-bold">[ SYSTEM CORE ONLINE ]</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
              State your training inquiry, query status metrics, or request protocol adjustments.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-6 h-6 border border-primary/50 bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-mono text-primary font-bold">
                      SYS
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] p-2.5 border text-xs font-mono ${
                      isUser
                        ? 'border-primary/60 bg-primary/20 text-white shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                        : 'border-purple-500/40 bg-[#070e24] text-gray-200 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed font-tech">
                      {msg.content}
                    </p>
                    <span className="text-[9px] text-gray-500 block mt-1">
                      {format(new Date(msg.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>

                  {isUser && (
                    <div className="w-6 h-6 border border-primary/50 bg-black flex items-center justify-center shrink-0 text-[10px] font-mono text-primary font-bold">
                      H
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-2.5 items-center text-xs font-mono text-primary animate-pulse p-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>[ THE ARCHITECT IS CALCULATING... ]</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Box */}
      <div className="p-2.5 border-t border-primary/30 bg-[#04091a]">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || !userId}
            className="min-h-[44px] max-h-[80px] bg-black/80 border border-primary/40 text-xs font-mono text-white resize-none p-2 focus:border-primary outline-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !userId}
            className="system-btn px-3 flex items-center justify-center disabled:opacity-30"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
