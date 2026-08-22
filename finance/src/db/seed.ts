/**
 * Synthetic seed data. Every figure here is invented — the point is to exercise
 * the full stack (three currencies, period-correct FX, monthly history) before
 * any real statement is imported. `npm run db:reset` rebuilds it from scratch.
 *
 * Deterministic by construction: the pseudo-random walk is seeded, so the same
 * command always produces the same database and test expectations stay stable.
 */
import { openDatabase } from './client';
import { accounts, fxRates, goals, instruments, positions, snapshots, transactions } from './schema';
import { moneyFromMajor } from '@/domain/money';
import { dedupeHash } from '@/domain/adapters/dedupe';
import { PROFILE } from '@/config/profile';
import type { NormalisedTransaction } from '@/domain/adapters/types';

const SOURCE_ID = 'synthetic-seed';
const MONTHS = 18;
/** Fixed end month so the seed is reproducible and never dated in the future. */
const END = { year: 2026, month: 7 };

/** Deterministic PRNG (mulberry32) so seeding is reproducible. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Month-end dates, oldest first. */
function monthEnds(count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = END.month - i;
    const year = END.year + Math.floor((m - 1) / 12);
    const month = ((((m - 1) % 12) + 12) % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    out.push(`${year}-${pad(month)}-${pad(lastDay)}`);
  }
  return out;
}

const dates = monthEnds(MONTHS);

function main(): void {
  const db = openDatabase();

  // Wipe in dependency order so re-seeding is idempotent.
  db.delete(transactions).run();
  db.delete(positions).run();
  db.delete(snapshots).run();
  db.delete(goals).run();
  db.delete(instruments).run();
  db.delete(accounts).run();
  db.delete(fxRates).run();

  seedFxRates(db);
  seedAccounts(db);
  seedInstruments(db);
  seedSnapshots(db);
  seedPositions(db);
  seedTransactions(db);
  seedGoals(db);

  console.log(`Seeded ${MONTHS} months of synthetic data across 5 accounts in DKK, EUR and USD.`);
  console.log('All figures are fictional. Replace with real imports in Phase 2.');
}

/**
 * ECB-style EUR crosses. DKK barely moves against EUR (it is pegged within a
 * narrow band); USD moves materially. That asymmetry is realistic and is what
 * makes the FX-effect decomposition worth having.
 */
function seedFxRates(db: ReturnType<typeof openDatabase>): void {
  const random = rng(20260820);
  let dkk = 7.4655;
  let usd = 1.0388;

  const rows = dates.map((date) => {
    dkk += (random() - 0.5) * 0.004;
    usd += (random() - 0.5) * 0.05;
    return [
      { date, base: 'EUR', quote: 'DKK', rate: dkk.toFixed(5), source: 'synthetic' },
      { date, base: 'EUR', quote: 'USD', rate: usd.toFixed(5), source: 'synthetic' },
    ];
  });

  db.insert(fxRates).values(rows.flat()).run();
}

const ACCOUNTS = [
  {
    id: 'acc-danske-current',
    institution: 'Danske Bank',
    name: 'Lønkonto',
    type: 'cash' as const,
    currency: 'DKK',
    liquidity: 'liquid' as const,
    start: 41_000,
  },
  {
    id: 'acc-danske-savings',
    institution: 'Danske Bank',
    name: 'Opsparingskonto',
    type: 'cash' as const,
    currency: 'DKK',
    liquidity: 'liquid' as const,
    start: 96_000,
  },
  {
    id: 'acc-fineco-cash',
    institution: 'Fineco',
    name: 'Conto corrente',
    type: 'cash' as const,
    currency: 'EUR',
    liquidity: 'liquid' as const,
    start: 4_200,
  },
  {
    id: 'acc-fineco-brokerage',
    institution: 'Fineco',
    name: 'Dossier titoli',
    type: 'brokerage' as const,
    currency: 'EUR',
    liquidity: 'invested' as const,
    start: 47_500,
  },
  {
    id: 'acc-etoro',
    institution: 'eToro',
    name: 'Trading account',
    type: 'brokerage' as const,
    currency: 'USD',
    liquidity: 'invested' as const,
    start: 14_300,
  },
];

function seedAccounts(db: ReturnType<typeof openDatabase>): void {
  db.insert(accounts)
    .values(
      ACCOUNTS.map((a) => ({
        id: a.id,
        institution: a.institution,
        name: a.name,
        type: a.type,
        currency: a.currency,
        externalId: `${a.id}-external`,
        sourceId: SOURCE_ID,
      })),
    )
    .run();
}

