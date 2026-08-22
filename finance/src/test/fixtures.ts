import { FxRateTable } from '@/domain/fx/rates';
import { moneyFromMajor } from '@/domain/money';
import type { StoredFxRate } from '@/domain/fx/types';
import type { AccountSnapshot } from '@/analysis/net-worth';

/**
 * Fixed test rates. Deliberately awkward numbers — a rate like 7.4589 does not
 * divide cleanly, which is exactly what the consistency tests need to exercise.
 */
export const TEST_RATES: readonly StoredFxRate[] = [
  { date: '2026-01-30', base: 'EUR', quote: 'DKK', rate: '7.4612' },
  { date: '2026-01-30', base: 'EUR', quote: 'USD', rate: '1.0412' },
  { date: '2026-06-30', base: 'EUR', quote: 'DKK', rate: '7.4551' },
  { date: '2026-06-30', base: 'EUR', quote: 'USD', rate: '1.1237' },
  { date: '2026-08-20', base: 'EUR', quote: 'DKK', rate: '7.4589' },
  { date: '2026-08-20', base: 'EUR', quote: 'USD', rate: '1.0865' },
];

export const testRateTable = (): FxRateTable => new FxRateTable(TEST_RATES);

/** One account per institution, each in its own native currency. */
export const testSnapshots = (asOf = '2026-08-20'): readonly AccountSnapshot[] => [
  {
    accountId: 'acc-danske-current',
    institution: 'Danske Bank',
    name: 'Current account',
    type: 'cash',
    liquidity: 'liquid',
    asOf,
    value: moneyFromMajor('84250.75', 'DKK'),
  },
  {
    accountId: 'acc-fineco-brokerage',
    institution: 'Fineco',
    name: 'Securities portfolio',
    type: 'brokerage',
    liquidity: 'invested',
    asOf,
    value: moneyFromMajor('61430.19', 'EUR'),
  },
  {
    accountId: 'acc-etoro',
    institution: 'eToro',
    name: 'Trading account',
    type: 'brokerage',
    liquidity: 'invested',
    asOf,
    value: moneyFromMajor('19877.03', 'USD'),
  },
];
