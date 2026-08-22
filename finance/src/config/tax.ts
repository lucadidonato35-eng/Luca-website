/**
 * Danish tax considerations — ISOLATED BY DESIGN.
 *
 * Nothing in this file asserts a tax treatment. Every entry describes a
 * situation that *may* be materially affected by a Danish rule, so the app can
 * raise a "verify with an adviser" flag next to the relevant figure. Tax logic
 * must never be scattered through the analysis engine: the engine asks this
 * module which flags apply and renders them as questions, not conclusions.
 *
 * Context this is written against: tax residence Denmark, with an Italian
 * brokerage account (Fineco) and a USD-based platform (eToro).
 */

export type TaxFlagId =
  | 'foreign-security-mark-to-market'
  | 'share-income-bands'
  | 'aktiesparekonto-capacity'
  | 'foreign-asset-reporting'
  | 'foreign-account-fx-gains';

export interface TaxFlag {
  readonly id: TaxFlagId;
  readonly title: string;
  /** What in the portfolio triggers the question. */
  readonly triggeredWhen: string;
  /** Phrased as a question to put to an adviser — never as a statement of law. */
  readonly question: string;
}

export const TAX_FLAGS: readonly TaxFlag[] = [
  {
    id: 'foreign-security-mark-to-market',
    title: 'Mark-to-market treatment of foreign securities',
    triggeredWhen: 'Any holding on a non-Danish platform, especially accumulating foreign ETFs.',
    question:
      'Are any of these holdings subject to Danish mark-to-market (lagerbeskatning) rather than ' +
      'realisation-based taxation, and does that change the after-tax return assumption?',
  },
  {
    id: 'share-income-bands',
    title: 'Share-income tax bands',
    triggeredWhen: 'Realised gains or dividends in a year.',
    question:
      'Does realising this gain cross a Danish share-income band threshold, and would deferring ' +
      'or splitting the realisation across tax years change the outcome?',
  },
  {
    id: 'aktiesparekonto-capacity',
    title: 'Aktiesparekonto capacity',
    triggeredWhen: 'Equity purchases made outside an aktiesparekonto while capacity may remain.',
    question:
      'Is there unused aktiesparekonto capacity this year, and would routing new equity ' +
      'contributions through it be preferable to the current account?',
  },
  {
    id: 'foreign-asset-reporting',
    title: 'Foreign asset reporting duties',
    triggeredWhen: 'Holding accounts at Fineco (IT) and eToro while tax resident in Denmark.',
    question:
      'Which of these foreign accounts and holdings carry a Danish reporting obligation, and ' +
      'are the current filings complete?',
  },
  {
    id: 'foreign-account-fx-gains',
    title: 'FX gains on foreign-currency accounts',
    triggeredWhen: 'Material balances held in EUR or USD accounts over time.',
    question:
      'Are currency gains on these foreign-currency balances themselves taxable in Denmark, ' +
      'separately from the underlying investments?',
  },
];

export const TAX_DISCLAIMER =
  'Tax flags are prompts to verify with a qualified adviser. Nothing here states how a rule ' +
  'applies to your situation.';

/** Shown on every generated brief. */
export const ADVICE_DISCLAIMER =
  'Decision-support only. This is not regulated financial, investment or tax advice; figures ' +
  'are computed from your own imported data and stated assumptions, and may be wrong.';
