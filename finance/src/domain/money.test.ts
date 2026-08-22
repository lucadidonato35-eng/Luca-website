import { describe, expect, it } from 'vitest';
import { Dec } from './decimal';
import {
  add,
  formatMoney,
  money,
  moneyFromMajor,
  negate,
  subtract,
  sum,
  toDecimal,
  zero,
} from './money';

describe('Money', () => {
  it('rejects fractional minor units', () => {
    expect(() => money(1234.5, 'DKK')).toThrow(/whole number of minor units/);
  });

  it('parses major-unit strings without floating-point drift', () => {
    // 0.1 + 0.2 in binary floating point is the canonical failure case.
    const a = moneyFromMajor('0.10', 'EUR');
    const b = moneyFromMajor('0.20', 'EUR');
    expect(add(a, b).minor).toBe(30);
    expect(toDecimal(add(a, b)).toString()).toBe('0.3');
  });

  it('rounds half-even at the minor unit', () => {
    expect(moneyFromMajor('1.005', 'DKK').minor).toBe(100);
    expect(moneyFromMajor('1.015', 'DKK').minor).toBe(102);
  });

  it('refuses to combine different currencies', () => {
    expect(() => add(money(100, 'DKK'), money(100, 'EUR'))).toThrow(/Refusing to combine/);
  });

  it('adds, subtracts and negates exactly', () => {
    const a = moneyFromMajor('84250.75', 'DKK');
    const b = moneyFromMajor('1249.25', 'DKK');
    expect(add(a, b).minor).toBe(8_550_000);
    expect(subtract(a, b).minor).toBe(8_300_150);
    expect(negate(b).minor).toBe(-124_925);
  });

  it('sums a list of same-currency amounts', () => {
    const items = ['10.01', '20.02', '30.03'].map((v) => moneyFromMajor(v, 'USD'));
    expect(sum(items, 'USD').minor).toBe(6006);
    expect(sum([], 'USD')).toEqual(zero('USD'));
  });

  it('survives a large round-trip through Decimal without loss', () => {
    const m = moneyFromMajor('12345678.91', 'DKK');
    expect(moneyFromMajor(toDecimal(m), 'DKK').minor).toBe(m.minor);
  });

  it('formats in the currency locale, rounding only at render', () => {
    const rendered = formatMoney(moneyFromMajor('1234.5', 'EUR'));
    expect(rendered).toMatch(/1\.234,50/);
    expect(rendered).toContain('€');
  });

  it('keeps 40 significant digits available for intermediate maths', () => {
    expect(new Dec(1).dividedBy(3).toSignificantDigits().sd()).toBe(40);
  });
});
