import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { DRIZZLE } from '../../db/drizzle.token';
import type { Database } from '../../../db/types';

@Injectable()
export class UserExistsGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
    }>();
    const headerVal = req.headers['x-user-id'];
    if (!headerVal || !isUUID(headerVal)) {
      throw new UnauthorizedException('Missing or invalid X-User-Id header');
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, headerVal) });
    if (!user) throw new UnauthorizedException('Unknown user');
    req.userId = headerVal;
    return true;
  }
}
