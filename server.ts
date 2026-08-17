import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// API Handlers
import aiHandler from './api/ai';
import syncHandler from './api/sync';
import chatHistoryHandler from './api/chat-history';
import leaderboardHandler from './api/leaderboard';
import skillforgePlansHandler from './api/skillforge-plans';
import skillforgeTasksHandler from './api/skillforge-tasks';
import skillforgeCompleteTaskHandler from './api/skillforge-complete-learning-task';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // API Routes
  app.all('/api/ai', (req, res) => aiHandler(req as any, res as any));
  app.all('/api/chatgpt', (req, res) => aiHandler(req as any, res as any));
  app.all('/api/sync', (req, res) => syncHandler(req as any, res as any));
  app.all('/api/chat-history', (req, res) => chatHistoryHandler(req as any, res as any));
  app.all('/api/leaderboard', (req, res) => leaderboardHandler(req as any, res as any));
  app.all('/api/skillforge-plans', (req, res) => skillforgePlansHandler(req as any, res as any));
  app.all('/api/skillforge-tasks', (req, res) => skillforgeTasksHandler(req as any, res as any));
  app.all('/api/skillforge-complete-learning-task', (req, res) => skillforgeCompleteTaskHandler(req as any, res as any));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware for dev or static for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The White Room server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
