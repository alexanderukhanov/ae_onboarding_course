import { ApiProperty } from '@nestjs/swagger';
import { BookEntity } from '../../books/dto/book.entity';

export class BookWithScoreEntity extends BookEntity {
  @ApiProperty() score!: number;
}
