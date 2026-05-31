import crypto from 'crypto';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { User, UserDocument } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import {
  EmailCodeInput,
  EmailInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  UpdatePasswordInput,
} from './auth.schema.js';
import { Email } from '../../utils/email.js';

const hashValue = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

interface CodeEmailContext {
  user: UserDocument;
  codeType: 'verificationCode' | 'passwordResetCode';
  emailMethod: 'sendVerifyEmail' | 'sendPasswordReset';
  isNew?: boolean;
}

const generateAndSendCode = async ({
  user,
  codeType,
  emailMethod,
  isNew = false,
}: CodeEmailContext) => {
  const code = user.generateCode(codeType);
  await user.save({ validateBeforeSave: !isNew });

  try {
    await new Email(user, code)[emailMethod]();
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

export const signup = async (input: SignupInput) => {
  const { name, email, password } = input;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return { emailSent: false };
  }

  const user = new User({ name, email, password });

  try {
    await generateAndSendCode({
      user,
      codeType: 'verificationCode',
      emailMethod: 'sendVerifyEmail',
      isNew: true,
    });
  } catch {
    await user.deleteOne();
    throw new AppError(
      'EMAIL_SEND_FAILED: There was an error sending the verification email. Please try again.',
      500,
    );
  }

  return { emailSent: true };
};

export const verifyEmail = async (input: EmailCodeInput) => {
  const { email, code } = input;

  const user = await User.findOneAndUpdate(
    {
      email,
      verificationCode: hashValue(code),
      verificationCodeExpires: { $gt: Date.now() },
    },
    {
      $set: { isVerified: true },
      $unset: { verificationCode: '', verificationCodeExpires: '' },
    },
    { returnDocument: 'after' },
  );

  if (!user) {
    throw new AppError('Code is invalid or has expired', 400);
  }

  return user;
};

export const resendVerificationCode = async (input: EmailInput) => {
  const { email } = input;

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
      'EMAIL_SEND_FAILED: There was an error sending the verification email. Please try again.',
      500,
    );
  }

  return { emailSent: true };
};

export const login = async (input: LoginInput) => {
  const { email, password } = input;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password))) {
    throw new AppError('Incorrect email or password', 401);
  }

  if (!user.isVerified) {
    throw new AppError('Please verify your email before logging in', 401);
  }

  return user;
};

export const forgotPassword = async (input: EmailInput) => {
  const user = await User.findOne({ email: input.email });
  if (!user) {
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
      'EMAIL_SEND_FAILED: There was an error sending the verification email. Please try again.',
      500,
    );
  }

  return { emailSent: true };
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const { email, code, password } = input;

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
  input: UpdatePasswordInput,
) => {
  const { currentPassword, newPassword } = input;

  const user = await User.findById(userId).select('+password');
  if (!user || !(await user.correctPassword(currentPassword))) {
    throw new AppError('Password is incorrect', 401);
  }

  user.password = newPassword;

  await RefreshToken.deleteMany({ user: user._id });
  await user.save();

  return user;
};

export const logout = async (refreshToken: string) => {
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: hashValue(refreshToken) });
  }
};

export const refreshTokens = async (refreshToken: string) => {
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
