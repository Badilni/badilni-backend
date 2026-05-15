import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/refreshTokenModel.js';

const signTokens = (id, email) => {
  const accessToken = jwt.sign({ id, email }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
  });
  // const refreshToken = jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
  //   expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
  // });
  const refreshToken = crypto.randomBytes(40).toString('hex');

  return [accessToken, refreshToken];
};

const tokenCookieOptions = (tokenType) => {
  let expires;

  switch (tokenType) {
    case 'access':
      expires = new Date(
        Date.now() + process.env.ACCESS_TOKEN_COOKIE_EXPIRES_IN * 60 * 1000,
      );
      break;
    case 'refresh':
      expires = new Date(
        Date.now() +
          process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
      );
      break;
    default:
      break;
  }

  return {
    expires,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    httpOnly: true,
  };
};

const createSendTokens = async (user, statusCode, res) => {
  const [accessToken, refreshToken] = signTokens(user._id, user.email);

  const accessTokenCookieOptions = tokenCookieOptions('access');
  // if (process.env.NODE_ENV === 'production') accessTokenCookieOptions.secure = true;
  res.cookie('accessToken', accessToken, accessTokenCookieOptions);

  const refreshTokenCookieOptions = tokenCookieOptions('refresh');
  res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

  await RefreshToken.create({
    user: user._id,
    token: refreshToken,
  });

  user.password = undefined;

  res
    .status(statusCode)
    .json({ status: 'success', accessToken, data: { user } });
};

export { createSendTokens };
