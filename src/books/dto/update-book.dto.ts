import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISBN, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateBookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() authorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISBN() isbn?: string;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) totalCopies?: number;
}
