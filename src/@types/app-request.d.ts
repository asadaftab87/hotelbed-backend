import { Request } from 'express';
import User from '../user/user.entity';
import Keystore from '../database/model/Keystore';

declare interface Pagination { 
  total: number, 
  pages: number, 
  next?: { 
    page: number, 
    limit: number 
  },
  prev?: { 
    page: number, 
    limit: number 
  },
  skip_limit? : { limit: number, skip: number }
}

declare interface PublicRequest extends Request {
  apiKey: string;
  pagination: any;
}

declare interface RoleRequest extends PublicRequest {
  currentRoleCode: string;
}

declare interface ProtectedRequest extends RoleRequest {
  user: User;
  accessToken: string;
  keystore: Keystore;
}

declare interface Tokens {
  accessToken: string;
  refreshToken: string;
}
