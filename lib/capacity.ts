/**
 * "Capacity" (energy/day) computed DYNAMICALLY (section 11) — not stored.
 *
 * Evidence note: energy-based planning is reasonable but the evidence is SOFT, so this is only
 * a secondary signal helping the AI lighten/hold the load, NOT an absolute number. Every check-in field is
 * optional — if absent, return null and the AI just relies on real velocity as before (graceful degrade).
 */
export interface DayCheckinLite {
  energy: number | null;
  mood: number | null;
  stress: number | null;
  sleepHours: number | null;
}

/**
 * Map the signals (1..5 scale, sleep in hours) to 0..100. Returns null if the check-in is empty.
 * Around 50 = normal; energy/mood pull up, stress pulls down, sleep < 6h subtracts points.
 */
export function computeCapacity(c: DayCheckinLite | null): number | null {
  if (!c) return null;
  const hasAny = c.energy != null || c.mood != null || c.stress != null || c.sleepHours != null;
  if (!hasAny) return null;

  let score = 50;
  if (c.energy != null) score += (c.energy - 3) * 12; // ±24
  if (c.mood != null) score += (c.mood - 3) * 6; // ±12
  if (c.stress != null) score -= (c.stress - 3) * 10; // ∓20
  if (c.sleepHours != null) {
    if (c.sleepHours < 6) score -= (6 - c.sleepHours) * 8;
    else if (c.sleepHours >= 7) score += 6;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
