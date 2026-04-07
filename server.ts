import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveTurn } from './src/services/engine.ts';
import { GameState, ChatMessage, ClientToServerEvents, ServerToClientEvents } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' }
  });

  const PORT = 3000;

  // Global Game State
  let gameState: GameState = {
    environment: {
      title: "The Chasm's Edge",
      description: "You stand on the precipice of a massive, seemingly bottomless chasm. A rickety wooden house sits behind you. The wind howls, carrying whispers from the depths.",
      exits: ["Enter the wooden house", "Scale down the cliff face", "Explore the perimeter"]
    },
    players: {},
    turnNumber: 1,
    isResolving: false,
  };

  let chatHistory: ChatMessage[] = [];

  const broadcastState = () => {
    io.emit('gameState', gameState);
  };

  const addChatMessage = (msg: ChatMessage) => {
    chatHistory.push(msg);
    if (chatHistory.length > 100) chatHistory.shift();
    io.emit('chatMessage', msg);
  };

  const checkAndResolveTurn = async () => {
    if (gameState.isResolving) return;

    const activePlayers = Object.values(gameState.players);
    if (activePlayers.length === 0) return;

    const allLockedIn = activePlayers.every(p => p.isLockedIn);
    
    if (allLockedIn) {
      gameState.isResolving = true;
      broadcastState();

      addChatMessage({
        id: Date.now().toString(),
        type: 'system',
        text: 'All players locked in. Resolving turn...',
        timestamp: Date.now()
      });

      const actions = activePlayers.map(p => ({
        playerId: p.id,
        action: p.lastAction || 'Wait'
      }));

      const { newState, narrative } = await resolveTurn(gameState, actions);
      
      gameState = newState;
      
      // Reset locks
      Object.values(gameState.players).forEach(p => {
        p.isLockedIn = false;
        p.lastAction = undefined;
      });

      addChatMessage({
        id: Date.now().toString() + '-narrative',
        type: 'narrative',
        text: narrative,
        timestamp: Date.now()
      });

      broadcastState();
    }
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send initial state
    socket.emit('gameState', gameState);
    socket.emit('narrativeLog', chatHistory);

    socket.on('join', (name) => {
      console.log('Player joining:', name, 'Socket ID:', socket.id);
      const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
      const color = colors[Object.keys(gameState.players).length % colors.length];

      gameState.players[socket.id] = {
        id: socket.id,
        name: name || `Traveler ${socket.id.substring(0, 4)}`,
        inventory: [
          { id: 'sandals', name: 'Worn Sandals', description: 'Basic footwear', color: '#8B4513', slot: 'feet' },
          { id: 'tunic', name: 'Linen Tunic', description: 'A simple shirt', color: '#D2B48C', slot: 'body' }
        ],
        equipped: { feet: 'sandals', body: 'tunic' },
        isLockedIn: false,
        color
      };

      addChatMessage({
        id: Date.now().toString(),
        type: 'system',
        text: `${gameState.players[socket.id].name} has joined the world.`,
        timestamp: Date.now()
      });

      broadcastState();
    });

    socket.on('chat', (text) => {
      const player = gameState.players[socket.id];
      if (!player) return;

      addChatMessage({
        id: Date.now().toString() + Math.random(),
        type: 'chat',
        text,
        author: player.name,
        authorColor: player.color,
        timestamp: Date.now()
      });
    });

    socket.on('lockAction', (action) => {
      const player = gameState.players[socket.id];
      if (!player || gameState.isResolving) return;

      player.lastAction = action;
      player.isLockedIn = true;
      
      addChatMessage({
        id: Date.now().toString() + Math.random(),
        type: 'system',
        text: `${player.name} has locked in their action.`,
        timestamp: Date.now()
      });

      broadcastState();
      checkAndResolveTurn();
    });

    socket.on('equip', (itemId, slot) => {
       const player = gameState.players[socket.id];
       if (!player || gameState.isResolving) return;
       
       // Basic validation
       const item = player.inventory.find(i => i.id === itemId);
       if (item && (item.slot === slot || item.slot === 'none' || slot === 'none')) {
           if (slot === 'none') {
               // Unequip logic would go here, simplified for MVP
           } else {
               player.equipped[slot as keyof typeof player.equipped] = itemId;
           }
           broadcastState();
       }
    });

    socket.on('disconnect', () => {
      const player = gameState.players[socket.id];
      if (player) {
        addChatMessage({
          id: Date.now().toString(),
          type: 'system',
          text: `${player.name} has vanished into the ether.`,
          timestamp: Date.now()
        });
        delete gameState.players[socket.id];
        broadcastState();
        checkAndResolveTurn(); // In case we were waiting on them
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.NODE_ENV === "production" 
      ? path.join(__dirname) // If running from dist/server.js, dist is the current dir
      : path.join(__dirname, 'dist'); // If running from root (dev), dist is in ./dist
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
