import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { SOCKET_EVENTS, NotificationPayload } from './socket.types.js';

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
        'http://localhost:5173',
        'http://localhost:4200',
        'http://localhost:3000',
      ],
      credentials: true,
    },
  });

  // Auth middleware — verify JWT on every socket connection
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: no token provided'));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET!,
      ) as JwtPayload & { id: string };

      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error('Authentication error: invalid token'));
    }
  });

  io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
    const userId = socket.data.userId as string;

    // Each user joins their own private room
    socket.join(userId);

    console.log(`[Socket] User ${userId} connected — socket ${socket.id}`);

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      console.log(`[Socket] User ${userId} disconnected — socket ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Emit to a specific user by their userId (room name = userId)
export const emitToUser = (
  userId: string,
  event: string,
  payload: NotificationPayload | Record<string, unknown>,
): void => {
  try {
    getIO().to(userId).emit(event, payload);
  } catch (err) {
    console.error(`[Socket] Failed to emit ${event} to user ${userId}:`, err);
  }
};
