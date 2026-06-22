import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cors from 'cors';

import globalErrorHandler from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoryRouter } from './modules/category/category.routes.js';
import { serviceRequestRouter } from './modules/serviceRequest/serviceRequest.routes.js';
import { skillListingRouter } from './modules/skillListing/skillListing.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { notificationRouter } from './modules/notification/notification.routes.js';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:5173',
  'http://localhost:4200',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }),
);

app.use(helmet());

app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.set('query parser', 'extended');

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
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/skill-listings', skillListingRouter);
app.use('/api/v1/service-requests', serviceRequestRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/notifications', notificationRouter);

app.use(globalErrorHandler);

export default app;
