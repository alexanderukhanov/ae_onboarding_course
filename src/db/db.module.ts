import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import * as schema from '../../db/schema';
import { DRIZZLE } from './drizzle.token';

export const PG_CLIENT = Symbol('PG_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): Sql =>
        postgres(cfg.getOrThrow<string>('DATABASE_URL'), { max: 10 }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (client: Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DbModule.name);

  constructor(@Inject(PG_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing Postgres client');
    await this.client.end({ timeout: 5 });
  }
}
