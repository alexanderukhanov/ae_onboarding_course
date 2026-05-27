import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISBN, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CreateBookDto {
  @ApiProperty() @IsString() @IsNotEmpty() title!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() authorId!: string;
  @ApiProperty({ description: 'ISBN-10 or ISBN-13' }) @IsISBN() isbn!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) totalCopies!: number;
}