const INSTRUMENTS = [
  {
    id: 'ins-iwda',
    ticker: 'IWDA',
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World UCITS ETF',
    assetClass: 'equity' as const,
    sector: 'Diversified',
    region: 'Global',
    currency: 'EUR',
    // Listed in EUR, but the risk is overwhelmingly USD — the exact case the
    // spec calls out. Approximate index weights, flagged as an estimate.
    underlyingExposure: JSON.stringify({ USD: 0.71, EUR: 0.11, JPY: 0.06, GBP: 0.04, other: 0.08 }),
  },
  {
    id: 'ins-aggh',
    ticker: 'AGGH',
    isin: 'IE00BDBRDM35',
    name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged',
    assetClass: 'bond' as const,
    sector: 'Aggregate',
    region: 'Global',
    currency: 'EUR',
    underlyingExposure: JSON.stringify({ EUR: 1.0 }),
  },
  {
    id: 'ins-aapl',
    ticker: 'AAPL',
    isin: 'US0378331005',
    name: 'Apple Inc.',
    assetClass: 'equity' as const,
    sector: 'Technology',
    region: 'North America',
    currency: 'USD',
    underlyingExposure: JSON.stringify({ USD: 1.0 }),
  },
  {
    id: 'ins-nvo',
    ticker: 'NOVO-B',
    isin: 'DK0062498333',
    name: 'Novo Nordisk B',
    assetClass: 'equity' as const,
    sector: 'Healthcare',
    region: 'Europe',
    currency: 'DKK',
    underlyingExposure: JSON.stringify({ DKK: 1.0 }),
  },
  {
    id: 'ins-spy',
    ticker: 'SPY',
    isin: 'US78462F1030',
    name: 'SPDR S&P 500 ETF Trust',
    assetClass: 'equity' as const,
    sector: 'Diversified',
    region: 'North America',
    // Underlying exposure deliberately left NULL: unknown is labelled as
    // unknown rather than defaulting to the listing currency.
    currency: 'USD',
    underlyingExposure: null,
  },
];

function seedInstruments(db: ReturnType<typeof openDatabase>): void {
  db.insert(instruments).values(INSTRUMENTS).run();
}

/** Monthly value per account: a contribution trend plus a seeded random walk. */
function seedSnapshots(db: ReturnType<typeof openDatabase>): void {
  const rows: Array<typeof snapshots.$inferInsert> = [];

  for (const account of ACCOUNTS) {
    const random = rng(account.id.length * 7919 + 13);
    let value = account.start;
    const monthlyContribution = account.type === 'brokerage' ? account.start * 0.012 : 900;

    dates.forEach((date, i) => {
      const drift = account.type === 'brokerage' ? (random() - 0.42) * 0.05 : (random() - 0.5) * 0.01;
      value = value * (1 + drift) + monthlyContribution;
      const money = moneyFromMajor(value.toFixed(2), account.currency as 'DKK' | 'EUR' | 'USD');
      rows.push({
        id: `snap-${account.id}-${i}`,
        accountId: account.id,
        asOf: date,
        valueMinor: money.minor,
        valueCurrency: money.currency,
        liquidity: account.liquidity,
      });
    });
  }

  db.insert(snapshots).values(rows).run();
}

const HOLDINGS = [
  { account: 'acc-fineco-brokerage', instrument: 'ins-iwda', qty: '312.4180', price: '118.42', cur: 'EUR' },
  { account: 'acc-fineco-brokerage', instrument: 'ins-aggh', qty: '186.0000', price: '52.17', cur: 'EUR' },
  { account: 'acc-fineco-brokerage', instrument: 'ins-nvo', qty: '140.0000', price: '61.05', cur: 'EUR' },
  { account: 'acc-etoro', instrument: 'ins-aapl', qty: '38.2140', price: '214.60', cur: 'USD' },
  { account: 'acc-etoro', instrument: 'ins-spy', qty: '17.5000', price: '561.30', cur: 'USD' },
];

function seedPositions(db: ReturnType<typeof openDatabase>): void {
  const asOf = dates.at(-1)!;
  db.insert(positions)
    .values(
      HOLDINGS.map((h, i) => {
        const currency = h.cur as 'EUR' | 'USD';
        const marketValue = moneyFromMajor(
          (Number(h.qty) * Number(h.price)).toFixed(2),
          currency,
        );
        const costBasis = moneyFromMajor(
          (Number(h.qty) * Number(h.price) * 0.86).toFixed(2),
          currency,
        );
        return {
          id: `pos-${i}`,
          accountId: h.account,
          instrumentId: h.instrument,
          quantity: h.qty,
          costBasisMinor: costBasis.minor,
          costBasisCurrency: costBasis.currency,
          marketValueMinor: marketValue.minor,
          marketValueCurrency: marketValue.currency,
          asOf,
        };
      }),
    )
    .run();
}

