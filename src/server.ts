import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import './config/config.js';

import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';
import { initSocket } from './socket/socket.js';

process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

let server: http.Server;

try {
  await mongoose.connect(
    process.env
      .DB_URI!.replace('<db_username>', process.env.DB_USERNAME!)
      .replace('<db_password>', process.env.DB_PASSWORD!),
  );
  console.log('DB connected!');

  // Create HTTP server from Express app, then attach Socket.io
  server = http.createServer(app);
  initSocket(server);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`Server listening on port ${PORT}!`));
} catch (error) {
  console.error(error);
  process.exit(1);
}

process.on('unhandledRejection', (err: Error) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server?.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED. Shutting down gracefully');
  server?.close(() => console.log('Process terminated'));
});
