import { Dec } from '@/domain/decimal';
import type { Money } from '@/domain/money';
import {
  type FxMode,
  convertMoney,
  rateDateFor,
  sumAmounts,
  zeroAmount,
} from '@/domain/fx/convert';
import type { Amount, IsoDate, RateProvider } from '@/domain/fx/types';
import type { CurrencyCode } from '@/config/currencies';
import type { AccountType } from '@/domain/adapters/types';

/**
 * Deterministic net-worth calculation.
 *
 * Every function here takes the display currency as an explicit parameter and
 * returns figures already converted, together with the rates used. None of them
 * assumes a currency, and none of them rounds — rounding happens at render.
 */

export type Liquidity = 'liquid' | 'invested' | 'illiquid';

export interface AccountSnapshot {
  readonly accountId: string;
  readonly institution: string;
  readonly name: string;
  readonly type: AccountType;
  readonly liquidity: Liquidity;
  readonly asOf: IsoDate;
  /** Value in the account's own native currency. */
  readonly value: Money;
}

export interface AccountValuation extends AccountSnapshot {
  readonly converted: Amount;
}

export interface NetWorth {
  readonly asOf: IsoDate;
  readonly displayCurrency: CurrencyCode;
  /** Date whose FX rates were applied — differs from asOf under constant FX. */
  readonly rateDate: IsoDate;
  readonly total: Amount;
  readonly byAccount: readonly AccountValuation[];
  readonly byLiquidity: Readonly<Record<Liquidity, Amount>>;
}

export interface NetWorthOptions {
  readonly displayCurrency: CurrencyCode;
  readonly rates: RateProvider;
  readonly fxMode: FxMode;
  /** "Today" for the purposes of constant-FX conversion. */
  readonly today: IsoDate;
}

export function netWorthAt(
  snapshots: readonly AccountSnapshot[],
  asOf: IsoDate,
  options: NetWorthOptions,
): NetWorth {
  const { displayCurrency, rates, fxMode, today } = options;
  const rateDate = rateDateFor(fxMode, asOf, today);

  const byAccount: AccountValuation[] = snapshots.map((s) => ({
    ...s,
    converted: convertMoney(s.value, displayCurrency, rateDate, rates),
  }));

  const byLiquidity = {
    liquid: sumFor(byAccount, 'liquid', displayCurrency),
    invested: sumFor(byAccount, 'invested', displayCurrency),
    illiquid: sumFor(byAccount, 'illiquid', displayCurrency),
  } as const;

  return {
    asOf,
    displayCurrency,
    rateDate,
    total: sumAmounts(
      byAccount.map((a) => a.converted),
      displayCurrency,
    ),
    byAccount,
    byLiquidity,
  };
}

function sumFor(
  valuations: readonly AccountValuation[],
  liquidity: Liquidity,
  currency: CurrencyCode,
): Amount {
  const matching = valuations.filter((v) => v.liquidity === liquidity);
  return matching.length === 0
    ? zeroAmount(currency)
    : sumAmounts(
        matching.map((v) => v.converted),
        currency,
      );
}

export interface SeriesPoint {
  readonly date: IsoDate;
  readonly total: Amount;
}

/**
 * Net worth over time. Under `period-correct` each point uses the FX rate as of
 * that point's own date; under `constant` every point uses today's rate. The
 * gap between the two series is the currency effect, which for a portfolio
 * split across DKK, EUR and USD is not a rounding detail.
 */
export function netWorthSeries(
  snapshotsByDate: ReadonlyMap<IsoDate, readonly AccountSnapshot[]>,
  options: NetWorthOptions,
): readonly SeriesPoint[] {
  return [...snapshotsByDate.keys()]
    .sort()
    .map((date) => ({
      date,
      total: netWorthAt(snapshotsByDate.get(date) ?? [], date, options).total,
    }));
}

/**
 * How much of a period's change was currency movement rather than portfolio
 * movement: the same endpoints valued at period-correct rates versus at a
 * single constant rate.
 */
export function fxEffect(periodCorrect: Amount, constantFx: Amount): Amount {
  if (periodCorrect.currency !== constantFx.currency) {
    throw new Error('fxEffect requires both figures in the same display currency.');
  }
  return {
    value: periodCorrect.value.minus(constantFx.value),
    currency: periodCorrect.currency,
    rates: [...periodCorrect.rates, ...constantFx.rates],
    stale: periodCorrect.stale || constantFx.stale,
  };
}

/** Share of a total, as a percentage, guarding against a zero denominator. */
export function shareOfTotal(part: Amount, total: Amount): number {
  if (total.value.isZero()) return 0;
  return part.value.dividedBy(total.value).times(new Dec(100)).toNumber();
}
