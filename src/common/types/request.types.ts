import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  clientIp?: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    tenant_id: string;
    permissions: string[];
    is_mobile?: boolean;
  };
}
