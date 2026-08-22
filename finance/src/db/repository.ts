import { desc, eq } from 'drizzle-orm';
import type { Db } from './client';
import { accounts, fxRates, snapshots } from './schema';
import { FxRateTable } from '@/domain/fx/rates';
import { money } from '@/domain/money';
import { assertCurrencyCode } from '@/config/currencies';
import type { AccountSnapshot, Liquidity } from '@/analysis/net-worth';
import type { IsoDate, StoredFxRate } from '@/domain/fx/types';
import type { AccountType } from '@/domain/adapters/types';

/**
 * Loading is the boundary where TEXT columns become typed domain values.
 * Currency codes are validated here rather than trusted, so an unknown code
 * from a future import fails loudly instead of silently mis-converting.
 */

export function loadRateTable(db: Db): FxRateTable {
  const rows = db.select().from(fxRates).all();
  return new FxRateTable(
    rows.map(
      (r): StoredFxRate => ({
        date: r.date,
        base: assertCurrencyCode(r.base),
        quote: assertCurrencyCode(r.quote),
        rate: r.rate,
      }),
    ),
  );
}

interface SnapshotRow {
  accountId: string;
  institution: string;
  name: string;
  type: string;
  asOf: string;
  valueMinor: number;
  valueCurrency: string;
  liquidity: string;
}

function toAccountSnapshot(r: SnapshotRow): AccountSnapshot {
  return {
    accountId: r.accountId,
    institution: r.institution,
    name: r.name,
    type: r.type as AccountType,
    liquidity: r.liquidity as Liquidity,
    asOf: r.asOf,
    value: money(r.valueMinor, assertCurrencyCode(r.valueCurrency)),
  };
}

const snapshotQuery = (db: Db) =>
  db
    .select({
      accountId: snapshots.accountId,
      institution: accounts.institution,
      name: accounts.name,
      type: accounts.type,
      asOf: snapshots.asOf,
      valueMinor: snapshots.valueMinor,
      valueCurrency: snapshots.valueCurrency,
      liquidity: snapshots.liquidity,
    })
    .from(snapshots)
    .innerJoin(accounts, eq(accounts.id, snapshots.accountId));

/** The most recent date for which any snapshot exists. */
export function latestSnapshotDate(db: Db): IsoDate | undefined {
  return db.select({ asOf: snapshots.asOf }).from(snapshots).orderBy(desc(snapshots.asOf)).get()
    ?.asOf;
}

export function loadSnapshotsOn(db: Db, asOf: IsoDate): readonly AccountSnapshot[] {
  return snapshotQuery(db)
    .where(eq(snapshots.asOf, asOf))
    .all()
    .map(toAccountSnapshot);
}

/** All history, grouped by date, for the net-worth series. */
export function loadSnapshotsByDate(db: Db): Map<IsoDate, AccountSnapshot[]> {
  const grouped = new Map<IsoDate, AccountSnapshot[]>();
  for (const row of snapshotQuery(db).all()) {
    const snapshot = toAccountSnapshot(row);
    const bucket = grouped.get(snapshot.asOf);
    if (bucket) bucket.push(snapshot);
    else grouped.set(snapshot.asOf, [snapshot]);
  }
  return grouped;
}
