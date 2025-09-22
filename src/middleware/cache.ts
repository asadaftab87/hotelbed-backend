// import { redis_client } from "../database/redis"
// import express, { Request, Response, NextFunction } from 'express';
// import { ProtectedRequest } from 'app-request';
// import { } from '../core/ApiError';
// import asyncHandler from '../helpers/asyncHandler';
// import { SuccessResponse } from '../core/ApiResponse';

// const router = express.Router();

// export default router.use(
//   asyncHandler(async (req: any, res: Response, next: NextFunction) => {
//     req.key = `${req.method}-${req.baseUrl}`

//     // @ts-ignore
//     const cache = JSON.parse(await redis_client.get(req.key));
//     if (false) {
//       new SuccessResponse('fetch successfully, (cache)', cache).send(res);
//     } else {
//       return next();
//     }
//   }),
// );
