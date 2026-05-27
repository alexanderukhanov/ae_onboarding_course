import { ApiProperty } from '@nestjs/swagger';
import { AuthorEntity } from '../../authors/dto/author.entity';

export class BookEntity {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() isbn!: string;
  @ApiProperty() totalCopies!: number;
  @ApiProperty() availableCopies!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: () => AuthorEntity, required: false })
  author?: AuthorEntity;
}
