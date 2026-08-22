import { Dec, type Decimal } from '../decimal';
import type { CurrencyCode } from '@/config/currencies';
import type { IsoDate, RateProvider, ResolvedRate, StoredFxRate } from './types';

/**
 * A rate published more than this many days before the date we asked for is
 * flagged as stale. Four days clears an ordinary weekend plus a public holiday;
 * anything beyond that means we are almost certainly offline or behind.
 */
export const STALE_AFTER_DAYS = 4;

function daysBetween(earlier: IsoDate, later: IsoDate): number {
  const ms = Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * In-memory table of ECB-style reference rates.
 *
 * The ECB publishes EUR crosses only, so DKK/USD and any other non-EUR pair is
 * *derived*. Deriving a cross rate is not the same as round-tripping an amount
 * through EUR: we compute `rate(A→B) = rate(EUR→B) / rate(EUR→A)` once, at full
 * precision, and then apply that single rate to the amount exactly once. The
 * amount itself is never materialised in an intermediate currency, and it is
 * never rounded twice.
 */
export class FxRateTable implements RateProvider {
  /** currency -> ascending list of [date, EUR-quoted rate]. */
  private readonly byCurrency = new Map<CurrencyCode, Array<[IsoDate, Decimal]>>();

  constructor(rates: readonly StoredFxRate[] = []) {
    for (const r of rates) this.add(r);
    for (const series of this.byCurrency.values()) {
      series.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    }
  }

  /**
   * Rates must be EUR-based (base === 'EUR'). Storing a single base keeps the
   * table unambiguous; every other pair is derived on demand.
   */
  private add(r: StoredFxRate): void {
    if (r.base !== 'EUR') {
      throw new Error(
        `FxRateTable stores EUR-based reference rates only; got base=${r.base}. ` +
          `Convert the source feed to EUR crosses before storing.`,
      );
    }
    const series = this.byCurrency.get(r.quote) ?? [];
    series.push([r.date, new Dec(r.rate)]);
    this.byCurrency.set(r.quote, series);
  }

  /** Most recent EUR→currency rate published on or before `date`. */
  private eurRateOnOrBefore(date: IsoDate, currency: CurrencyCode): [IsoDate, Decimal] {
    if (currency === 'EUR') return [date, new Dec(1)];
    const series = this.byCurrency.get(currency);
    if (!series || series.length === 0) {
      throw new Error(`No FX rates loaded for EUR/${currency}.`);
    }
    // Linear scan backwards: series are short (a few years of daily rates) and
    // this keeps the lookup obvious. Swap for a binary search if it ever shows.
    for (let i = series.length - 1; i >= 0; i--) {
      const entry = series[i]!;
      if (entry[0] <= date) return entry;
    }
    throw new Error(
      `No FX rate for EUR/${currency} on or before ${date}; earliest known is ${series[0]![0]}.`,
    );
  }

  resolve(date: IsoDate, from: CurrencyCode, to: CurrencyCode): ResolvedRate {
    if (from === to) {
      return {
        from, to,
        rate: new Dec(1),
        asOf: date,
        requestedDate: date,
        stale: false,
        derivation: 'identity',
      };
    }

    const [fromDate, fromRate] = this.eurRateOnOrBefore(date, from);
    const [toDate, toRate] = this.eurRateOnOrBefore(date, to);

    // One division, full precision, applied once by the caller.
    const rate = toRate.dividedBy(fromRate);
    const asOf = fromDate < toDate ? fromDate : toDate;

    return {
      from, to, rate, asOf,
      requestedDate: date,
      stale: daysBetween(asOf, date) > STALE_AFTER_DAYS,
      derivation: from === 'EUR' || to === 'EUR' ? 'direct' : 'cross',
    };
  }

  /** Latest date for which any rate is known — the "today" of a stale table. */
  latestDate(): IsoDate | undefined {
    let latest: IsoDate | undefined;
    for (const series of this.byCurrency.values()) {
      const last = series.at(-1);
      if (last && (latest === undefined || last[0] > latest)) latest = last[0];
    }
    return latest;
  }
}
