import type { CurrencyCode } from './currencies';

/**
 * ============================================================================
 * PLACEHOLDER VALUES — EDIT BEFORE PHASE 3 (analysis engine).
 * ============================================================================
 * Every figure below is invented. They exist so the app runs end to end on
 * synthetic data; none of them describes the real portfolio. The analysis
 * engine reads from here rather than hard-coding assumptions, so replacing
 * these values is the whole of "configuring the cockpit".
 */

export interface TargetAllocation {
  readonly equity: number;
  readonly bonds: number;
  readonly cash: number;
  readonly alternatives: number;
}

export interface GoalDefinition {
  readonly id: string;
  readonly name: string;
  /** Goals keep their own currency and are never silently normalised. */
  readonly targetAmountMajor: string;
  readonly currency: CurrencyCode;
  readonly targetDate: string;
  readonly priority: number;
}

export interface Profile {
  readonly targetAllocation: TargetAllocation;
  /** Drift beyond this many percentage points from target trips a rebalancing flag. */
  readonly rebalancingBandPct: number;
  /** Any single position above this share of invested assets is flagged. */
  readonly concentrationThresholdPct: number;
  readonly horizonYears: number;
  readonly riskPosture: 'conservative' | 'balanced' | 'growth' | 'aggressive';
  readonly monthlyBurn: { readonly amountMajor: string; readonly currency: CurrencyCode };
  readonly cashBufferMonths: number;
  /** Annual fee ratio (fees / assets) above which cost drag is flagged. */
  readonly feeRatioThresholdPct: number;
  readonly goals: readonly GoalDefinition[];
  /** Annual real return assumptions used for the three projection scenarios. */
  readonly returnAssumptions: {
    readonly conservative: number;
    readonly base: number;
    readonly optimistic: number;
  };
}

export const PROFILE: Profile = {
  // PLACEHOLDER
  targetAllocation: { equity: 70, bonds: 15, cash: 10, alternatives: 5 },
  rebalancingBandPct: 5,
  concentrationThresholdPct: 10,
  horizonYears: 15, // PLACEHOLDER
  riskPosture: 'balanced', // PLACEHOLDER
  monthlyBurn: { amountMajor: '18000', currency: 'DKK' }, // PLACEHOLDER
  cashBufferMonths: 6, // PLACEHOLDER
  feeRatioThresholdPct: 0.75,
  goals: [
    // PLACEHOLDER — both invented.
    {
      id: 'goal-property',
      name: 'Property deposit',
      targetAmountMajor: '400000',
      currency: 'DKK',
      targetDate: '2028-06-30',
      priority: 1,
    },
    {
      id: 'goal-wealth',
      name: 'Long-term wealth target',
      targetAmountMajor: '1000000',
      currency: 'EUR',
      targetDate: '2040-12-31',
      priority: 2,
    },
  ],
  returnAssumptions: { conservative: 0.02, base: 0.045, optimistic: 0.07 },
};

/** True while any placeholder is untouched — the UI shows a banner until then. */
export const PROFILE_IS_PLACEHOLDER = true;
