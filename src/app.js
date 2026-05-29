import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';

import globalErrorHandler from './middleware/errorHandler.js';
import { authRouter } from './routes/authRoutes.js';

const app = express();

app.use(helmet());

app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    ...Object.getOwnPropertyDescriptor(req, 'query'),
    value: req.query,
    writable: true,
  });
  next();
});

app.use(mongoSanitize());

app.use('/api/v1/auth', authRouter);

app.use(globalErrorHandler);

export default app;
