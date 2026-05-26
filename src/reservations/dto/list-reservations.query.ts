import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { reservationStatus, type ReservationStatus } from '../../../db/schema';

export class ListReservationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() bookId?: string;
  @ApiPropertyOptional({ enum: reservationStatus.enumValues })
  @IsOptional()
  @IsEnum(reservationStatus.enumValues)
  status?: ReservationStatus;
}
