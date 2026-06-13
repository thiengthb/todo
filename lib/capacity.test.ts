import { describe, expect, it } from 'vitest';
import { computeCapacity } from './capacity';

describe('computeCapacity', () => {
  it('returns null for a missing or fully-empty check-in', () => {
    expect(computeCapacity(null)).toBeNull();
    expect(
      computeCapacity({ energy: null, mood: null, stress: null, sleepHours: null }),
    ).toBeNull();
  });

  it('all-neutral with good sleep sits just above baseline', () => {
    // 50 + 0 + 0 - 0 + 6 (sleep >= 7) = 56
    expect(computeCapacity({ energy: 3, mood: 3, stress: 3, sleepHours: 7 })).toBe(56);
  });

  it('clamps a very good day to 100', () => {
    // 50 + 24 + 12 + 20 + 6 = 112 -> 100
    expect(computeCapacity({ energy: 5, mood: 5, stress: 1, sleepHours: 8 })).toBe(100);
  });

  it('clamps a very bad day to 0', () => {
    // 50 - 24 - 12 - 20 - 16 = -22 -> 0
    expect(computeCapacity({ energy: 1, mood: 1, stress: 5, sleepHours: 4 })).toBe(0);
  });

  it('uses only the fields that are present (graceful degrade)', () => {
    // 50 + (5-3)*12 = 74
    expect(computeCapacity({ energy: 5, mood: null, stress: null, sleepHours: null })).toBe(74);
  });

  it('penalizes short sleep and ignores the 6-7h dead band', () => {
    expect(computeCapacity({ energy: 3, mood: 3, stress: 3, sleepHours: 5 })).toBe(42); // 50 - 8
    expect(computeCapacity({ energy: 3, mood: 3, stress: 3, sleepHours: 6 })).toBe(50); // no adj
  });
});
