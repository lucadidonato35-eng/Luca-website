import { Dec, type Decimal } from '../decimal';
import { type Money, minorPerMajor, money, toDecimal } from '../money';
import type { CurrencyCode } from '@/config/currencies';
import type { Amount, IsoDate, RateProvider, ResolvedRate } from './types';

/**
 * How a historical series picks its FX rates.
 *
 * - `period-correct` converts each point at the rate as of that point's own
 *   date. This is the truthful view of what the portfolio was worth at the time.
 * - `constant` converts every point at today's rate, which strips currency
 *   movement out and leaves only real portfolio movement.
 *
 * The difference between the two *is* the FX effect, which is why both are
 * first-class rather than one being a footnote.
 */
export type FxMode = 'period-correct' | 'constant';

export function rateDateFor(mode: FxMode, pointDate: IsoDate, today: IsoDate): IsoDate {
  return mode === 'constant' ? today : pointDate;
}

function dedupeRates(rates: readonly ResolvedRate[]): ResolvedRate[] {
  const seen = new Map<string, ResolvedRate>();
  for (const r of rates) {
    if (r.derivation === 'identity') continue;
    seen.set(`${r.from}>${r.to}@${r.asOf}`, r);
  }
  return [...seen.values()];
}

export function amount(
  value: Decimal,
  currency: CurrencyCode,
  rates: readonly ResolvedRate[] = [],
): Amount {
  const deduped = dedupeRates(rates);
  return { value, currency, rates: deduped, stale: deduped.some((r) => r.stale) };
}

export const zeroAmount = (currency: CurrencyCode): Amount => amount(new Dec(0), currency);

/**
 * Convert a stored native-currency Money into a display currency.
 *
 * The result is deliberately unrounded. Rounding here would make aggregation
 * order-dependent — sum-then-convert would stop matching convert-then-sum — so
 * every figure stays at full precision until `render`.
 */
export function convertMoney(
  m: Money,
  to: CurrencyCode,
  date: IsoDate,
  rates: RateProvider,
): Amount {
  const resolved = rates.resolve(date, m.currency, to);
  return amount(toDecimal(m).times(resolved.rate), to, [resolved]);
}

/** Convert an already-computed Amount into another currency. */
export function convertAmount(
  a: Amount,
  to: CurrencyCode,
  date: IsoDate,
  rates: RateProvider,
): Amount {
  if (a.currency === to) return a;
  const resolved = rates.resolve(date, a.currency, to);
  return amount(a.value.times(resolved.rate), to, [...a.rates, resolved]);
}

export function addAmounts(a: Amount, b: Amount): Amount {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} and ${b.currency}; convert first.`);
  }
  return amount(a.value.plus(b.value), a.currency, [...a.rates, ...b.rates]);
}

export function sumAmounts(amounts: readonly Amount[], currency: CurrencyCode): Amount {
  return amounts.reduce<Amount>((acc, x) => addAmounts(acc, x), zeroAmount(currency));
}

/** Convert and sum in one pass — the common shape across the analysis engine. */
export function sumConverted(
  items: readonly Money[],
  to: CurrencyCode,
  date: IsoDate,
  rates: RateProvider,
): Amount {
  return sumAmounts(
    items.map((m) => convertMoney(m, to, date, rates)),
    to,
  );
}

/**
 * The single rounding boundary. Call this at render time, never before.
 * Returns exact Money in the display currency.
 */
export function roundToMoney(a: Amount): Money {
  const minor = a.value
    .times(minorPerMajor(a.currency))
    .toDecimalPlaces(0, Dec.ROUND_HALF_EVEN);
  return money(minor.toNumber(), a.currency);
}
