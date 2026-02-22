import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import sessionsRouter from './routes/sessions.js';
import configRouter from './routes/config.js';
import { setupSocketHandlers } from './socket/handler.js';
import { seedData } from './data/seed.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/config', configRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Create HTTP server
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setupSocketHandlers(io as never);

// Seed default data
seedData();

// Start server
httpServer.listen(PORT, () => {
  console.log(`DKA Sim API running on http://localhost:${PORT}`);
});
