import { formatCompact, formatCurrency, formatCurrencyExact, formatRate } from './economy.model';

describe('compact money', () => {
  it('keeps small gold readable and shortens the rest', () => {
    expect(formatCurrency(847)).toBe('847');
    expect(formatCurrency(1_000)).toBe('1K');
    expect(formatCurrency(1_250)).toBe('1.3K');
    expect(formatCurrency(3_400_000)).toBe('3.4M');
    expect(formatCurrency(1_000_000_000)).toBe('1B');
    expect(formatCurrency(2_000_000_000_000)).toBe('2T');
  });

  it('keeps the exact figure for assistive labels', () => {
    expect(formatCurrencyExact(1_000_000_000)).toBe('1,000,000,000');
    expect(formatCompact(1_250)).toBe('1.3K');
  });

  it('compacts a gold/sec rate that no longer fits a chip', () => {
    expect(formatRate(2.5)).toBe('2.5');
    expect(formatRate(12)).toBe('12');
    expect(formatRate(12_500)).toBe('12.5K');
  });
});
