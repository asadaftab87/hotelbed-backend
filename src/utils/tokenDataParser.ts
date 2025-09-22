import { DatabaseId } from "../types/types";

import { BadRequestError } from "../core/ApiError";
import { AdminMetaDataDTO, MetaDataDTO, SuperAdminMetaDataDTO, UserMetaDataDTO } from "../dto/index.dto";

declare type Class<T = any> = new (...args: any[]) => T;

export class tokenDataParser {


  static getSuperAdminTokenMetaData(userData: any): SuperAdminMetaDataDTO {

    // if (userData?.role !== RoleCode.SUPER_ADMIN ) throw new BadRequestError('Invalid Role')
    if (!userData._id) throw new BadRequestError("invalid token")

    const createdBy: string | DatabaseId = userData._id
    const updatedBy: string | DatabaseId = userData._id
    const isDeleted: boolean = false
    return { createdBy, updatedBy, isDeleted }
  }

  static getAdminTokenMetaData(userData: any): AdminMetaDataDTO {

    // if (userData?.role !== RoleCode.SUPER_ADMIN ) throw new BadRequestError('Invalid Role')
    if (!userData._id) throw new BadRequestError("invalid token")

    const createdBy: DatabaseId = userData._id
    const updatedBy: DatabaseId = userData._id
    const isDeleted: boolean = false

    return { createdBy, updatedBy, isDeleted }
  }

  static getUserTokenMetaData(userData: any): UserMetaDataDTO {

    if (!userData._id) throw new BadRequestError("invalid token")

    const createdBy: DatabaseId = userData._id
    const updatedBy: DatabaseId = userData._id
    const isDeleted: boolean = false
    const updatedAt = new Date()

    return { createdBy, updatedBy, isDeleted, updatedAt }
  }

}
