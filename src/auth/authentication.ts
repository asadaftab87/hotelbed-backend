// import express from 'express';
// import { ProtectedRequest } from 'app-request';
// import UserRepo from '../database/repository/UserRepo';
// import { AuthFailureError, AccessTokenError, TokenExpiredError } from '../core/ApiError';
// import JWT from '../core/JWT';
// import KeystoreRepo from '../database/repository/KeystoreRepo' ;
// import { Types } from 'mongoose';
// import { getAccessToken, validateTokenData } from './authUtils';
// import validator, { ValidationSource } from '../validations/validator';
// import schema from './schema';
// import asyncHandler from '../helpers/asyncHandler';

// const router = express.Router();

// export default router.use(
//   validator(schema.auth, ValidationSource.HEADER),
//   asyncHandler(async (req: any, res, next) => { // ProtectedRequest
//     req.accessToken = getAccessToken(req.headers.authorization); // Express headers are auto converted to lowercase
//     const userRepository =  new UserRepo()

//     try {
//       const payload = await JWT.validate(req.accessToken);
//       validateTokenData(payload);

//       const user = await userRepository.findById(new Types.ObjectId(payload.sub));
//       if (!user) throw new AuthFailureError('User not registered');
//       req.user = user;

//       const keystore = await KeystoreRepo.findforKey(req.user._id, payload.prm);
//       if (!keystore) throw new AuthFailureError('Session expired. Please login again.');
//       req.keystore = keystore;

//       return next();
//     } catch (e) {
//       if (e instanceof TokenExpiredError) throw new AccessTokenError(e.message);
//       throw e;
//     }
//   }),
// );
