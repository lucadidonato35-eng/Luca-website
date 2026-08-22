import { describe, expect, it } from 'vitest';
import { convertAmount, roundToMoney } from '@/domain/fx/convert';
import { formatMoney } from '@/domain/money';
import { fxEffect, netWorthAt, netWorthSeries, shareOfTotal } from './net-worth';
import { testRateTable, testSnapshots } from '@/test/fixtures';
import type { NetWorthOptions } from './net-worth';

const rates = testRateTable();
const TODAY = '2026-08-20';

const optionsIn = (displayCurrency: 'DKK' | 'EUR' | 'USD'): NetWorthOptions => ({
  displayCurrency,
  rates,
  fxMode: 'period-correct',
  today: TODAY,
});

describe('netWorthAt', () => {
  const snapshots = testSnapshots(TODAY);

  it('values every account in the display currency', () => {
    const nw = netWorthAt(snapshots, TODAY, optionsIn('DKK'));
    expect(nw.byAccount).toHaveLength(3);
    expect(nw.byAccount.every((a) => a.converted.currency === 'DKK')).toBe(true);
    // The Danish account needs no conversion; the other two do.
    expect(nw.byAccount[0]!.converted.rates).toHaveLength(0);
    expect(nw.byAccount[1]!.converted.rates).toHaveLength(1);
  });

  it('splits by liquidity and the parts sum to the total', () => {
    const nw = netWorthAt(snapshots, TODAY, optionsIn('EUR'));
    const parts = nw.byLiquidity.liquid.value
      .plus(nw.byLiquidity.invested.value)
      .plus(nw.byLiquidity.illiquid.value);
    expect(parts.toString()).toBe(nw.total.value.toString());
    expect(shareOfTotal(nw.byLiquidity.invested, nw.total)).toBeGreaterThan(50);
  });

  /**
   * The conversion-path consistency test.
   *
   * Net worth computed in DKK and then converted to EUR must equal net worth
   * computed directly in EUR. This only holds because conversion never rounds
   * before aggregation — it is the assertion that protects that property.
   */
  it('is internally consistent across conversion paths', () => {
    const inDkk = netWorthAt(snapshots, TODAY, optionsIn('DKK')).total;
    const dkkThenEur = convertAmount(inDkk, 'EUR', TODAY, rates);
    const directEur = netWorthAt(snapshots, TODAY, optionsIn('EUR')).total;

    // Exact at any displayable precision.
    expect(roundToMoney(dkkThenEur).minor).toBe(roundToMoney(directEur).minor);
    expect(formatMoney(roundToMoney(dkkThenEur))).toBe(formatMoney(roundToMoney(directEur)));

    // And equal far beyond it: the residual is pure Decimal precision, not a
    // structural rounding error in the conversion path.
    const residual = dkkThenEur.value.minus(directEur.value).abs();
    expect(residual.lessThan('1e-25')).toBe(true);
  });

  it('holds for every ordered pair of display currencies', () => {
    const codes = ['DKK', 'EUR', 'USD'] as const;
    for (const from of codes) {
      for (const to of codes) {
        const viaFrom = convertAmount(
          netWorthAt(snapshots, TODAY, optionsIn(from)).total,
          to,
          TODAY,
          rates,
        );
        const direct = netWorthAt(snapshots, TODAY, optionsIn(to)).total;
        expect(roundToMoney(viaFrom).minor).toBe(roundToMoney(direct).minor);
      }
    }
  });

  it('assumes no currency: the same inputs produce a figure in whichever is asked for', () => {
    for (const code of ['DKK', 'EUR', 'USD'] as const) {
      const nw = netWorthAt(snapshots, TODAY, optionsIn(code));
      expect(nw.total.currency).toBe(code);
      expect(nw.displayCurrency).toBe(code);
    }
  });

  it('handles an empty portfolio without dividing by zero', () => {
    const nw = netWorthAt([], TODAY, optionsIn('DKK'));
    expect(nw.total.value.isZero()).toBe(true);
    expect(shareOfTotal(nw.byLiquidity.liquid, nw.total)).toBe(0);
  });
});

describe('FX mode', () => {
  const byDate = new Map([
    ['2026-01-30', testSnapshots('2026-01-30')],
    ['2026-06-30', testSnapshots('2026-06-30')],
    ['2026-08-20', testSnapshots('2026-08-20')],
  ]);

  it('period-correct and constant FX agree at today and diverge in the past', () => {
    const periodCorrect = netWorthSeries(byDate, {
      displayCurrency: 'DKK',
      rates,
      fxMode: 'period-correct',
      today: TODAY,
    });
    const constant = netWorthSeries(byDate, {
      displayCurrency: 'DKK',
      rates,
      fxMode: 'constant',
      today: TODAY,
    });

    // Same holdings at every point, so any difference is purely currency.
    expect(periodCorrect.at(-1)!.total.value.toString()).toBe(
      constant.at(-1)!.total.value.toString(),
    );
    expect(periodCorrect[0]!.total.value.equals(constant[0]!.total.value)).toBe(false);
  });

  it('reports the rate date actually applied', () => {
    const nw = netWorthAt(testSnapshots('2026-01-30'), '2026-01-30', {
      displayCurrency: 'EUR',
      rates,
      fxMode: 'constant',
      today: TODAY,
    });
    expect(nw.asOf).toBe('2026-01-30');
    expect(nw.rateDate).toBe(TODAY);
  });

  it('isolates the currency effect as the gap between the two views', () => {
    const at = (fxMode: 'period-correct' | 'constant') =>
      netWorthAt(testSnapshots('2026-01-30'), '2026-01-30', {
        displayCurrency: 'DKK',
        rates,
        fxMode,
        today: TODAY,
      }).total;

    const effect = fxEffect(at('period-correct'), at('constant'));
    expect(effect.currency).toBe('DKK');
    expect(effect.value.isZero()).toBe(false);
  });

  it('refuses to compare figures in different display currencies', () => {
    const dkk = netWorthAt(testSnapshots(), TODAY, optionsIn('DKK')).total;
    const eur = netWorthAt(testSnapshots(), TODAY, optionsIn('EUR')).total;
    expect(() => fxEffect(dkk, eur)).toThrow(/same display currency/);
  });
});
