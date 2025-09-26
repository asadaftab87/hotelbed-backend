
// import { ProtectedRequest } from 'app-request';
// import { AuthFailureError } from '../core/ApiError';
// import RoleRepo from '../Api/Components/roles/role.repository';
// import asyncHandler from '../helpers/asyncHandler';
// import Role from '../Api/Components/roles/Role';

// export default function authorization(allow_roles: Role['code'][]) {
//   return asyncHandler(async (req: any, res, next) => {
//     // console.log('====================================');
//     // console.log(allow_roles.includes(req.user.role.code))
//     // console.log(allow_roles)
//     // console.log(req.user.role.code);
//     // console.log('====================================');
//     const role = await RoleRepo.findById(req.user.roleId);

//     if (!allow_roles.includes(req.user.role.code)) throw new AuthFailureError('Permission denied, You dont have permission for this action');
//     else if (!req.user || !req.user.role) throw new AuthFailureError('Permission denied, You dont have role');
//     else if (!role) throw new AuthFailureError('Permission denied, Invalid role');
//     else return next();
//   })
// }
