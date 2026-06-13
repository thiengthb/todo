import { describe, expect, it } from 'vitest';
import { computeVelocity } from './velocity';

describe('computeVelocity', () => {
  it('returns null when there are no tasks at all', () => {
    expect(computeVelocity([])).toBeNull();
  });

  it('averages done tasks over the days that have data', () => {
    const tasks = [
      { date: '2025-06-01', done: true },
      { date: '2025-06-01', done: true },
      { date: '2025-06-02', done: true },
    ];
    expect(computeVelocity(tasks)).toEqual({ avgDonePerDay: 1.5, daysWithData: 2 });
  });

  it('counts a day that has tasks but none done (avg can be 0)', () => {
    const tasks = [
      { date: '2025-06-01', done: true },
      { date: '2025-06-01', done: true },
      { date: '2025-06-02', done: false },
    ];
    expect(computeVelocity(tasks)).toEqual({ avgDonePerDay: 1.0, daysWithData: 2 });
  });

  it('rounds the average to one decimal', () => {
    const tasks = [
      { date: '2025-06-01', done: true },
      { date: '2025-06-02', done: false },
      { date: '2025-06-03', done: false },
    ];
    // 1 done / 3 days = 0.333... -> 0.3
    expect(computeVelocity(tasks)).toEqual({ avgDonePerDay: 0.3, daysWithData: 3 });
  });
});