/** A plausible monthly rhythm: salary in, rent and living out, contributions, fees. */
function seedTransactions(db: ReturnType<typeof openDatabase>): void {
  const rows: Array<typeof transactions.$inferInsert> = [];
  const random = rng(4242);
  let n = 0;

  const push = (tx: NormalisedTransaction, accountId: string, instrumentId?: string) => {
    rows.push({
      id: `tx-${n}`,
      accountId,
      instrumentId: instrumentId ?? null,
      date: tx.date,
      type: tx.type,
      amountMinor: tx.amount.minor,
      amountCurrency: tx.amount.currency,
      description: tx.description,
      counterparty: tx.counterparty ?? null,
      externalId: tx.externalId ?? null,
      sourceId: SOURCE_ID,
      dedupeHash: dedupeHash(SOURCE_ID, tx, n),
    });
    n += 1;
  };

  for (const date of dates) {
    const month = date.slice(0, 7);

    push(
      {
        accountExternalId: 'acc-danske-current',
        date: `${month}-25`,
        type: 'income',
        amount: moneyFromMajor('38500.00', 'DKK'),
        description: 'Løn',
        counterparty: 'Employer A/S',
        externalId: `salary-${month}`,
      },
      'acc-danske-current',
    );

    push(
      {
        accountExternalId: 'acc-danske-current',
        date: `${month}-01`,
        type: 'expense',
        amount: moneyFromMajor('-11200.00', 'DKK'),
        description: 'Husleje',
        counterparty: 'Landlord',
        externalId: `rent-${month}`,
      },
      'acc-danske-current',
    );

    push(
      {
        accountExternalId: 'acc-danske-current',
        date: `${month}-15`,
        type: 'expense',
        amount: moneyFromMajor((-6000 - random() * 3000).toFixed(2), 'DKK'),
        description: 'Dagligvarer og øvrigt forbrug',
        externalId: `living-${month}`,
      },
      'acc-danske-current',
    );

    push(
      {
        accountExternalId: 'acc-fineco-brokerage',
        date: `${month}-05`,
        type: 'buy',
        amount: moneyFromMajor('-600.00', 'EUR'),
        description: 'Acquisto IWDA — piano di accumulo',
        externalId: `pac-${month}`,
        instrumentTicker: 'IWDA',
        quantity: '5.0000',
      },
      'acc-fineco-brokerage',
      'ins-iwda',
    );

    push(
      {
        accountExternalId: 'acc-fineco-brokerage',
        date: `${month}-05`,
        type: 'fee',
        amount: moneyFromMajor('-2.95', 'EUR'),
        description: 'Commissione di negoziazione',
        externalId: `fee-fineco-${month}`,
      },
      'acc-fineco-brokerage',
    );

    // eToro's costs are the ones worth watching: an FX conversion spread on
    // every non-USD funding, plus a withdrawal fee.
    push(
      {
        accountExternalId: 'acc-etoro',
        date: `${month}-08`,
        type: 'fx',
        amount: moneyFromMajor('-4.50', 'USD'),
        description: 'Currency conversion fee',
        externalId: `etoro-fx-${month}`,
      },
      'acc-etoro',
    );
  }

  // A few one-off events, so not every month looks identical.
  push(
    {
      accountExternalId: 'acc-fineco-brokerage',
      date: '2026-03-18',
      type: 'dividend',
      amount: moneyFromMajor('184.20', 'EUR'),
      description: 'Dividendo NOVO-B',
      externalId: 'div-novo-2026-03',
    },
    'acc-fineco-brokerage',
    'ins-nvo',
  );
  push(
    {
      accountExternalId: 'acc-etoro',
      date: '2026-05-02',
      type: 'sell',
      amount: moneyFromMajor('2310.75', 'USD'),
      description: 'Sell AAPL',
      externalId: 'sell-aapl-2026-05',
      quantity: '10.0000',
    },
    'acc-etoro',
    'ins-aapl',
  );
  push(
    {
      accountExternalId: 'acc-danske-savings',
      date: '2026-06-30',
      type: 'interest',
      amount: moneyFromMajor('412.88', 'DKK'),
      description: 'Renter',
      externalId: 'interest-2026-h1',
    },
    'acc-danske-savings',
  );

  db.insert(transactions).values(rows).run();
}

function seedGoals(db: ReturnType<typeof openDatabase>): void {
  db.insert(goals)
    .values(
      PROFILE.goals.map((g) => {
        const target = moneyFromMajor(g.targetAmountMajor, g.currency);
        return {
          id: g.id,
          name: g.name,
          targetAmountMinor: target.minor,
          targetCurrency: target.currency,
          targetDate: g.targetDate,
          priority: g.priority,
          notes: 'Placeholder goal from config/profile.ts — edit before Phase 3.',
        };
      }),
    )
    .run();
}

main();
