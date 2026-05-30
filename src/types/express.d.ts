import type { UserDocument } from '../models/userModel.ts';

declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}
