/**
 * Example component demonstrating ChatGPT integration
 * This is a reference implementation - you can use chatGPTService in any component
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import chatGPTService from '@/lib/chatgpt-service';
import { useToast } from '@/hooks/use-toast';

export function ChatGPTExample() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      const result = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });
      setResponse(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: `Failed to get response: ${errorMessage}`,
        variant: 'destructive',
      });
      console.error('ChatGPT error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJSONExample = async () => {
    setLoading(true);
    setResponse('');

    try {
      interface ExampleResponse {
        message: string;
        items: string[];
        count: number;
      }

      const result = await chatGPTService.callChatGPTJSON<ExampleResponse>(
        'Return a JSON object with: message (a greeting), items (array of 3 fruits), and count (number of items)',
        {
          temperature: 0.7,
          maxTokens: 200,
        }
      );

      setResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: `Failed to get JSON response: ${errorMessage}`,
        variant: 'destructive',
      });
      console.error('ChatGPT JSON error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-2">ChatGPT Integration Example</h2>
        <p className="text-muted-foreground">
          This component demonstrates how to use the ChatGPT service in your application.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Enter your prompt here..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
        />
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Loading...' : 'Send Prompt'}
          </Button>
          <Button onClick={handleJSONExample} disabled={loading} variant="outline">
            JSON Example
          </Button>
        </div>
      </div>

      {response && (
        <div className="space-y-2">
          <h3 className="font-semibold">Response:</h3>
          <div className="p-4 bg-muted rounded-md">
            <pre className="whitespace-pre-wrap text-sm">{response}</pre>
          </div>
        </div>
      )}
    </Card>
  );
}

