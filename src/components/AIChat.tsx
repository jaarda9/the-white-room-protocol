import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Trash2, 
  User, 
  Loader2, 
  MessageSquare,
  Brain,
  RefreshCw
} from 'lucide-react';
import { chatMemoryService, ChatMessage } from '@/lib/chat-memory-service';
import aiGatewayClient from '@/lib/ai-gateway-client';
import { getUserProfile } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { extractInstructorToDosFromMessage } from '@/lib/todo-ai';

interface AIChatProps {
  systemPrompt?: string;
  title?: string;
  placeholder?: string;
  className?: string;
}

const AIChat = ({ 
  systemPrompt = `You are The Instructor for the White Room Protocol.

Personality:
- Calm, composed, observant
- Minimal but natural
- Strategic and practical
- Subtle "Ayanokoji Kiyotaka" vibe (quiet confidence, no theatrics)

How to respond:
- Sound human and conversational, not robotic.
- Short by default (2-6 lines), but complete.
- Start naturally when appropriate (example: "Hi. How can I help?").
- Give practical advice the user can apply immediately.
- Ask only one focused follow-up question when necessary.
- Avoid rigid labels like "Clarify:" or "Next step:" unless the user asks for structure.

Memory use:
- Use prior context to stay consistent and avoid repeating yourself.
- Reference history only when useful to the current answer.`,
  title = "The Instructor",
  placeholder = "Ask The Instructor anything...",
  className = ""
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

  // Load user ID and chat history on mount
  useEffect(() => {
    const loadUserAndHistory = async () => {
      try {
        const profile = getUserProfile();
        if (profile?.id) {
          setUserId(profile.id);
          const history = await chatMemoryService.loadHistory(profile.id);
          setMessages(history);
          setMemoryStatus('synced');
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        setMemoryStatus('degraded');
        toast({
          title: 'Error',
          description: 'Failed to load conversation history',
          variant: 'destructive'
        });
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadUserAndHistory();
  }, [toast]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !userId) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message to UI immediately
    const userChatMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userChatMessage]);

    try {
      // Save user message to database
      try {
        await chatMemoryService.saveMessage(userId, 'user', userMessage);
        setMemoryStatus('synced');
      } catch {
        setMemoryStatus('degraded');
        toast({
          title: 'Memory Warning',
          description: 'Your message was sent, but failed to save to history.',
          variant: 'destructive'
        });
      }

      // Background: extract To-Do's from the subject message (non-blocking).
      // We keep failures silent to avoid interrupting chat flow, but show a toast when items are created.
      extractInstructorToDosFromMessage(userMessage)
        .then((created) => {
          if (created.length > 0) {
            toast({
              title: "To-Do's updated",
              description: `Added ${created.length} item${created.length === 1 ? '' : 's'} to today's To-Do's.`,
            });
          }
        })
        .catch(() => {});

      // Build context with conversation history
      const historyContext = chatMemoryService.formatForAI(messages, systemPrompt);
      const fullPrompt = `${historyContext}\n\nCurrent message from Subject: ${userMessage}\n\nRespond to the Subject:`;

      // Get AI response
      const response = await aiGatewayClient.complete(fullPrompt, {
        temperature: 0.45,
        maxTokens: 420
      });

      // Add AI response to UI
      const aiChatMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiChatMessage]);

      // Save AI response to database
      try {
        await chatMemoryService.saveMessage(userId, 'assistant', response);
        setMemoryStatus('synced');
      } catch {
        setMemoryStatus('degraded');
        toast({
          title: 'Memory Warning',
          description: 'AI responded, but the response failed to save to history.',
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get response',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (!userId) return;

    const confirmed = window.confirm('Are you sure you want to clear all conversation history? This cannot be undone.');
    if (!confirmed) return;

    try {
      const success = await chatMemoryService.clearHistory(userId);
      if (success) {
        setMessages([]);
        toast({
          title: 'History Cleared',
          description: 'Your conversation history has been deleted'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear history',
        variant: 'destructive'
      });
    }
  };

  const handleRefresh = async () => {
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const history = await chatMemoryService.loadHistory(userId);
      setMessages(history);
      setMemoryStatus('synced');
    } catch (error) {
      setMemoryStatus('degraded');
      toast({
        title: 'Error',
        description: 'Failed to refresh history',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <Card
      className={`flex flex-col min-h-[280px] h-[min(600px,calc(100dvh-11rem))] sm:h-[min(600px,72dvh)] ${className}`}
    >
      {/* Header — stack on narrow widths so memory sync row isn’t crushed */}
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4 border-b border-border">
        <div className="flex gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-tight truncate sm:whitespace-normal sm:break-words">{title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 shrink-0 max-w-full ${
                  memoryStatus === 'synced'
                    ? 'border-success/40 text-success'
                    : 'border-warning/40 text-warning'
                }`}
              >
                <span className="sm:hidden">{memoryStatus === 'synced' ? 'SYNCED' : 'DEGRADED'}</span>
                <span className="hidden sm:inline">
                  {memoryStatus === 'synced' ? 'MEMORY SYNCED' : 'MEMORY DEGRADED'}
                </span>
              </Badge>
              <p className="text-xs text-muted-foreground min-w-0">
                {messages.length} in memory
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 sm:justify-start sm:gap-2 shrink-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            disabled={isLoadingHistory}
            title="Refresh history"
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            title="Clear history"
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-3 sm:p-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No conversation history yet.</p>
            <p className="text-xs mt-1">Start a conversation with {title}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[min(92%,28rem)] sm:max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className="text-[10px] opacity-60 mt-1">
                    {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-border">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || !userId}
            className="min-h-[60px] max-h-[120px] resize-none w-full sm:flex-1 min-w-0"
            rows={2}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !userId}
            className="w-full sm:w-auto shrink-0 sm:self-end"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {!userId && (
          <p className="text-xs text-destructive mt-2">
            Unable to load user profile. Please refresh the page.
          </p>
        )}
      </div>
    </Card>
  );
};

export default AIChat;
