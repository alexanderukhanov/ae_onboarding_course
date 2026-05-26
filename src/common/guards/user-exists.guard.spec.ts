import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { UserExistsGuard } from './user-exists.guard';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function ctx(headers: Record<string, string | undefined>): ExecutionContext {
  const request: { headers: Record<string, string | undefined>; userId?: string } = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('UserExistsGuard', () => {
  const findFirst = jest.fn<(args: unknown) => Promise<{ id: string } | undefined>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { query: { users: { findFirst } } } as any;
  const guard = new UserExistsGuard(db);

  beforeEach(() => {
    findFirst.mockReset();
  });

  it('throws 401 when header is missing', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when header is not a UUID', async () => {
    await expect(guard.canActivate(ctx({ 'x-user-id': 'not-a-uuid' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws 401 when user is not in DB', async () => {
    findFirst.mockResolvedValue(undefined);
    await expect(guard.canActivate(ctx({ 'x-user-id': VALID_UUID }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns true and attaches userId when user exists', async () => {
    findFirst.mockResolvedValue({ id: VALID_UUID });
    const c = ctx({ 'x-user-id': VALID_UUID });
    await expect(guard.canActivate(c)).resolves.toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((c.switchToHttp().getRequest() as any).userId).toBe(VALID_UUID);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: eq(users.id, VALID_UUID) }),
    );
  });
});
