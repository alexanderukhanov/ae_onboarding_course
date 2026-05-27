import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DbTransaction } from '../../db/types';
import { ReservationEntity } from './dto/reservation.entity';
import { ReservationsRepository } from './reservations.repository';
import { ReservationsService } from './reservations.service';
import { ReservationStatus } from './transition';

function makeRepo(): jest.Mocked<ReservationsRepository> {
  const repo = {
    findById: jest.fn<(id: string) => Promise<ReservationEntity | undefined>>(),
    findPaged: jest.fn(),
    tryDecrementAvailable: jest.fn<(tx: DbTransaction, id: string) => Promise<boolean>>(),
    tryIncrementAvailable: jest.fn<(tx: DbTransaction, id: string) => Promise<boolean>>(),
    bookExists: jest.fn<(tx: DbTransaction, id: string) => Promise<boolean>>(),
    createInTx: jest.fn<
      (
        tx: DbTransaction,
        data: { bookId: string; userId: string; status: ReservationStatus },
      ) => Promise<ReservationEntity>
    >(),
    updateInTx: jest.fn<
      (tx: DbTransaction, id: string, data: Partial<ReservationEntity>) => Promise<ReservationEntity>
    >(),
    findByIdInTx: jest.fn<
      (tx: DbTransaction, id: string) => Promise<ReservationEntity | undefined>
    >(),
    withTransaction: jest.fn(),
  } as unknown as jest.Mocked<ReservationsRepository>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (repo.withTransaction as unknown as jest.Mock).mockImplementation((cb: any) => cb({} as any));
  return repo;
}

function r(overrides: Partial<ReservationEntity> = {}): ReservationEntity {
  return {
    id: 'r1',
    bookId: 'b1',
    userId: 'u1',
    status: 'ACTIVE',
    reservedAt: new Date(),
    checkedOutAt: null,
    returnedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe('ReservationsService', () => {
  let repo: jest.Mocked<ReservationsRepository>;
  let svc: ReservationsService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new ReservationsService(repo);
  });

  describe('create', () => {
    it('404 when book does not exist', async () => {
      repo.bookExists.mockResolvedValue(false);
      await expect(svc.create('u1', { bookId: 'b1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 when atomic decrement returns no rows', async () => {
      repo.bookExists.mockResolvedValue(true);
      repo.tryDecrementAvailable.mockResolvedValue(false);
      await expect(svc.create('u1', { bookId: 'b1' })).rejects.toBeInstanceOf(ConflictException);
      expect(repo.createInTx).not.toHaveBeenCalled();
    });

    it('creates ACTIVE reservation when atomic decrement succeeds', async () => {
      repo.bookExists.mockResolvedValue(true);
      repo.tryDecrementAvailable.mockResolvedValue(true);
      repo.createInTx.mockResolvedValue(r());
      const out = await svc.create('u1', { bookId: 'b1' });
      expect(out.status).toBe('ACTIVE');
    });
  });

  describe('checkOut', () => {
    it('404 on missing reservation', async () => {
      repo.findByIdInTx.mockResolvedValue(undefined);
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids non-owners', async () => {
      repo.findByIdInTx.mockResolvedValue(r({ userId: 'someone-else' }));
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects illegal transition', async () => {
      repo.findByIdInTx.mockResolvedValue(r({ status: 'RETURNED' }));
      await expect(svc.checkOut('u1', 'r1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('marks CHECKED_OUT with timestamp', async () => {
      repo.findByIdInTx.mockResolvedValue(r());
      repo.updateInTx.mockImplementation(async (_tx, _id, data) =>
        r({ status: data.status as ReservationStatus, checkedOutAt: data.checkedOutAt ?? null }),
      );
      const out = await svc.checkOut('u1', 'r1');
      expect(out.status).toBe('CHECKED_OUT');
      expect(out.checkedOutAt).not.toBeNull();
    });
  });

  describe('return_', () => {
    it('increments availableCopies and marks RETURNED', async () => {
      repo.findByIdInTx.mockResolvedValue(r({ status: 'CHECKED_OUT', checkedOutAt: new Date() }));
      repo.tryIncrementAvailable.mockResolvedValue(true);
      repo.updateInTx.mockImplementation(async (_tx, _id, data) =>
        r({ status: data.status as ReservationStatus, returnedAt: data.returnedAt ?? null }),
      );
      const out = await svc.return_('u1', 'r1');
      expect(out.status).toBe('RETURNED');
      expect(repo.tryIncrementAvailable).toHaveBeenCalled();
    });
  });
});
