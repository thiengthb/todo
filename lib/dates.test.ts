import { describe, expect, it } from 'vitest';
import { toDateStr, daysBetween, addDays, isValidDateStr, weekdayShortVN, mondayOf } from './dates';

describe('toDateStr', () => {
  it('formats a Date to YYYY-MM-DD in local time, zero-padded', () => {
    expect(toDateStr(new Date(2025, 0, 5))).toBe('2025-01-05');
    expect(toDateStr(new Date(2025, 11, 31))).toBe('2025-12-31');
    expect(toDateStr(new Date(2025, 0, 1))).toBe('2025-01-01');
  });
});

describe('daysBetween', () => {
  it('returns the whole-day difference (to - from)', () => {
    expect(daysBetween('2025-01-01', '2025-01-04')).toBe(3);
    expect(daysBetween('2025-01-04', '2025-01-01')).toBe(-3);
    expect(daysBetween('2025-06-10', '2025-06-10')).toBe(0);
  });

  it('counts across a leap day', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('addDays', () => {
  it('rolls over months and years, and goes backward', () => {
    expect(addDays('2025-01-30', 3)).toBe('2025-02-02');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
  });
});

describe('isValidDateStr', () => {
  it('accepts a well-formed real date', () => {
    expect(isValidDateStr('2025-06-10')).toBe(true);
  });

  it('rejects an out-of-range month, missing dashes, or single-digit day', () => {
    expect(isValidDateStr('2025-13-01')).toBe(false);
    expect(isValidDateStr('20250610')).toBe(false);
    expect(isValidDateStr('2025-06-1')).toBe(false);
  });
});

describe('weekdayShortVN', () => {
  it('maps 0..6 to CN..T7', () => {
    expect(weekdayShortVN(0)).toBe('CN');
    expect(weekdayShortVN(1)).toBe('T2');
    expect(weekdayShortVN(6)).toBe('T7');
  });

  it('wraps out-of-range indices', () => {
    expect(weekdayShortVN(-1)).toBe('T7');
    expect(weekdayShortVN(8)).toBe('T2');
  });
});

describe('mondayOf', () => {
  it('returns the Monday of the week (week starts Monday)', () => {
    expect(mondayOf('2025-06-08')).toBe('2025-06-02'); // Sunday -> previous Monday
    expect(mondayOf('2025-06-09')).toBe('2025-06-09'); // Monday -> itself
    expect(mondayOf('2025-06-14')).toBe('2025-06-09'); // Saturday -> that week's Monday
  });
});
