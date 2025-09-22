import { DatabaseId } from "../types/types";

export interface ISuperAdminEntity {
  createdBy: DatabaseId;
  updatedBy: DatabaseId;
  isDeleted: boolean;
}

export class SuperAdminEntityDTO implements ISuperAdminEntity {
  createdBy: DatabaseId = '';
  updatedBy: DatabaseId = '';
  isDeleted: boolean = false;
}

export class UpdateMetaDataDTO {
  updatedBy: string = '';
}

export class PaginationDataDTO {
  page: number = 1;
  limit: number = 10;
}
