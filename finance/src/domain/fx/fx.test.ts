import { describe, expect, it } from 'vitest';
import { Dec } from '../decimal';
import { moneyFromMajor } from '../money';
import { FxRateTable, STALE_AFTER_DAYS } from './rates';
import { convertAmount, convertMoney, rateDateFor, roundToMoney } from './convert';
import { TEST_RATES, testRateTable } from '@/test/fixtures';

describe('FxRateTable', () => {
  const rates = testRateTable();

  it('rejects non-EUR-based rates', () => {
    expect(() => new FxRateTable([{ date: '2026-08-20', base: 'DKK', quote: 'USD', rate: '0.14' }]))
      .toThrow(/EUR-based reference rates only/);
  });

  it('returns an identity rate for a same-currency pair', () => {
    const r = rates.resolve('2026-08-20', 'DKK', 'DKK');
    expect(r.rate.toString()).toBe('1');
    expect(r.derivation).toBe('identity');
  });

  it('uses the most recent publication on or before the requested date', () => {
    const r = rates.resolve('2026-08-22', 'EUR', 'DKK');
    expect(r.asOf).toBe('2026-08-20');
    expect(r.rate.toString()).toBe('7.4589');
  });

  it('derives a non-EUR cross from two EUR rates', () => {
    const r = rates.resolve('2026-08-20', 'DKK', 'USD');
    expect(r.derivation).toBe('cross');
    // USD per DKK = (USD per EUR) / (DKK per EUR)
    expect(r.rate.toString()).toBe(new Dec('1.0865').dividedBy('7.4589').toString());
  });

  it('is symmetric: A→B and B→A are exact reciprocals', () => {
    const forward = rates.resolve('2026-08-20', 'DKK', 'USD').rate;
    const back = rates.resolve('2026-08-20', 'USD', 'DKK').rate;
    expect(forward.times(back).toSignificantDigits(30).toString()).toBe('1');
  });

  it('flags a rate as stale once it is older than the staleness window', () => {
    const fresh = rates.resolve('2026-08-22', 'EUR', 'USD');
    expect(fresh.stale).toBe(false);
    const stale = rates.resolve('2026-09-30', 'EUR', 'USD');
    expect(stale.stale).toBe(true);
    expect(stale.asOf).toBe('2026-08-20');
    expect(Date.parse('2026-09-30') - Date.parse(stale.asOf)).toBeGreaterThan(
      STALE_AFTER_DAYS * 86_400_000,
    );
  });

  it('degrades to the last known rate rather than throwing when offline', () => {
    // Far past the newest rate: still answers, but flagged.
    expect(rates.resolve('2027-12-31', 'EUR', 'DKK').rate.toString()).toBe('7.4589');
    expect(rates.latestDate()).toBe('2026-08-20');
  });

  it('throws rather than guessing when asked for a date before any rate exists', () => {
    expect(() => rates.resolve('2020-01-01', 'EUR', 'USD')).toThrow(/on or before/);
  });

  it('loads every fixture rate', () => {
    expect(TEST_RATES).toHaveLength(6);
  });
});

describe('conversion', () => {
  const rates = testRateTable();

  it('carries the rate used and its as-of date with the figure', () => {
    const converted = convertMoney(moneyFromMajor('1000', 'EUR'), 'DKK', '2026-08-22', rates);
    expect(converted.rates).toHaveLength(1);
    expect(converted.rates[0]!.asOf).toBe('2026-08-20');
    expect(converted.value.toString()).toBe('7458.9');
  });

  it('records no rate for a same-currency conversion', () => {
    const converted = convertMoney(moneyFromMajor('1000', 'EUR'), 'EUR', '2026-08-20', rates);
    expect(converted.rates).toHaveLength(0);
    expect(converted.stale).toBe(false);
  });

  it('propagates staleness into the converted figure', () => {
    const converted = convertMoney(moneyFromMajor('1000', 'USD'), 'DKK', '2027-01-01', rates);
    expect(converted.stale).toBe(true);
  });

  it('does not round-trip an amount through an intermediate currency', () => {
    // DKK→USD applies one derived rate to the amount. Materialising the amount
    // in EUR first and rounding it there would lose precision; this asserts the
    // single-application path.
    const m = moneyFromMajor('84250.75', 'DKK');
    const direct = convertMoney(m, 'USD', '2026-08-20', rates).value;
    const crossRate = new Dec('1.0865').dividedBy('7.4589');
    expect(direct.toString()).toBe(new Dec('84250.75').times(crossRate).toString());
  });

  it('rounds only at the render boundary', () => {
    const converted = convertMoney(moneyFromMajor('19877.03', 'USD'), 'DKK', '2026-08-20', rates);
    // Unrounded value keeps far more precision than the minor unit.
    expect(converted.value.decimalPlaces()).toBeGreaterThan(2);
    expect(roundToMoney(converted).currency).toBe('DKK');
    expect(Number.isInteger(roundToMoney(converted).minor)).toBe(true);
  });

  it('chains conversions without compounding visible error', () => {
    const m = moneyFromMajor('61430.19', 'EUR');
    const viaDkk = convertAmount(
      convertMoney(m, 'DKK', '2026-08-20', rates),
      'USD',
      '2026-08-20',
      rates,
    );
    const direct = convertMoney(m, 'USD', '2026-08-20', rates);
    expect(roundToMoney(viaDkk).minor).toBe(roundToMoney(direct).minor);
  });
});

describe('rateDateFor', () => {
  it('uses the point date under period-correct FX', () => {
    expect(rateDateFor('period-correct', '2026-01-30', '2026-08-20')).toBe('2026-01-30');
  });

  it('uses today under constant FX', () => {
    expect(rateDateFor('constant', '2026-01-30', '2026-08-20')).toBe('2026-08-20');
  });
});
