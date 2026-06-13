import { describe, expect, it } from 'vitest';
import { computeStreaks } from './streak';

// computeStreaks is fully pure: it takes `today` as a parameter (no clock).
describe('computeStreaks', () => {
  it('returns an empty summary for no active days', () => {
    expect(computeStreaks([], '2025-06-10')).toEqual({
      current: 0,
      atRisk: false,
      longest: 0,
      runs: [],
    });
  });

  it('counts today as a live streak of 1', () => {
    const s = computeStreaks(['2025-06-10'], '2025-06-10');
    expect(s.current).toBe(1);
    expect(s.atRisk).toBe(false);
    expect(s.longest).toBe(1);
  });

  it('keeps the streak at risk after a 1-day gap (grace)', () => {
    const s = computeStreaks(['2025-06-09'], '2025-06-10');
    expect(s.current).toBe(1);
    expect(s.atRisk).toBe(true);
  });

  it('still alive after a 2-day gap (grace day frozen)', () => {
    const s = computeStreaks(['2025-06-08'], '2025-06-10');
    expect(s.current).toBe(1);
    expect(s.atRisk).toBe(true);
  });

  it('breaks the streak once two days are missed (gap >= 3)', () => {
    const s = computeStreaks(['2025-06-07'], '2025-06-10');
    expect(s.current).toBe(0);
    expect(s.atRisk).toBe(false);
  });

  it('merges across a single missed day into one run', () => {
    const s = computeStreaks(['2025-06-08', '2025-06-10'], '2025-06-10');
    expect(s.runs).toHaveLength(1);
    expect(s.current).toBe(2); // length counts real active days, not the frozen one
    expect(s.longest).toBe(2);
  });

  it('splits into two runs when two consecutive days are missed', () => {
    const s = computeStreaks(['2025-06-07', '2025-06-10'], '2025-06-10');
    expect(s.runs).toHaveLength(2);
    expect(s.current).toBe(1); // only today's fresh run is current
  });

  it('longest is the max over all historical runs, not the current one', () => {
    // 05+07 merge (gap 2) into a run of 2; 10 starts a new run (gap 3) of 1
    const s = computeStreaks(['2025-06-05', '2025-06-07', '2025-06-10'], '2025-06-10');
    expect(s.longest).toBe(2);
    expect(s.current).toBe(1);
  });

  it('dedupes duplicate days and ignores future days', () => {
    expect(computeStreaks(['2025-06-10', '2025-06-10'], '2025-06-10').current).toBe(1);
    expect(computeStreaks(['2025-06-12'], '2025-06-10').current).toBe(0); // future filtered
  });

  it('returns runs most-recent-first', () => {
    const s = computeStreaks(['2025-06-01', '2025-06-10'], '2025-06-10');
    expect(s.runs[0].start).toBe('2025-06-10');
  });
});
