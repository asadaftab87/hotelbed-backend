import { prisma } from './../../../database';
import Role from './Role';
export default class RoleRepo {

  public static findById(id: Role['id']): Promise<Role | null> {
    return prisma.role.findUnique({ where: { id } })
  }

  public static findByCode(code: Role['code']): Promise<Role | null> {
    return prisma.role.findUnique({ where: { code } })
  }

  public static async createMany(body: Role[]): Promise<{ roles: any }> {
    const roles = await prisma.role.createMany({
      data: body,
      skipDuplicates: true,
    });
    return { roles };
  }

}
