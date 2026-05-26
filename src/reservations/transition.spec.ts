import { reservationStatus, type ReservationStatus } from '../../db/schema';
import { reservationTransition, ReservationAction } from './transition';

const ALL_STATUSES = reservationStatus.enumValues;
const ALL_ACTIONS: ReservationAction[] = ['check_out', 'return', 'cancel'];

const legal: Array<[ReservationStatus, ReservationAction, ReservationStatus]> = [
  ['ACTIVE',      'check_out', 'CHECKED_OUT'],
  ['ACTIVE',      'cancel',    'CANCELLED'],
  ['CHECKED_OUT', 'return',    'RETURNED'],
];

describe('reservationTransition', () => {
  it.each(legal)('legal: %s + %s -> %s', (from, action, to) => {
    expect(reservationTransition(from, action)).toBe(to);
  });

  it('throws on every illegal (status, action) combination', () => {
    const legalKeys = new Set(legal.map(([s, a]) => `${s}|${a}`));
    for (const s of ALL_STATUSES) {
      for (const a of ALL_ACTIONS) {
        if (legalKeys.has(`${s}|${a}`)) continue;
        expect(() => reservationTransition(s, a)).toThrow();
      }
    }
  });
});
