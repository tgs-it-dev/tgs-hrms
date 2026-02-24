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
    return error.constraint;
  }
  return undefined;
};
