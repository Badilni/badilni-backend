import crypto from 'crypto';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { User, UserDocument } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import {
  EmailCodeInput,
  EmailInput,
  LoginInput,
  RequestEmailChangeInput,
  ResetPasswordInput,
  SignupInput,
  UpdatePasswordInput,
  VerifyEmailChangeInput,
} from './auth.schema.js';
import { Email } from '../../utils/email.js';
import { CodeEmailContext } from './auth.types.js';
import mongoose from 'mongoose';
import { creditWelcomeBonus } from '../transaction/transaction.service.js';
import { notifyWelcomeBonus } from '../notification/notification.service.js';

const hashValue = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const generateAndSendCode = async ({
  user,
  codeType,
  emailMethod,
  isNew = false,
  toEmail = 'email',
}: CodeEmailContext) => {
  const code = user.generateCode(codeType);
  await user.save({ validateBeforeSave: !isNew });

  try {
    await new Email(user, code, toEmail)[emailMethod]();
  } catch (err) {
    if (isNew) {
      await user.deleteOne();
    } else {
      user[codeType] = undefined;
      user[`${codeType}Expires`] = undefined;
      await user.save({ validateBeforeSave: false });
    }
    throw err;
  }
};

export const signup = async (data: SignupInput) => {
  const { name, email, password } = data;
  let user = await User.findOne({ email });

  if (user) {
    if (user.isVerified) {
      return { emailSent: false };
    }

    user.name = name;
    user.password = password;
  } else {
    user = new User({ name, email, password });
  }

  try {
    await generateAndSendCode({
      user,
      codeType: 'verificationCode',
      emailMethod: 'sendVerifyEmail',
      isNew: !user._id,
    });
  } catch {
    throw new AppError(
      'There was an error sending the verification email. Please try again.',
      500,
    );
  }

  return { emailSent: true };
};

export const verifyEmail = async (data: EmailCodeInput) => {
  const { email, code } = data;

  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  const session = await mongoose.startSession();
  let user: UserDocument | null = null;

  try {
    await session.withTransaction(async () => {
      user = await User.findOneAndUpdate(
        {
          email,
          verificationCode: hashedCode,
          verificationCodeExpires: { $gt: Date.now() },
        },
        {
          $set: { isVerified: true },
          $unset: { verificationCode: '', verificationCodeExpires: '' },
        },
        { returnDocument: 'after', session },
      );

      // If the code was wrong, expired, or already used, user is null
      if (!user) {
        throw new AppError('Code is invalid or has expired', 400);
      }

      // Credit the welcome bonus safely using the freshly found user's ID
      await creditWelcomeBonus(user._id.toString(), session);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to verify email', 500);
  } finally {
    session.endSession();
  }

  // Best-effort notification, fires after commit, using the verified user instance
  notifyWelcomeBonus({ userId: user!._id.toString(), amount: 3 });

  return user!;
};

export const resendVerificationCode = async (data: EmailInput) => {
  const { email } = data;

  const user = await User.findOne({ email, isVerified: false });
  if (!user) {
    return { emailSent: false };
  }

  try {
    await generateAndSendCode({
      user,
      codeType: 'verificationCode',
      emailMethod: 'sendVerifyEmail',
    });
  } catch {
    throw new AppError(
      'There was an error sending the verification email. Please try again.',
      500,
    );
  }

  return { emailSent: true };
};

export const login = async (data: LoginInput) => {
  const { email, password } = data;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password))) {
    throw new AppError('Incorrect email or password', 401);
  }

  if (!user.isVerified) {
    throw new AppError('Please verify your email before logging in', 401);
  }

  return user;
};

export const forgotPassword = async (data: EmailInput) => {
  const user = await User.findOne({ email: data.email });
  if (!user || !user.isVerified) {
    return { emailSent: false };
  }

  try {
    await generateAndSendCode({
      user,
      codeType: 'passwordResetCode',
      emailMethod: 'sendPasswordReset',
    });
  } catch {
    throw new AppError(
      'There was an error sending the verification email. Please try again.',
      500,
    );
  }

  return { emailSent: true };
};

