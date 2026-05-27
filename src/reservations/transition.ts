import { ConflictException } from '@nestjs/common';
import type { ReservationStatus } from '../../db/schema';

export type { ReservationStatus };
export type ReservationAction = 'check_out' | 'return' | 'cancel';

const TABLE: Partial<
  Record<ReservationStatus, Partial<Record<ReservationAction, ReservationStatus>>>
> = {
  ACTIVE:      { check_out: 'CHECKED_OUT', cancel: 'CANCELLED' },
  CHECKED_OUT: { return:    'RETURNED' },
};

export function reservationTransition(
  current: ReservationStatus,
  action: ReservationAction,
): ReservationStatus {
  const next = TABLE[current]?.[action];
  if (!next) {
    throw new ConflictException(`Illegal transition: ${current} + ${action}`);
  }
  return next;
}
