export type Emotion = 'love' | 'meh' | 'hard';

export type Priority = 'high' | 'medium' | 'low';

/** An AI suggestion — always carries a reason traceable back to real data */
export interface SuggestionItem {
  title: string;
  priority: Priority;
  reason: string;
  /**
   * When a task is too big / often slips, the AI may suggest breaking it into small steps (section 11).
   * Empty/absent = single task. "Add to Tomorrow" will create a parent task + these subtasks.
   */
  subtasks?: string[];
  /** suggested "when/where" to do it (implementation intention, section 11) — optional */
  cue?: string;
  /** AI-suggested start time, "HH:MM" — falls inside a free slot (section 14); already validated by the server */
  slotStart?: string;
  /** AI-suggested duration estimate (minutes) — section 14 */
  estimatedMinutes?: number;
  /** AI flags a task as requiring deep focus (section 14) */
  deepWork?: boolean;
}

/** A suggestion serving a plan — carries links to attach the task to a plan/milestone */
export interface PlanSuggestionItem extends SuggestionItem {
  planId: string;
  milestoneId: string | null;
}

/** Behind-schedule alert (section 10.4) — figures computed DYNAMICALLY on the server, not made up by the model */
export interface PlanAlert {
  planId: string;
  planTitle: string;
  behindDays: number;
  options: string[];
}

/**
 * Suggestion to pull a goal out of "Incubating" and act on it (section 17) — only when there is real spare time.
 * `suggestApproach` = a SIZE hint (drag into a task or promote into a plan); the user decides.
 */
export interface QueuePullItem {
  goalId: string;
  title: string;
  suggestApproach: 'task' | 'plan';
  reason: string;
}

/** JSON contract the model must return (spec section 6 + plan group section 10.7 + incubating section 17) */
export interface SuggestionResult {
  capacity_note: string;
  carry_over: SuggestionItem[];
  suggested_tasks: SuggestionItem[];
  /** tasks fed from a running plan — filled by the model */
  plan_tasks: PlanSuggestionItem[];
  /** suggestion to pull "Incubating" goals out when there is spare time (section 17) — filled by the model */
  queue_pulls: QueuePullItem[];
  /** behind-schedule alerts — filled by the server after the model returns */
  plan_alerts: PlanAlert[];
  /** recovery day (section 11): low energy / many "hard" days → only suggest light tasks */
  recovery_day: boolean;
}

/** Compact DTO for client components — delay precomputed on the server */
export interface TaskDTO {
  id: string;
  title: string;
  done: boolean;
  emotion: Emotion | null;
  /** number of days delayed (0 if the task is new today) */
  delay: number;
  /** plan name if the task serves a plan (section 10) — to show a chip */
  planTitle?: string | null;
  /** child steps if this task is a broken-down "container" (section 11) */
  subtasks?: TaskDTO[];
  /** "when/where" hint (implementation intention, section 11) — optional */
  cue?: string | null;
  /** 80/20 impact level (section 11) — to compute the "main task" (MIT) */
  impact?: Priority | null;
  /** slip reason if recorded (section 11) */
  slipReason?: string | null;
  /** duration estimate (minutes) — section 14 */
  estimatedMinutes?: number | null;
  /** task requiring deep focus (section 14) */
  deepWork?: boolean;
  /** one-tap duration feedback on completion: "faster" | "asExpected" | "slower" */
  actualBucket?: string | null;
  /** planned time "HH:MM" (section 14) — to place on the timeline; null = not yet scheduled */
  scheduledFor?: string | null;
}

// ---- Plan (section 10) ----

export type PlanStatus = 'active' | 'paused' | 'done' | 'archived';
export type Intensity = 'nhẹ' | 'vừa' | 'dồn';

/** A milestone returned by the model from the decompose step (no id yet, not saved to the DB) */
export interface MilestoneDraft {
  title: string;
  order: number;
  targetDate: string | null;
}

/** JSON contract for the /api/plan/decompose route */
export interface DecomposeResult {
  milestones: MilestoneDraft[];
}

// ---- Schedule (section 14) ----

export type ScheduleKind = 'hoc' | 'lam' | 'khac';

/** Hard schedule repeating weekly (matches the Commitment model) */
export interface CommitmentDTO {
  id: string;
  title: string;
  dayOfWeek: number; // 0=Sun .. 6=Sat
  startTime: string; // "HH:MM"
  endTime: string;
  kind: ScheduleKind;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  weekParity: string | null; // null | "odd" | "even"
}

