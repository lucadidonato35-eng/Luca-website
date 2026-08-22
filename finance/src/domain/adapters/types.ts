import type { Money } from '../money';
import type { IsoDate } from '../fx/types';
import type { CurrencyCode } from '@/config/currencies';

/**
 * The one abstraction seam in this codebase.
 *
 * Everything upstream of it (CSV quirks, XLSX sheet layouts, European decimal
 * commas, DD-MM-YYYY dates, an institution's idea of what a "fee" is) lives
 * inside an adapter. Everything downstream sees only normalised records.
 *
 * The point of the seam is replaceability: a PSD2 open-banking connector
 * (GoCardless Bank Account Data, Tink) implements this same interface and drops
 * in where `DanskeCsvAdapter` sat, with nothing downstream changed. Hence the
 * input is an opaque byte buffer plus metadata rather than a file path — a
 * connector has no file.
 */

export type AccountType = 'cash' | 'brokerage' | 'pension';

export type TransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'fee'
  | 'interest'
  | 'transfer'
  | 'income'
  | 'expense'
  | 'fx';

/** An account as the source describes it, before it is matched to a local one. */
export interface NormalisedAccount {
  readonly externalId: string;
  readonly institution: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: CurrencyCode;
}

export interface NormalisedInstrument {
  readonly ticker: string;
  readonly isin?: string;
  readonly name: string;
  /** Currency the instrument is *listed* in — not necessarily its risk currency. */
  readonly currency: CurrencyCode;
}

export interface NormalisedPosition {
  readonly accountExternalId: string;
  readonly instrument: NormalisedInstrument;
  /** Full-precision decimal string; fractional shares are normal on eToro. */
  readonly quantity: string;
  readonly costBasis?: Money;
  readonly marketValue: Money;
  readonly asOf: IsoDate;
}

export interface NormalisedTransaction {
  readonly accountExternalId: string;
  readonly date: IsoDate;
  readonly type: TransactionType;
  /** Signed, in the transaction's own currency. Never converted by an adapter. */
  readonly amount: Money;
  readonly description: string;
  readonly counterparty?: string;
  /** The source's own reference, when it provides a stable one. */
  readonly externalId?: string;
  readonly instrumentTicker?: string;
  readonly quantity?: string;
}

export interface ParsedStatement {
  readonly accounts: readonly NormalisedAccount[];
  readonly positions: readonly NormalisedPosition[];
  readonly transactions: readonly NormalisedTransaction[];
  /** Rows the adapter could not interpret. Surfaced in the import log, never dropped silently. */
  readonly warnings: readonly string[];
}

export interface SourceFile {
  readonly filename: string;
  readonly bytes: Uint8Array;
}

export interface SourceAdapter {
  /** Stable identifier, e.g. 'danske-csv'. Part of the dedupe key. */
  readonly id: string;
  readonly institution: string;
  /** Whether this adapter recognises the file — used to auto-route an import. */
  canParse(file: SourceFile): boolean;
  parse(file: SourceFile): Promise<ParsedStatement>;
}
