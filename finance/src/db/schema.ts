import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Conventions used throughout:
 *
 * - Money is `(*_minor INTEGER, *_currency TEXT)`. Amounts are stored in their
 *   native currency, in minor units. Nothing is converted at write time.
 * - Quantities and FX rates are TEXT decimal strings, kept at full source
 *   precision and parsed with decimal.js. SQLite has no decimal type and REAL
 *   would silently lose precision on both.
 * - Dates are TEXT `YYYY-MM-DD`, which sorts and compares correctly in SQLite.
 */

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  institution: text('institution').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['cash', 'brokerage', 'pension'] }).notNull(),
  /** Native denomination. Never a display currency. */
  currency: text('currency').notNull(),
  externalId: text('external_id'),
  sourceId: text('source_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const instruments = sqliteTable(
  'instruments',
  {
    id: text('id').primaryKey(),
    ticker: text('ticker').notNull(),
    isin: text('isin'),
    name: text('name').notNull(),
    assetClass: text('asset_class', {
      enum: ['equity', 'bond', 'cash', 'alternative', 'crypto', 'unknown'],
    })
      .notNull()
      .default('unknown'),
    sector: text('sector'),
    region: text('region'),
    /** Currency the instrument is listed in. */
    currency: text('currency').notNull(),
    /**
     * Underlying currency exposure as a JSON map, e.g. {"USD":0.62,"EUR":0.15}.
     * NULL means genuinely unknown — a USD-listed global ETF is not USD risk,
     * and we label that as unknown rather than defaulting to the listing currency.
     */
    underlyingExposure: text('underlying_exposure'),
  },
  (t) => [uniqueIndex('instruments_ticker_idx').on(t.ticker)],
);

export const positions = sqliteTable(
  'positions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    quantity: text('quantity').notNull(),
    costBasisMinor: integer('cost_basis_minor'),
    costBasisCurrency: text('cost_basis_currency'),
    marketValueMinor: integer('market_value_minor').notNull(),
    marketValueCurrency: text('market_value_currency').notNull(),
    asOf: text('as_of').notNull(),
  },
  (t) => [
    uniqueIndex('positions_account_instrument_asof_idx').on(t.accountId, t.instrumentId, t.asOf),
    index('positions_as_of_idx').on(t.asOf),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id').references(() => instruments.id),
    date: text('date').notNull(),
    type: text('type', {
      enum: ['buy', 'sell', 'dividend', 'fee', 'interest', 'transfer', 'income', 'expense', 'fx'],
    }).notNull(),
    amountMinor: integer('amount_minor').notNull(),
    amountCurrency: text('amount_currency').notNull(),
    quantity: text('quantity'),
    description: text('description').notNull().default(''),
    counterparty: text('counterparty'),
    externalId: text('external_id'),
    sourceId: text('source_id').notNull(),
    /** Deterministic hash of the transaction's identity. Makes imports idempotent. */
    dedupeHash: text('dedupe_hash').notNull(),
    importId: text('import_id').references(() => importLogs.id),
  },
  (t) => [
    uniqueIndex('transactions_dedupe_idx').on(t.dedupeHash),
    index('transactions_date_idx').on(t.date),
    index('transactions_account_date_idx').on(t.accountId, t.date),
  ],
);

/**
 * Point-in-time net worth per account, so history survives even when statements
 * are only imported monthly and positions are overwritten.
 */
export const snapshots = sqliteTable(
  'snapshots',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    asOf: text('as_of').notNull(),
    valueMinor: integer('value_minor').notNull(),
    valueCurrency: text('value_currency').notNull(),
    /** Split of the same value, for the liquid / invested / illiquid view. */
    liquidity: text('liquidity', { enum: ['liquid', 'invested', 'illiquid'] })
      .notNull()
      .default('liquid'),
  },
  (t) => [uniqueIndex('snapshots_account_asof_idx').on(t.accountId, t.asOf, t.liquidity)],
);

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmountMinor: integer('target_amount_minor').notNull(),
  /** Goals are denominated in a specific currency and are never silently normalised. */
  targetCurrency: text('target_currency').notNull(),
  targetDate: text('target_date').notNull(),
  priority: integer('priority').notNull().default(1),
  notes: text('notes'),
});

export const fxRates = sqliteTable(
  'fx_rates',
  {
    date: text('date').notNull(),
    /** Always 'EUR' for ECB reference rates; every other pair is derived. */
    base: text('base').notNull(),
    quote: text('quote').notNull(),
    /** Full-precision decimal string, exactly as published. */
    rate: text('rate').notNull(),
    source: text('source').notNull().default('ecb'),
    fetchedAt: text('fetched_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex('fx_rates_pk').on(t.date, t.base, t.quote)],
);

export const importLogs = sqliteTable('import_logs', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  filename: text('filename').notNull(),
  fileHash: text('file_hash').notNull(),
  importedAt: text('imported_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  rowsSeen: integer('rows_seen').notNull().default(0),
  rowsInserted: integer('rows_inserted').notNull().default(0),
  rowsDuplicate: integer('rows_duplicate').notNull().default(0),
  warnings: text('warnings'),
});

/** Local UI state, e.g. the chosen display currency. Never leaves the machine. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
