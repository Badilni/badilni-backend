import { Server as HttpServer } from 'http';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';

let io: Server | undefined;

const userRoom = (userId: string) => `user:${userId}`;

export const initSocket = (httpServer: HttpServer) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'http://localhost:5173',
    'http://localhost:4200',
    'http://localhost:3000',
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET!,
      ) as JwtPayload & { id: string };

      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));

    socket.on('disconnect', () => {
      socket.leave(userRoom(userId));
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  if (!io) {
    return;
  }
  io.to(userRoom(userId)).emit(event, payload);
};
