import DecimalJs from 'decimal.js';

/**
 * A locally configured Decimal constructor. We clone rather than mutate the
 * global so that precision settings here can never be changed out from under us
 * by another dependency.
 *
 * 40 significant digits is far more than any figure in this app needs; the
 * headroom exists so that chained conversions (cross-rate derivation, then
 * application to an amount) do not accumulate visible error.
 */
export const Dec = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_EVEN,
  toExpNeg: -30,
  toExpPos: 30,
});

export type Decimal = InstanceType<typeof Dec>;