/** Soft time block repeating weekly — time-blocking, movable (matches the SoftBlock model) */
export interface SoftBlockDTO {
  id: string;
  title: string;
  dayOfWeek: number; // 0=Sun .. 6=Sat
  startTime: string; // "HH:MM"
  endTime: string;
  kind: ScheduleKind;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  weekParity: string | null; // null | "odd" | "even"
}

/** Habit (section 11) — daysOfWeek CSV "1,2,3" or null = daily */
export interface HabitDTO {
  id: string;
  title: string;
  daysOfWeek: string | null;
  active: boolean;
}

/** Dynamic state of a habit on a given day (lib/habits.ts) */
export interface HabitStatus {
  dueToday: boolean;
  doneToday: boolean;
  streak: number; // number of consecutive due-days ticked (informational, no points)
}

/** One-off ad-hoc event (matches the ScheduleEvent model) */
export interface ScheduleEventDTO {
  id: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  startTime: string | null;
  endTime: string | null;
  kind: ScheduleKind;
  cancels: boolean;
}

/** A schedule block "flattened" for a specific day (commitment or event) */
export interface ScheduleBlock {
  id: string;
  title: string;
  startTime: string | null; // null = all day
  endTime: string | null;
  kind: ScheduleKind;
  source: 'commitment' | 'event' | 'soft';
}

/** A free time slot in a day (section 14) — computed dynamically from computeFreeSlots */
export interface FreeSlot {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  durationMin: number;
}

/** Result of computing a day's time budget (section 14) */
export interface CapacityResult {
  slots: FreeSlot[];
  capacityMin: number; // total free minutes (after buffer, dropping short slots)
  wakingMin: number; // total minutes during waking hours
  busyMin: number; // total busy minutes (overlaps merged + buffer)
}

/** Schedule configuration (lib/schedule-settings.ts) — matches the ScheduleSettings model */
export interface ScheduleSettingsDTO {
  wakeTime: string;
  sleepTime: string;
  bufferMin: number;
  minSlotMin: number;
  termAnchorMonday: string | null;
}

// ---- Discord notifications (section 13) ----

/** Notification kinds — match the `kind` column of NotificationLog */
export type NotificationKind =
  | 'morning' // morning briefing
  | 'streak_guard' // streak-keeping reminder when atRisk
  | 'random_nudge' // random nudge to do a task
  | 'evening' // evening wrap-up
  | 'queue_nudge'; // reminder to pull an "Incubating" goal out when free (section 17)

/** Intensity preset — just a UI hint to quickly set the toggles below */
export type NotificationIntensity = 'minimal' | 'balanced' | 'active';

/** Notification configuration (1 row, single-user app) — matches the Prisma model */
export interface NotificationSettingsDTO {
  enabled: boolean;
  discordWebhookUrl: string;
  intensity: NotificationIntensity;
  morningEnabled: boolean;
  morningTime: string;
  streakGuardEnabled: boolean;
  streakGuardTime: string;
  randomNudgeEnabled: boolean;
  eveningEnabled: boolean;
  eveningTime: string;
  /** "Incubating" reminder when free (section 17) — shares the randomWindow window */
  queueNudgeEnabled: boolean;
  randomWindowStart: string;
  randomWindowEnd: string;
  quietStart: string;
  quietEnd: string;
  includeMotivation: boolean;
  includeQuote: boolean;
  includeTip: boolean;
}

// ---- Incubating (section 17): queue of uncommitted goals ----

export type GoalStatus = 'incubating' | 'promoted' | 'dropped';

/** Compact DTO for the client — age/staleness precomputed on the server (lib/queue.ts) */
export interface GoalDTO {
  id: string;
  title: string;
  note: string | null;
  status: GoalStatus;
  pinned: boolean;
  snoozedUntil: string | null;
  /** number of days since capture (dynamic) */
  ageDays: number;
  /** ≥30 days, not pinned, not snoozed → enable the "keep / drop" hint (section 11.2) */
  isStale: boolean;
}

/** DYNAMICALLY computed progress of a plan (lib/plan.ts) — not stored in the DB */
export interface PlanProgress {
  total: number;
  done: number;
  progressPct: number;
  /** > 0: behind; < 0: ahead; 0: on schedule */
  behindDays: number;
  daysLeft: number;
  /** milestone in progress (first not-done milestone), null if all done */
  currentMilestone: string | null;
}
