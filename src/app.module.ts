import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthorsModule } from './authors/authors.module';
import { BooksModule } from './books/books.module';
import { DbModule } from './db/db.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthorsModule,
    BooksModule,
    ReservationsModule,
    SearchModule,
  ],
})
export class AppModule {}
