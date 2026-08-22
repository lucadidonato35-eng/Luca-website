import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { settings } from '@/db/schema';
import { DEFAULT_DISPLAY_CURRENCY, type CurrencyCode, isCurrencyCode } from '@/config/currencies';
import type { FxMode } from '@/domain/fx/convert';

/**
 * Local settings, persisted in the SQLite file alongside everything else. The
 * display currency is a global UI filter, not a property of any stored figure,
 * so it belongs here rather than in the domain model.
 */

const DISPLAY_CURRENCY_KEY = 'display_currency';
const FX_MODE_KEY = 'fx_mode';

function read(db: Db, key: string): string | undefined {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
}

function write(db: Db, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function getDisplayCurrency(db: Db): CurrencyCode {
  const stored = read(db, DISPLAY_CURRENCY_KEY);
  return stored && isCurrencyCode(stored) ? stored : DEFAULT_DISPLAY_CURRENCY;
}

export function setDisplayCurrency(db: Db, currency: CurrencyCode): void {
  write(db, DISPLAY_CURRENCY_KEY, currency);
}

export function getFxMode(db: Db): FxMode {
  return read(db, FX_MODE_KEY) === 'constant' ? 'constant' : 'period-correct';
}

export function setFxMode(db: Db, mode: FxMode): void {
  write(db, FX_MODE_KEY, mode);
}