export const resetPassword = async (data: ResetPasswordInput) => {
  const { email, code, password } = data;

  const user = await User.findOne({
    email,
    passwordResetCode: hashValue(code),
    passwordResetCodeExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError('Code is invalid or has expired', 400);
  }

  user.password = password;
  user.passwordResetCode = undefined;
  user.passwordResetCodeExpires = undefined;

  await RefreshToken.deleteMany({ user: user._id });
  await user.save();

  return user;
};

export const updatePassword = async (
  userId: string,
  data: UpdatePasswordInput,
) => {
  const { currentPassword, newPassword } = data;

  const user = await User.findById(userId).select('+password');
  if (!user || !(await user.correctPassword(currentPassword))) {
    throw new AppError('Password is incorrect', 401);
  }

  user.password = newPassword;

  await RefreshToken.deleteMany({ user: user._id });
  await user.save();

  return user;
};

export const requestEmailChange = async (
  userId: string,
  data: RequestEmailChangeInput,
) => {
  const { currentPassword, newEmail } = data;

  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (!(await user.correctPassword(currentPassword))) {
    throw new AppError('Incorrect password', 401);
  }
  if (user.email.toLowerCase() === newEmail.toLowerCase()) {
    throw new AppError(
      'New email must be different from your current email',
      400,
    );
  }

  const existingNewEmailUser = await User.findOne({ email: newEmail });
  if (existingNewEmailUser) {
    return { emailSent: false };
  }

  user.pendingEmail = newEmail;

  try {
    await generateAndSendCode({
      user,
      codeType: 'pendingEmailCode',
      emailMethod: 'sendVerifyPendingEmail',
      isNew: false,
      toEmail: 'pendingEmail',
    });
  } catch {
    throw new AppError(
      'There was an error sending the verification email. Please try again.',
      500,
    );
  }

  return { emailSent: true };
};

export const verifyEmailChange = async (
  userId: string,
  data: VerifyEmailChangeInput,
) => {
  const session = await mongoose.startSession();

  let user: UserDocument | null = null;
  try {
    await session.withTransaction(async () => {
      user = await User.findOneAndUpdate(
        {
          _id: userId,
          pendingEmail: { $exists: true, $ne: null },
          pendingEmailCode: hashValue(data.code),
          pendingEmailCodeExpires: { $gt: Date.now() },
        },
        [
          {
            $set: {
              email: '$pendingEmail',
            },
          },
          {
            $unset: [
              'pendingEmail',
              'pendingEmailCode',
              'pendingEmailCodeExpires',
            ],
          },
        ],
        {
          updatePipeline: true,
          returnDocument: 'before',
          session,
        },
      );

      if (!user) {
        throw new AppError('Code is invalid or has expired', 400);
      }

      await RefreshToken.deleteMany({ user: userId }, { session });
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to verify email change', 500);
  } finally {
    session.endSession();
  }

  try {
    await new Email(user!).sendEmailChangedNotification();
  } catch (emailError) {
    console.error('Non-fatal: Failed to send email update alert.', emailError);
  }

  const updatedUser = { ...user!.toObject(), email: user!.pendingEmail };
  delete updatedUser.pendingEmail;
  return updatedUser;
};

export const logout = async (refreshToken: string) => {
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: hashValue(refreshToken) });
  }
};

export const refreshTokens = async (refreshToken: string | undefined) => {
  if (!refreshToken) {
    throw new AppError('Invalid or expired token', 401);
  }

  const existingToken = await RefreshToken.findOneAndDelete({
    token: hashValue(refreshToken),
  });
  if (!existingToken) {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findById(existingToken.user);
  if (!user) {
    throw new AppError(
      'The user belonging to this token does no longer exist',
      401,
    );
  }

  return user;
};
