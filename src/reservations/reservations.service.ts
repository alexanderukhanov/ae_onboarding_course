import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PagedResult } from '../common/dto/pagination.dto';
import type { DbTransaction } from '../../db/types';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations.query';
import { ReservationEntity } from './dto/reservation.entity';
import { ReservationsRepository } from './reservations.repository';
import { ReservationAction, reservationTransition } from './transition';

@Injectable()
export class ReservationsService {
  constructor(private readonly repo: ReservationsRepository) {}

  async create(userId: string, dto: CreateReservationDto): Promise<ReservationEntity> {
    return this.repo.withTransaction(async (tx: DbTransaction) => {
      if (!(await this.repo.bookExists(tx, dto.bookId))) {
        throw new NotFoundException('Book not found');
      }
      const ok = await this.repo.tryDecrementAvailable(tx, dto.bookId);
      if (!ok) throw new ConflictException('No copies available');
      return this.repo.createInTx(tx, { bookId: dto.bookId, userId, status: 'ACTIVE' });
    });
  }

  async findOne(id: string): Promise<ReservationEntity> {
    const r = await this.repo.findById(id);
    if (!r) throw new NotFoundException('Reservation not found');
    return r;
  }

  async findAll(q: ListReservationsQueryDto): Promise<PagedResult<ReservationEntity>> {
    const { items, total } = await this.repo.findPaged(q.page, q.pageSize, {
      userId: q.userId,
      bookId: q.bookId,
      status: q.status,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async checkOut(userId: string, id: string): Promise<ReservationEntity> {
    return this.repo.withTransaction(async (tx: DbTransaction) => {
      const r = await this.repo.findByIdInTx(tx, id);
      if (!r) throw new NotFoundException('Reservation not found');
      if (r.userId !== userId) throw new ForbiddenException('Not the reservation owner');
      const next = reservationTransition(r.status, 'check_out');
      return this.repo.updateInTx(tx, id, { status: next, checkedOutAt: new Date() });
    });
  }

  async return_(userId: string, id: string): Promise<ReservationEntity> {
    return this.transitionWithCopyChange(userId, id, 'return', 'returnedAt');
  }

  async cancel(userId: string, id: string): Promise<ReservationEntity> {
    return this.transitionWithCopyChange(userId, id, 'cancel', 'cancelledAt');
  }

  private async transitionWithCopyChange(
    userId: string,
    id: string,
    action: ReservationAction,
    timestampField: 'returnedAt' | 'cancelledAt',
  ): Promise<ReservationEntity> {
    return this.repo.withTransaction(async (tx: DbTransaction) => {
      const r = await this.repo.findByIdInTx(tx, id);
      if (!r) throw new NotFoundException('Reservation not found');
      if (r.userId !== userId) throw new ForbiddenException('Not the reservation owner');
      const next = reservationTransition(r.status, action);

      const ok = await this.repo.tryIncrementAvailable(tx, r.bookId);
      if (!ok) throw new ConflictException('Copy accounting invariant violated');

      return this.repo.updateInTx(tx, id, { status: next, [timestampField]: new Date() });
    });
  }
}
