// import express from 'express';
// import { ProtectedRequest } from 'app-request';
// import { AuthFailureError } from '../core/ApiError';
// import RoleRepo from '../database/repository/RoleRepo';
// import asyncHandler from '../helpers/asyncHandler';

// const router = express.Router();

// export default router.use(
//   asyncHandler(async (req: any, res, next) => { // ProtectedRequest
//     if (!req.user || !req.user.roles || !req.currentRoleCode)
//       throw new AuthFailureError('Permission denied');

//     const role = await RoleRepo.findByCode(req.currentRoleCode);
//     if (!role) throw new AuthFailureError('Permission denied');

//     const validRoles = req.user.roles.filter(
//       (userRole: any) => userRole.id === role.id,
//     );

//     if (!validRoles || validRoles.length == 0) throw new AuthFailureError('Permission denied');

//     return next();
//   }),
// );
