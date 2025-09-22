import { Tokens } from 'app-request';
import { AuthFailureError, InternalError } from '../core/ApiError';
import JWT, { JwtPayload, Device } from '../core/JWT';
import { tokenInfo } from '../config/globals';
import jwt from 'jsonwebtoken';
import { BadRequestError } from '../core/ApiError';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User } from '.prisma/client';



export const getAccessToken = (authorization?: string) => {
  if (!authorization) throw new AuthFailureError('Invalid Authorization');
  if (!authorization.startsWith('Bearer ')) throw new AuthFailureError('Invalid Authorization');
  return authorization.split(' ')[1];
};

export const validateTokenData = (payload: JwtPayload): boolean => {
  if (
    !payload ||
    !payload.iss ||
    !payload.aud ||
    !payload.sub ||
    !payload.prm ||
    payload.iss !== tokenInfo.issuer ||
    payload.aud !== tokenInfo.audience
  )
    throw new AuthFailureError('Session expired. Please login again.');
  return true;
};

export const createTokens = async (
  user: User,
  accessTokenKey: string,
  refreshTokenKey: string,
): Promise<Tokens> => {
  const accessToken = await JWT.encode(
    new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id,
      accessTokenKey,
      tokenInfo.accessTokenValidityDays,
    ),
  );

  if (!accessToken) throw new InternalError();

  const refreshToken = await JWT.encode(
    new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id,
      refreshTokenKey,
      tokenInfo.refreshTokenValidityDays,
    ),
  );

  if (!refreshToken) throw new InternalError();

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
  } as Tokens;
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit number
}
export const generateRandomString = (length: number = 64, algorithm: 'hex' = 'hex') => {
  const a = crypto.randomBytes(length).toString(algorithm)
  return a
}
