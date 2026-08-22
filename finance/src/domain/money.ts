import { Dec, type Decimal } from './decimal';
import { type CurrencyCode, currencyDef } from '@/config/currencies';

/**
 * Money — an exact, stored amount in its native currency.
 *
 * Held as an integer number of minor units (øre, cent) so that no stored figure
 * is ever subject to binary floating-point drift. SQLite's INTEGER is 64-bit;
 * the JS driver surfaces it as a number, which is exact to 2^53 minor units
 * (~90 trillion DKK) — ample here, and guarded below.
 *
 * Money is never converted. Conversion produces an `Amount` (see fx/convert),
 * which carries full precision and is rounded only at render.
 */
export interface Money {
  readonly minor: number;
  readonly currency: CurrencyCode;
}

const MAX_MINOR = Number.MAX_SAFE_INTEGER;

export function money(minor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(minor)) {
    throw new Error(`Money must be a whole number of minor units, got ${minor}`);
  }
  if (Math.abs(minor) > MAX_MINOR) {
    throw new Error(`Money exceeds exact-integer range: ${minor}`);
  }
  return { minor, currency };
}

export const zero = (currency: CurrencyCode): Money => money(0, currency);

/** Minor units per major unit, e.g. 100 for DKK. */
export function minorPerMajor(currency: CurrencyCode): Decimal {
  return new Dec(10).pow(currencyDef(currency).exponent);
}

/**
 * Parse a decimal string in *major* units ("1234.56") into Money.
 * Half-even rounding at the currency's minor unit, so repeated parsing of the
 * same input is stable and unbiased.
 */
export function moneyFromMajor(major: string | number | Decimal, currency: CurrencyCode): Money {
  const minor = new Dec(major as never)
    .times(minorPerMajor(currency))
    .toDecimalPlaces(0, Dec.ROUND_HALF_EVEN);
  return money(minor.toNumber(), currency);
}

/** Full-precision major-unit value of a Money, for use in calculations. */
export function toDecimal(m: Money): Decimal {
  return new Dec(m.minor).dividedBy(minorPerMajor(m.currency));
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Refusing to combine ${a.currency} and ${b.currency}. Convert to a display ` +
        `currency explicitly via the FX layer — arithmetic never converts implicitly.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function negate(m: Money): Money {
  return money(-m.minor, m.currency);
}

/** Sum of same-currency amounts. Throws if the list mixes currencies. */
export function sum(amounts: readonly Money[], currency: CurrencyCode): Money {
  return amounts.reduce<Money>((acc, m) => add(acc, m), zero(currency));
}

export const isZero = (m: Money): boolean => m.minor === 0;
export const isNegative = (m: Money): boolean => m.minor < 0;

/** Locale-aware rendering. Rounding happens here and nowhere earlier. */
export function formatMoney(m: Money, options: { showCode?: boolean } = {}): string {
  return formatDecimal(toDecimal(m), m.currency, options);
}

export function formatDecimal(
  value: Decimal,
  currency: CurrencyCode,
  options: { showCode?: boolean; maximumFractionDigits?: number } = {},
): string {
  const def = currencyDef(currency);
  const digits = options.maximumFractionDigits ?? def.exponent;
  const formatted = new Intl.NumberFormat(def.locale, {
    style: 'currency',
    currency: def.code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value.toNumber());
  return options.showCode ? `${formatted} ${def.code}` : formatted;
}
