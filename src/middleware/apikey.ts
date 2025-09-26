// import { Router, Response, NextFunction } from 'express';
// import ApiKeyRepo from '../Api/Components/access/apiKey.repository';
// import { ForbiddenError } from '../core/ApiError';
// // import Logger from '../core/Logger';
// // import { PublicRequest } from 'app-request';
// import { apiKeySchema } from '../utils/joi.schema';
// import validator, { ValidationSource } from '../helpers/validator';
// import asyncHandler from '../helpers/async';

// export const registerApiKey = (router: Router, endoint: string): void => {

//   router.use(
//     endoint,
//     validator(apiKeySchema, ValidationSource.HEADER),
//     asyncHandler(async (req: any, res: Response, next: NextFunction) => {
//       // @ts-ignore
//       req.apiKey = req.headers['x-api-key'].toString();

//       const apiKey = await ApiKeyRepo.findByKey(req.apiKey);

//       if (!apiKey) throw new ForbiddenError();
//       return next();
//     }),
//   );

// }
