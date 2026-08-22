import type { Decimal } from '../decimal';
import type { CurrencyCode } from '@/config/currencies';

/** An ISO date, YYYY-MM-DD. Dates are the unit of FX resolution here. */
export type IsoDate = string;

/** A stored rate: `rate` units of `quote` per one unit of `base`. */
export interface StoredFxRate {
  readonly date: IsoDate;
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
  /** Full-precision decimal string, exactly as published. */
  readonly rate: string;
}

/**
 * A rate actually applied to a figure, carried alongside the result so the UI
 * can always show which rate was used and when it was published.
 */
export interface ResolvedRate {
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  readonly rate: Decimal;
  /** Publication date of the underlying rate(s). */
  readonly asOf: IsoDate;
  /** The date the caller asked for; differs from asOf on weekends/holidays. */
  readonly requestedDate: IsoDate;
  /** True when asOf is materially older than requestedDate (see STALE_AFTER_DAYS). */
  readonly stale: boolean;
  /** How the rate was obtained, for the footnote. */
  readonly derivation: 'identity' | 'direct' | 'cross';
}

/**
 * A computed, converted figure. Unlike Money it is *not* rounded: analysis
 * carries full precision end to end and rounds once, at render. This is what
 * makes "net worth in DKK, converted to EUR" equal "net worth in EUR".
 */
export interface Amount {
  readonly value: Decimal;
  readonly currency: CurrencyCode;
  /** Every rate that contributed, deduplicated. Empty for same-currency sums. */
  readonly rates: readonly ResolvedRate[];
  /** True if any contributing rate was stale. Propagates through aggregation. */
  readonly stale: boolean;
}

export interface RateProvider {
  /**
   * The rate to convert `from` into `to` as of `date`, using the most recent
   * publication on or before that date.
   */
  resolve(date: IsoDate, from: CurrencyCode, to: CurrencyCode): ResolvedRate;
}
