import { getDb } from '@/db/client';
import {
  latestSnapshotDate,
  loadRateTable,
  loadSnapshotsByDate,
  loadSnapshotsOn,
} from '@/db/repository';
import { getDisplayCurrency, getFxMode } from '@/lib/settings';
import { netWorthAt, netWorthSeries, shareOfTotal } from '@/analysis/net-worth';
import { roundToMoney } from '@/domain/fx/convert';
import { formatMoney } from '@/domain/money';
import { PROFILE_IS_PLACEHOLDER } from '@/config/profile';
import { CurrencySwitcher, FxModeToggle } from '@/components/Controls';
import type { Amount } from '@/domain/fx/types';

export const dynamic = 'force-dynamic';

const fmt = (a: Amount) => formatMoney(roundToMoney(a));

export default function Dashboard() {
  const db = getDb();
  const displayCurrency = getDisplayCurrency(db);
  const fxMode = getFxMode(db);
  const rates = loadRateTable(db);
  const asOf = latestSnapshotDate(db);

  if (!asOf) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-lg font-semibold">No data yet</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Run <code className="rounded bg-neutral-100 px-1">npm run db:seed</code> to load synthetic
          data.
        </p>
      </main>
    );
  }

  const today = rates.latestDate() ?? asOf;
  const options = { displayCurrency, rates, fxMode, today } as const;

  const netWorth = netWorthAt(loadSnapshotsOn(db, asOf), asOf, options);
  const history = loadSnapshotsByDate(db);

  // The 12-month change, and how much of it was currency rather than portfolio.
  const periodSeries = netWorthSeries(history, { ...options, fxMode: 'period-correct' });
  const constantSeries = netWorthSeries(history, { ...options, fxMode: 'constant' });
  const back = Math.max(0, periodSeries.length - 13);
  const changeValue = periodSeries.at(-1)!.total.value.minus(periodSeries[back]!.total.value);
  const constantChange = constantSeries.at(-1)!.total.value.minus(constantSeries[back]!.total.value);
  const fxPart = changeValue.minus(constantChange);
  const asAmount = (value: typeof changeValue): Amount => ({
    value,
    currency: displayCurrency,
    rates: [],
    stale: false,
  });

  const usedRates = netWorth.total.rates;
  const anyStale = netWorth.total.stale;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 figures">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <h1 className="text-base font-semibold">Finance cockpit</h1>
          <p className="text-xs text-neutral-500">
            Net worth as of {asOf} · {netWorth.byAccount.length} accounts · Danske Bank, Fineco,
            eToro
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <FxModeToggle current={fxMode} />
          <CurrencySwitcher current={displayCurrency} />
        </div>
      </header>

      <div className="mt-4 space-y-2">
        <Banner tone="warn">
          Synthetic data. Every figure below is invented seed data — no real statement has been
          imported yet.
        </Banner>
        {PROFILE_IS_PLACEHOLDER && (
          <Banner tone="info">
            Profile placeholders in <code>src/config/profile.ts</code> (target allocation, goals,
            monthly burn, cash buffer) are invented and need your real values before the analysis
            engine means anything.
          </Banner>
        )}
        {anyStale && (
          <Banner tone="warn">
            Some figures were converted using a stale FX rate — see the rate footnote below.
          </Banner>
        )}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-5 dark:border-neutral-800 dark:bg-neutral-800">
        <Stat label="Net worth" value={fmt(netWorth.total)} />
        <Stat
          label="Liquid"
          value={fmt(netWorth.byLiquidity.liquid)}
          note={`${shareOfTotal(netWorth.byLiquidity.liquid, netWorth.total).toFixed(1)}%`}
        />
        <Stat
          label="Invested"
          value={fmt(netWorth.byLiquidity.invested)}
          note={`${shareOfTotal(netWorth.byLiquidity.invested, netWorth.total).toFixed(1)}%`}
        />
        <Stat label="Change, 12m" value={fmt(asAmount(changeValue))} signed={changeValue.toNumber()} />
        <Stat
          label="…of which FX"
          value={fmt(asAmount(fxPart))}
          signed={fxPart.toNumber()}
          note="currency movement"
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Accounts
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
              <th className="py-1.5 font-medium">Account</th>
              <th className="py-1.5 font-medium">Type</th>
              <th className="py-1.5 text-right font-medium">Native</th>
              <th className="py-1.5 text-right font-medium">{displayCurrency}</th>
              <th className="py-1.5 text-right font-medium">Share</th>
              <th className="py-1.5 text-right font-medium">Rate applied</th>
            </tr>
          </thead>
          <tbody>
            {netWorth.byAccount.map((a) => {
              const rate = a.converted.rates[0];
              return (
                <tr
                  key={a.accountId}
                  className="border-b border-neutral-100 dark:border-neutral-900"
                >
                  <td className="py-1.5">
                    <span className="text-neutral-500">{a.institution}</span>{' '}
                    <span className="font-medium">{a.name}</span>
                  </td>
                  <td className="py-1.5 text-neutral-500">{a.liquidity}</td>
                  <td className="py-1.5 text-right text-neutral-500">
                    {formatMoney(a.value, { showCode: true })}
                  </td>
                  <td className="py-1.5 text-right font-medium">{fmt(a.converted)}</td>
                  <td className="py-1.5 text-right text-neutral-500">
                    {shareOfTotal(a.converted, netWorth.total).toFixed(1)}%
                  </td>
                  <td
                    className="py-1.5 text-right text-xs text-neutral-500"
                    title={
                      rate
                        ? `${rate.from}→${rate.to} = ${rate.rate.toSignificantDigits(10)} (${rate.derivation}), published ${rate.asOf}, requested ${rate.requestedDate}`
                        : 'No conversion: already in the display currency'
                    }
                  >
                    {rate ? (
                      <>
                        {rate.rate.toDecimalPlaces(5).toString()}
                        <span className={rate.stale ? 'text-amber-600' : ''}> @ {rate.asOf}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-neutral-300 font-semibold dark:border-neutral-700">
              <td className="py-2" colSpan={3}>
                Total
              </td>
              <td className="py-2 text-right">{fmt(netWorth.total)}</td>
              <td className="py-2 text-right">100.0%</td>
              <td />
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800">
        <p>
          Amounts are stored in each account&apos;s native currency and converted for display only,
          at{' '}
          {fxMode === 'constant'
            ? `a constant rate as of ${netWorth.rateDate}`
            : 'the rate as of each figure’s own date'}
          .
        </p>
        {usedRates.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {usedRates.map((r) => (
              <li key={`${r.from}${r.to}${r.asOf}`}>
                {r.from}→{r.to} = {r.rate.toSignificantDigits(10).toString()} ({r.derivation}),
                published {r.asOf}
                {r.stale && <span className="text-amber-600"> — stale</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3">
          Decision-support only. Not regulated financial, investment or tax advice. Read-only by
          design: this application never places orders.
        </p>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  note,
  signed,
}: {
  label: string;
  value: string;
  note?: string;
  signed?: number;
}) {
  const tone =
    signed === undefined
      ? ''
      : signed < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-emerald-700 dark:text-emerald-400';
  return (
    <div className="bg-white p-3 dark:bg-neutral-950">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone}`}>{value}</div>
      {note && <div className="text-xs text-neutral-500">{note}</div>}
    </div>
  );
}

function Banner({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  const styles =
    tone === 'warn'
      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
      : 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200';
  return <div className={`border px-3 py-2 text-xs ${styles}`}>{children}</div>;
}
