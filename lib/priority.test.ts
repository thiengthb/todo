import { describe, expect, it } from 'vitest';
import type { TaskDTO } from './types';
import { pickMitId } from './priority';

// Build a minimal TaskDTO with only the fields valueScore reads.
const task = (over: Partial<TaskDTO> & { id: string }): TaskDTO =>
  ({ done: false, impact: null, planTitle: null, delay: 0, ...over }) as TaskDTO;

describe('pickMitId', () => {
  it('returns null with fewer than 2 undone tasks', () => {
    expect(pickMitId([])).toBeNull();
    expect(pickMitId([task({ id: 'a', impact: 'high' })])).toBeNull();
  });

  it('returns null when no task has any signal (all score 0)', () => {
    expect(pickMitId([task({ id: 'a' }), task({ id: 'b' })])).toBeNull();
  });

  it('picks the high-impact task over a no-signal one', () => {
    expect(pickMitId([task({ id: 'a' }), task({ id: 'b', impact: 'high' })])).toBe('b');
  });

  it('a plan membership alone is enough of a signal', () => {
    expect(pickMitId([task({ id: 'a' }), task({ id: 'b', planTitle: 'X' })])).toBe('b');
  });

  it('caps the delay contribution at 5', () => {
    // impact medium (20) + plan (3) + delay capped (5) = 28 beats delay-only (5)
    const winner = task({ id: 'a', impact: 'medium', planTitle: 'X', delay: 3 });
    const other = task({ id: 'b', delay: 10 });
    expect(pickMitId([other, winner])).toBe('a');
  });

  it('ignores done tasks even if they would score high', () => {
    const doneHigh = task({ id: 'a', done: true, impact: 'high' });
    const undone = task({ id: 'b', impact: 'low' });
    // only 1 undone -> null (the done one is filtered out before the count check)
    expect(pickMitId([doneHigh, undone])).toBeNull();
  });
});
