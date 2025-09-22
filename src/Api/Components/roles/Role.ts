import { prisma, Role } from './../../../database';

export const DOCUMENT_NAME = 'Role';
export const COLLECTION_NAME = 'roles';

export default Role;

export const RoleModel = prisma.role;
