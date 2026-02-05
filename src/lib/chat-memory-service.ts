/**
 * Chat Memory Service - Handles persistent conversation history
 * Stores chat messages in MongoDB per user
 */

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

class ChatMemoryService {
  private apiUrl = '/api/chat-history';

  /**
   * Load chat history for a user
   */
  async loadHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const response = await fetch(
        `${this.apiUrl}?userId=${encodeURIComponent(userId)}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`Failed to load chat history: ${response.status}`);
      }

      const data = await response.json();
      return (data.messages || []).map((msg: any) => ({
        id: msg._id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Error loading chat history:', error);
      return [];
    }
  }

  /**
   * Save a message to chat history
   */
  async saveMessage(
    userId: string, 
    role: 'user' | 'assistant', 
    content: string
  ): Promise<ChatMessage | null> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          role,
          message: content
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save message: ${response.status}`);
      }

      const data = await response.json();
      return {
        id: data.messageId,
        role: data.message.role,
        content: data.message.content,
        timestamp: new Date(data.message.timestamp)
      };
    } catch (error) {
      console.error('Error saving chat message:', error);
      return null;
    }
  }

  /**
   * Clear chat history for a user
   */
  async clearHistory(userId: string): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error(`Failed to clear history: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }
  }

  /**
   * Format messages for AI context (includes full history)
   */
  formatForAI(messages: ChatMessage[], systemPrompt?: string): string {
    let context = systemPrompt || '';
    
    if (messages.length > 0) {
      context += '\n\n=== Previous Conversation ===\n';
      messages.forEach(msg => {
        const role = msg.role === 'user' ? 'Subject' : 'AI';
        context += `${role}: ${msg.content}\n\n`;
      });
      context += '=== End Previous Conversation ===\n\n';
    }
    
    return context;
  }
}

export const chatMemoryService = new ChatMemoryService();
