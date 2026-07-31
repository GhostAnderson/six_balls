import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './RoomManager';
import { processInput, createInitialGameState } from './GameEngine';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const roomManager = new RoomManager();

// Basic health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Socket connection
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create room
  socket.on('createRoom', () => {
    const playerId = socket.id;
    const code = roomManager.createRoom(playerId, socket.id);
    socket.join(code);
    socket.emit('roomCreated', { code });
    console.log(`Room created: ${code} by ${playerId}`);
  });

  // Join room
  socket.on('joinRoom', ({ code }: { code: string }) => {
    const playerId = socket.id;
    const success = roomManager.joinRoom(code.toUpperCase(), playerId, socket.id);

    if (!success) {
      socket.emit('joinError', { message: 'Room not found or full' });
      return;
    }

    socket.join(code);
    socket.emit('roomJoined', { code });
    io.to(code).emit('playerJoined', { playerCount: 2 });
    console.log(`Player ${playerId} joined room ${code}`);
  });

  // Player ready
  socket.on('playerReady', () => {
    const playerId = roomManager.getPlayerIdBySocket(socket.id);
    if (!playerId) return;

    roomManager.setReady(playerId);
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    if (roomManager.isAllReady(room.code)) {
      const gameState = createInitialGameState(room.players[0], room.players[1]);
      room.gameState = gameState;
      for (const [sockId, pid] of room.socketToPlayer) {
        io.to(sockId).emit('gameStart', { gameState, playerId: pid });
      }
    }
  });

  // Player input
  socket.on('playerInput', ({ action }: { action: string }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room || !room.gameState) return;
    const playerId = roomManager.getPlayerIdBySocket(socket.id);
    if (!playerId) return;
    room.gameState = processInput(room.gameState, playerId, action as any);
    io.to(room.code).emit('gameStateUpdate', { gameState: room.gameState });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const playerId = roomManager.getPlayerIdBySocket(socket.id);
    if (playerId) {
      const code = roomManager.leaveRoom(playerId);
      if (code) {
        io.to(code).emit('playerLeft', { message: 'Opponent disconnected' });
      }
    }
    console.log(`Player disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
