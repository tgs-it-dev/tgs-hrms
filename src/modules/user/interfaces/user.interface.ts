/**
 * User interfaces for type definitions
 */

import { UserGender, UserStatus } from '../../../common/constants/enums';

export interface UserResponse {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  gender?: UserGender;
  status: UserStatus;
  role_id: string;
  tenant_id: string;
  profile_pic?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithRole extends UserResponse {
  role: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  gender?: UserGender;
  profile_pic?: string;
  role: {
    id: string;
    name: string;
    description?: string;
  };
  tenant: {
    id: string;
    name: string;
  };
  created_at: Date;
  updated_at: Date;
}

export interface UserListResponse {
  users: UserWithRole[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  users_by_role: Record<string, number>;
  users_by_gender: Record<string, number>;
}

export interface FileUploadResponse {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}
