import './config/config.js';

import mongoose from 'mongoose';
import app from './app.js';

let server;
try {
  await mongoose.connect(
    process.env.DB_URI.replace(
      '<db_username>',
      process.env.DB_USERNAME,
    ).replace('<db_password>', process.env.DB_PASSWORD),
  );
  console.log('DB connected!');

  const PORT = process.env.PORT || 3000;
  server = app.listen(PORT, () =>
    console.log(`Server listening on port ${PORT}!`),
  );
} catch (error) {
  console.log(error);
}

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message);
  console.log(err);

  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  console.log(err);

  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
