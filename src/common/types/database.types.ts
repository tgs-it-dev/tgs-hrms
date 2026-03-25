import { QueryFailedError } from 'typeorm';

export interface PostgresError extends QueryFailedError {
  code?: string;
  detail?: string;
  constraint?: string;
}

export const isPostgresError = (error: unknown): error is PostgresError => {
  return error instanceof QueryFailedError;
};

export const getPostgresErrorCode = (error: unknown): string | undefined => {
  if (isPostgresError(error)) {
    return error.code;
  }
  return undefined;
};

export const getPostgresErrorConstraint = (error: unknown): string | undefined => {
  if (isPostgresError(error)) {
    const e = error as QueryFailedError & { driverError?: { constraint?: string }; constraint?: string };
    return e.driverError?.constraint ?? e.constraint;
  }
  return undefined;
};

