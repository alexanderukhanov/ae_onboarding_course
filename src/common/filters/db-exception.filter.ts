import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { Response } from 'express';
import { PostgresError } from 'postgres';

interface Mapping {
  status: HttpStatus;
  error: string;
  message: string;
}

const CODE_MAP: Record<string, Mapping> = {
  '23505': { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'Unique constraint violation' },
  '23503': { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'Foreign key constraint violation' },
  '23514': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'Check constraint violation' },
};

const FALLBACK: Mapping = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  error: 'Internal Server Error',
  message: 'Database error',
};

/** Walks `.cause` chain looking for the first PostgresError, if any. */
function unwrapPostgresError(err: unknown): PostgresError | undefined {
  let cur: unknown = err;
  while (cur) {
    if (cur instanceof PostgresError) return cur;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

@Catch(PostgresError, DrizzleQueryError)
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const pg = unwrapPostgresError(exception);
    const mapping = (pg && CODE_MAP[pg.code]) ?? FALLBACK;
    if (mapping.status >= 500) this.logger.error(exception);
    res
      .status(mapping.status)
      .json({ statusCode: mapping.status, error: mapping.error, message: mapping.message });
  }
}
