# Finance cockpit

A local-first personal finance cockpit. It consolidates holdings and cash across
Danske Bank (DKK), Fineco (EUR) and eToro (USD), normalises them into one
multi-currency view, and — from Phase 5 — produces a periodic advisory brief.

**Status: Phase 1 (scaffold) complete.** The app runs end to end on synthetic
data. No real statement has been imported yet.

## Privacy and safety properties

These are structural, not aspirational:

- **Nothing leaves the machine.** No analytics, no telemetry, no cloud sync. The
  only outbound request the finished app makes is to the ECB reference-rate feed
  (Phase 2), and to the Anthropic API *only* if you enable the narrative layer
  (Phase 5) — the app is fully functional with it disabled.
- **Read-only by design.** There is no code path that places an order, and none
  will be added.
- **Secrets live in `.env`**, which is gitignored, as are `*.db` and
  `data/imports/`.
- **Decision-support, not advice.** Every brief carries a disclaimer. Tax
  considerations are raised as questions to put to an adviser, never as
  statements of how a rule applies — see `src/config/tax.ts`.

## Setup

```bash
cd finance
npm install
cp .env.example .env      # optional; defaults work
npm run db:migrate
npm run db:seed           # synthetic data — safe to run repeatedly
npm run dev               # http://localhost:3000
```

`npm run db:reset` deletes the database and rebuilds it from the seed.

Requires Node 20+. **TypeScript is pinned to 5.x**: Next 15 calls the TS 5
compiler API, and TypeScript 7 (the native port) breaks both `next.config.ts`
loading and `paths` resolution.

## How money and currency work

This is the part worth understanding before reading any other code.

**There is no base currency.** Each account is natively denominated and stays
that way. Amounts are stored as an integer number of minor units alongside their
ISO currency code (`amount_minor`, `amount_currency`), so no stored figure is
ever subject to floating-point drift, and **nothing is converted at write time**.

Conversion is purely a presentation and analysis concern:

- **Display currency is a global UI filter.** Switching it re-renders every
  figure from the same underlying native data. The choice is persisted in the
  local `settings` table. Default DKK; the list is config-driven in
  `src/config/currencies.ts`.
- **Rounding happens once, at render.** Analysis carries full-precision
  `Decimal` values end to end (`Amount`), and `roundToMoney` is the single
  rounding boundary. This is what makes net worth computed in DKK and converted
  to EUR *equal* net worth computed directly in EUR — asserted in
  `src/analysis/net-worth.test.ts` for every ordered pair of currencies.
- **Historical series use period-correct rates.** Each point converts at the
  rate as of that point's own date. The **Constant FX** toggle re-values every
  point at today's rate instead; the gap between the two views is the currency
  effect, surfaced on the dashboard as "…of which FX".
- **Cross rates are derived, amounts are not round-tripped.** The ECB publishes
  EUR crosses only, so DKK→USD is computed as one rate at full precision and
  applied to the amount exactly once. The amount is never materialised in an
  intermediate currency.
- **Every converted figure shows its rate and as-of date**, and a rate older
  than four days is flagged stale rather than silently used.

## Layout

```
src/
  config/       currencies, profile (your figures), tax flags — edit these
  domain/       Money, Decimal, FX, and the SourceAdapter seam
  analysis/     deterministic metrics; every function takes display currency
  db/           schema, client, migrations, repository, synthetic seed
  app/          Next.js App Router UI
```

`src/domain/adapters/types.ts` is the one abstraction seam: institution-specific
parsing lives behind `SourceAdapter`, so a PSD2 open-banking connector can later
replace a CSV adapter without touching anything downstream.

## Before Phase 3

`src/config/profile.ts` currently holds **invented placeholder values** for
target allocation, goals, monthly burn, cash buffer, horizon and risk posture.
The analysis engine reads from that file, so replacing those values is the whole
of configuring the cockpit. The dashboard shows a banner until you do.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local app on :3000 |
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Load synthetic data |
| `npm run db:reset` | Delete DB, migrate, seed |
| `npm run db:generate` | Generate a migration after a schema change |

## Roadmap

1. ~~Scaffold — schema, migrations, synthetic seed, currency plumbing~~ ✅
2. Ingestion — Danske / Fineco / eToro adapters against real export headers,
   idempotent imports, import log
3. Analysis engine — allocation, drift, savings rate, cost drag, cash buffer,
   goals, projections
4. Dashboard
5. Advisory brief — rule-based flags first, narrative layer second
6. Hardening — encryption at rest, backup/export, monthly routine
