import { ApiProperty } from '@nestjs/swagger';
import { reservationStatus, type ReservationStatus } from '../../../db/schema';

export class ReservationEntity {
  @ApiProperty() id!: string;
  @ApiProperty() bookId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: reservationStatus.enumValues })
  status!: ReservationStatus;
  @ApiProperty() reservedAt!: Date;
  @ApiProperty({ nullable: true }) checkedOutAt!: Date | null;
  @ApiProperty({ nullable: true }) returnedAt!: Date | null;
  @ApiProperty({ nullable: true }) cancelledAt!: Date | null;
}
