import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
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

@Catch(PostgresError)
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbExceptionFilter.name);

  catch(exception: PostgresError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const mapping = CODE_MAP[exception.code] ?? FALLBACK;
    if (mapping.status >= 500) this.logger.error(exception);
    res
      .status(mapping.status)
      .json({ statusCode: mapping.status, error: mapping.error, message: mapping.message });
  }
}
