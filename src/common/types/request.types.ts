import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    tenant_id: string;
    permissions: string[];
    first_name?: string;
    last_name?: string;
  };
}

