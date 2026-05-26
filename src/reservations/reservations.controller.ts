import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { UserExistsGuard } from '../common/guards/user-exists.guard';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations.query';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiHeader({ name: 'X-User-Id', required: true, schema: { format: 'uuid' } })
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly svc: ReservationsService) {}

  @Post() @UseGuards(UserExistsGuard) @HttpCode(201)
  create(@CurrentUserId() userId: string, @Body() dto: CreateReservationDto) {
    return this.svc.create(userId, dto);
  }

  @Get() findAll(@Query() q: ListReservationsQueryDto) {
    return this.svc.findAll(q);
  }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post(':id/check-out') @UseGuards(UserExistsGuard) @HttpCode(200)
  checkOut(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.checkOut(userId, id);
  }

  @Post(':id/return') @UseGuards(UserExistsGuard) @HttpCode(200)
  return_(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.return_(userId, id);
  }

  @Post(':id/cancel') @UseGuards(UserExistsGuard) @HttpCode(200)
  cancel(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.cancel(userId, id);
  }
}
