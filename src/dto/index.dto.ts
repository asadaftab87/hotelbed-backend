// dto/metadata.dto.ts

import { DatabaseDate, DatabaseId } from "../types/types";



export class CreatedByDTO {
  createdBy: DatabaseId;

  constructor(data: { createdBy: DatabaseId }) {
    this.createdBy = data.createdBy;
  }
}

export class CreatedByAndBusinessIdDTO {
  createdBy: DatabaseId;

  constructor(data: { createdBy: DatabaseId; businessId: DatabaseId }) {
    this.createdBy = data.createdBy;
  }
}

export class MetaDataDTO {
  createdBy: DatabaseId | string;
  updatedBy: DatabaseId | string;
  isDeleted: boolean;

  constructor(data: {
    createdBy: DatabaseId | string;
    updatedBy: DatabaseId | string;
    isDeleted?: boolean;
  }) {
    this.createdBy = data.createdBy;
    this.updatedBy = data.updatedBy;
    this.isDeleted = data.isDeleted ?? false;
  }
}

export class SuperAdminMetaDataDTO {
  createdBy: DatabaseId | string;
  updatedBy: DatabaseId | string;
  isDeleted: boolean;

  constructor(data?: Partial<SuperAdminMetaDataDTO>) {
    this.createdBy = data?.createdBy ?? '';
    this.updatedBy = data?.updatedBy ?? '';
    this.isDeleted = data?.isDeleted ?? false;
  }
}

export class AdminMetaDataDTO {
  createdBy: DatabaseId | string;
  updatedBy: DatabaseId | string;
  isDeleted: boolean;

  constructor(data?: Partial<AdminMetaDataDTO>) {
    this.createdBy = data?.createdBy ?? '';
    this.updatedBy = data?.updatedBy ?? '';
    this.isDeleted = data?.isDeleted ?? false;
  }
}

export class UserMetaDataDTO {
  createdBy: DatabaseId;
  updatedBy: DatabaseId;
  isDeleted: boolean;
  updatedAt: DatabaseDate;

  constructor(data: {
    createdBy: DatabaseId;
    updatedBy: DatabaseId;
    updatedAt: DatabaseDate;
    isDeleted?: boolean;
  }) {
    this.createdBy = data.createdBy;
    this.updatedBy = data.updatedBy;
    this.updatedAt = data.updatedAt;
    this.isDeleted = data.isDeleted ?? false;
  }
}

export class MetaDTO {
  createdBy: DatabaseId;
  updatedBy: DatabaseId;
  updatedAt: DatabaseDate;

  constructor(data: {
    createdBy: DatabaseId;
    updatedBy: DatabaseId;
    updatedAt: DatabaseDate;
  }) {
    this.createdBy = data.createdBy;
    this.updatedBy = data.updatedBy;
    this.updatedAt = data.updatedAt;
  }
}

export class UpdateMetaDTO {
  updatedBy: DatabaseId;
  updatedAt: DatabaseDate;

  constructor(data: { updatedBy: DatabaseId; updatedAt: DatabaseDate }) {
    this.updatedBy = data.updatedBy;
    this.updatedAt = data.updatedAt;
  }
}

export class UpdatedByAndBusinessIdDTO {
  updatedBy: DatabaseId;

  constructor(data: { updatedBy: DatabaseId; businessId: DatabaseId }) {
    this.updatedBy = data.updatedBy;
  }
}
