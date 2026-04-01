import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Trash2, 
  Bot, 
  User, 
  Loader2, 
  MessageSquare,
  Brain,
  RefreshCw
} from 'lucide-react';
import { chatMemoryService, ChatMessage } from '@/lib/chat-memory-service';
import chatGPTService from '@/lib/chatgpt-service';
import { getUserProfile } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface AIChatProps {
  systemPrompt?: string;
  title?: string;
  placeholder?: string;
  className?: string;
}

const AIChat = ({ 
  systemPrompt = `You are The Instructor for the White Room Protocol.

Communication style:
- Clinical
- Professional
- Minimal
- Direct
- No motivational fluff

Response rules:
- Keep responses short (2-5 lines by default).
- Use concise bullet points when useful.
- Focus on diagnosis, decision, action.
- Ask at most one clarifying question when required.
- Do not repeat obvious context.
- If uncertain, say so briefly and provide the next best step.

Memory use:
- Use prior conversation context to stay consistent and track progress.
- Reference history only when it changes the recommendation.`,
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

      // Build context with conversation history
      const historyContext = chatMemoryService.formatForAI(messages, systemPrompt);
      const fullPrompt = `${historyContext}\n\nCurrent message from Subject: ${userMessage}\n\nRespond to the Subject:`;

      // Get AI response
      const response = await chatGPTService.callChatGPT(fullPrompt, {
        temperature: 0.3,
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
    <Card className={`flex flex-col h-[600px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 ${
                  memoryStatus === 'synced'
                    ? 'border-success/40 text-success'
                    : 'border-warning/40 text-warning'
                }`}
              >
                {memoryStatus === 'synced' ? 'MEMORY SYNCED' : 'MEMORY DEGRADED'}
              </Badge>
              <p className="text-xs text-muted-foreground">
              {messages.length} messages in memory
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            disabled={isLoadingHistory}
            title="Refresh history"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            title="Clear history"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
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
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
                  <Bot className="h-4 w-4 text-primary" />
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
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || !userId}
            className="min-h-[60px] max-h-[120px] resize-none"
            rows={2}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !userId}
            className="self-end"
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
