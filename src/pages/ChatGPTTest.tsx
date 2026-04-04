import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import aiGatewayClient from '@/lib/ai-gateway-client';
import { useToast } from '@/hooks/use-toast';

const ChatGPTTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('Hello! Can you tell me a short joke?');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    basicTest?: boolean;
    jsonTest?: boolean;
    error?: string;
  }>({});

  const handleTest = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      const result = await aiGatewayClient.complete(prompt, {
        temperature: 0.7,
        maxTokens: 6000, // Increased significantly to prevent MAX_TOKENS truncation
      });
      setResponse(result);
      toast({
        title: 'Success!',
        description: 'ChatGPT API is working correctly',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: `Failed to get response: ${errorMessage}`,
        variant: 'destructive',
      });
      console.error('ChatGPT error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJSONTest = async () => {
    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      interface TestResponse {
        status: string;
        message: string;
        timestamp: string;
      }

      const result = await aiGatewayClient.completeJson<TestResponse>(
        'Return a JSON object with: status ("success"), message ("ChatGPT is working!"), and timestamp (current time as string)',
        {
          temperature: 0.7,
          maxTokens: 6000, // Increased significantly to prevent MAX_TOKENS truncation
        }
      );

      setResponse(JSON.stringify(result, null, 2));
      setTestResults(prev => ({ ...prev, jsonTest: true }));
      toast({
        title: 'Success!',
        description: 'JSON response test passed',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setTestResults(prev => ({ ...prev, error: errorMessage }));
      toast({
        title: 'Error',
        description: `JSON test failed: ${errorMessage}`,
        variant: 'destructive',
      });
      console.error('ChatGPT JSON error:', err);
    } finally {
      setLoading(false);
    }
  };

  const runBasicTest = async () => {
    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      const result = await aiGatewayClient.complete('Say "Test successful" if you can read this.', {
        temperature: 0.7,
        maxTokens: 6000, // Increased significantly to prevent MAX_TOKENS truncation
      });

      const success = result.toLowerCase().includes('test successful') || result.toLowerCase().includes('successful');
      setResponse(result);
      setTestResults(prev => ({ ...prev, basicTest: success }));
      
      if (success) {
        toast({
          title: 'Basic Test Passed!',
          description: 'ChatGPT API is responding correctly',
        });
      } else {
        toast({
          title: 'Test Completed',
          description: 'Got response but format unexpected',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setTestResults(prev => ({ ...prev, basicTest: false, error: errorMessage }));
      toast({
        title: 'Test Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="font-mono-data">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Return
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ChatGPT Integration Test</h1>
              <p className="text-xs text-muted-foreground font-mono-data mt-0.5">
                Test your ChatGPT API integration on Vercel
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Status Card */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Test Status</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {testResults.basicTest === true ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : testResults.basicTest === false ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <div className="h-5 w-5" />
                )}
                <span>Basic Connection Test</span>
                {testResults.basicTest !== undefined && (
                  <Badge variant={testResults.basicTest ? 'default' : 'destructive'}>
                    {testResults.basicTest ? 'Passed' : 'Failed'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {testResults.jsonTest === true ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : testResults.jsonTest === false ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <div className="h-5 w-5" />
                )}
                <span>JSON Response Test</span>
                {testResults.jsonTest !== undefined && (
                  <Badge variant={testResults.jsonTest ? 'default' : 'destructive'}>
                    {testResults.jsonTest ? 'Passed' : 'Failed'}
                  </Badge>
                )}
              </div>
              {testResults.error && (
                <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
                  Error: {testResults.error}
                </div>
              )}
            </div>
          </Card>

          {/* Quick Tests */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Tests</h2>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={runBasicTest} disabled={loading} variant="outline">
                Run Basic Test
              </Button>
              <Button onClick={handleJSONTest} disabled={loading} variant="outline">
                Test JSON Response
              </Button>
            </div>
          </Card>

          {/* Custom Prompt Test */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Custom Prompt Test</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Enter your prompt:</label>
                <Textarea
                  placeholder="Enter your prompt here..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  disabled={loading}
                />
              </div>
              <Button onClick={handleTest} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Send Prompt'
                )}
              </Button>
            </div>
          </Card>

          {/* Response Display */}
          {(response || error) && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                {error ? 'Error Response' : 'API Response'}
              </h2>
              <div className="p-4 bg-muted rounded-md">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {error || response}
                </pre>
              </div>
            </Card>
          )}

          {/* Instructions */}
          <Card className="p-6 bg-muted/50">
            <h2 className="text-lg font-semibold mb-2">How to Test</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Click "Run Basic Test" to verify the API connection works</li>
              <li>Click "Test JSON Response" to verify JSON parsing works</li>
              <li>Enter a custom prompt and click "Send Prompt" to test with your own message</li>
              <li>Check the response to confirm ChatGPT is working correctly</li>
            </ol>
            <div className="mt-4 p-3 bg-background rounded border border-border">
              <p className="text-xs font-mono text-muted-foreground">
                <strong>API Endpoint:</strong> /api/ai (legacy: /api/chatgpt)
              </p>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                <strong>Environment:</strong> {import.meta.env.MODE === 'production' ? 'Production (Vercel)' : 'Development'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatGPTTest;

