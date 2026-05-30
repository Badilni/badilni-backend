import { Types } from 'mongoose';
import { Request, Response, CookieOptions } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/refreshTokenModel.js';
import { UserDocument } from '../models/userModel.js';

type TokenType = 'access' | 'refresh';

const signTokens = (id: string | Types.ObjectId, email: string) => {
  const accessToken = jwt.sign(
    { id: id.toString(), email },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: process.env
        .ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
  const refreshToken = crypto.randomBytes(40).toString('hex');

  return [accessToken, refreshToken];
};

const tokenCookieOptions = (
  tokenType: TokenType,
  req: Request,
): CookieOptions => {
  let expires;

  switch (tokenType) {
    case 'access':
      expires = new Date(
        Date.now() + +process.env.ACCESS_TOKEN_COOKIE_EXPIRES_IN! * 60 * 1000,
      );
      break;
    case 'refresh':
      expires = new Date(
        Date.now() +
          +process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN! * 24 * 60 * 60 * 1000,
      );
      break;
    default:
      break;
  }

  const secure = req
    ? req.secure || req.headers['x-forwarded-proto'] === 'https'
    : process.env.NODE_ENV === 'production';

  return {
    expires,
    secure,
    httpOnly: true,
  };
};

const createSendTokens = async (
  user: UserDocument,
  statusCode: number,
  res: Response,
) => {
  const req = res.req;
  const [accessToken, refreshToken] = signTokens(user._id, user.email);

  const accessTokenCookieOptions = tokenCookieOptions('access', req);
  // if (process.env.NODE_ENV === 'production') accessTokenCookieOptions.secure = true;
  res.cookie('accessToken', accessToken, accessTokenCookieOptions);

  const refreshTokenCookieOptions = tokenCookieOptions('refresh', req);
  res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

  await RefreshToken.create({
    user: user._id,
    token: refreshToken,
  });

  res
    .status(statusCode)
    .json({ status: 'success', accessToken, data: { user } });
};

export { createSendTokens };
