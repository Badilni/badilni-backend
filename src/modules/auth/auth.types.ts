import { UserDocument } from '../../models/user.model.js';

export type CodeType =
  | 'verificationCode'
  | 'passwordResetCode'
  | 'pendingEmailCode';

export type EmailMethod =
  | 'sendVerifyEmail'
  | 'sendPasswordReset'
  | 'sendVerifyPendingEmail';

export interface CodeEmailContext {
  user: UserDocument;
  codeType: CodeType;
  emailMethod: EmailMethod;
  isNew?: boolean;
  toEmail?: 'email' | 'pendingEmail';
}
