import { IUser, UserDocument } from '../models/userModel.ts';

declare global {
  namespace Express {
    interface Request {
      user?: IUser | UserDocument;
    }
  }
}
