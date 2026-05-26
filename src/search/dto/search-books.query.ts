import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class SearchBooksQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'Free-text search query' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  authorId?: string;
}
