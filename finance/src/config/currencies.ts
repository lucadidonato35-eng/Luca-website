/**
 * Config-driven currency list. Adding a currency here makes it available as a
 * display currency throughout the app — dashboard, charts, drift, goals, brief.
 * No currency is privileged: there is no base currency in this system.
 */

export interface CurrencyDef {
  /** ISO 4217 code. */
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  /** Decimal places in the minor unit (DKK/EUR/USD = 2, JPY = 0). */
  readonly exponent: number;
  /** BCP 47 locale used for formatting figures in this currency. */
  readonly locale: string;
}

export const CURRENCIES = {
  DKK: { code: 'DKK', name: 'Danish krone', symbol: 'kr.', exponent: 2, locale: 'da-DK' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', exponent: 2, locale: 'de-DE' },
  USD: { code: 'USD', name: 'US dollar', symbol: '$', exponent: 2, locale: 'en-US' },
} as const satisfies Record<string, CurrencyDef>;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Currencies offered in the display-currency switcher, in menu order. */
export const DISPLAY_CURRENCIES: readonly CurrencyCode[] = ['DKK', 'EUR', 'USD'];

/** Initial display currency. The user's choice, once made, is persisted. */
export const DEFAULT_DISPLAY_CURRENCY: CurrencyCode = 'DKK';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

export function currencyDef(code: CurrencyCode): CurrencyDef {
  return CURRENCIES[code];
}

/** Throws on an unknown code — use at trust boundaries (parsers, URL params). */
export function assertCurrencyCode(value: string): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new Error(`Unknown currency code: ${value}. Add it to config/currencies.ts.`);
  }
  return value;
}
