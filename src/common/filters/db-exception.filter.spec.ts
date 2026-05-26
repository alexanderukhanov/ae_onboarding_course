import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { PostgresError } from 'postgres';
import { DbExceptionFilter } from './db-exception.filter';

function mockHost(): { host: ArgumentsHost; res: { status: jest.Mock; json: jest.Mock } } {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ url: '/x' }) }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

function pgError(code: string): PostgresError {
  const err = Object.create(PostgresError.prototype) as PostgresError;
  Object.assign(err, { code, message: `pg ${code}` });
  return err;
}

describe('DbExceptionFilter', () => {
  const filter = new DbExceptionFilter();

  it.each([
    ['23505', HttpStatus.CONFLICT],
    ['23503', HttpStatus.CONFLICT],
    ['23514', HttpStatus.BAD_REQUEST],
  ])('maps Postgres code %s to status %i', (code, status) => {
    const { host, res } = mockHost();
    filter.catch(pgError(code), host);
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('maps unknown Postgres errors to 500', () => {
    const { host, res } = mockHost();
    filter.catch(pgError('99999'), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
