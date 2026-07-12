import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cors from 'cors';

import globalErrorHandler from './middleware/errorHandler.js';
import { AppError } from './utils/appError.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoryRouter } from './modules/category/category.routes.js';
import { serviceRequestRouter } from './modules/serviceRequest/serviceRequest.routes.js';
import { skillListingRouter } from './modules/skillListing/skillListing.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { notificationRouter } from './modules/notification/notification.routes.js';
import { transactionRouter } from './modules/transaction/transaction.routes.js';
import {
  adminBookingRouter,
  bookingRouter,
} from './modules/booking/booking.routes.js';
import { reviewRouter } from './modules/review/review.routes.js';
import { conversationRouter } from './modules/message/message.routes.js';
import { matchRouter } from './modules/match/match.routes.js';
import { adminActionRouter } from './modules/adminAction/adminAction.routes.js';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:5173',
  'http://localhost:4200',
  'http://localhost:3000',
  'https://badilni.github.io',
  'https://badilni-admin.vercel.app',
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

app.set('trust proxy', 1);
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
app.use('/api/v1/transactions', transactionRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/admin/bookings', adminBookingRouter);
app.use('/api/v1/admin-actions', adminActionRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/conversations', conversationRouter);
app.use('/api/v1/matches', matchRouter);

app.use((req, res, next) => {
  next(new AppError(`Route not found!`, 404));
});

app.use(globalErrorHandler);

export default app;
