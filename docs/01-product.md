# 01 — Product documentation

## 1. What Smart Todo is

A **personal, intelligent todo list** for a single user (the owner). You create tasks during the day, check
them off, and **rate the effort** (easy / normal / tiring). At end of day, one button: **the AI reads your
real history** and proposes a **feasible** list for tomorrow, with a **reason** for each item.

The core difference vs Todoist/TickTick/Notion: the app doesn't just _store tasks_, it **learns how you
actually work** (speed, perceived difficulty, delay level, energy) and adjusts its suggestions accordingly.

## 2. Central principle (invariant)

> The app does NOT optimize _task count_ — it optimizes the **probability that the user keeps adhering for
> years without burning out**.

Every feature passes 3 gates:

1. **Low friction** — any new input is _optional / one-tap / skippable_; the AI still works well when data is missing.
2. **Transparent** — every AI suggestion has a short `reason`, **traceable back to real data**.
3. **Ethical** — passes the "regret test" (will the user regret this nudge?); no dark patterns, no addiction
   mechanics, no anxiety.

## 3. User & scope

- **Single user** — no login, no multi-tenant, no authorization.
- Diverse goals: **learning/skill-building, work/projects, habits/health** — can be mixed.
- Light, fast: runs with `npm run dev`, data in one SQLite file.

## 4. How it works

### 4.1 A typical day (the short loop)

```
            ┌─────────────────────────────────────────────────────┐
            │                     TODAY PAGE                       │
            └─────────────────────────────────────────────────────┘
   Add task ──▶ Do & check it off ──▶ Rate effort (easy/normal/tiring)
       │                                          │
   (optional) Check-in: energy/mood/              │  (only opens once done —
    stress/sleep + end-of-day note                │   rating undone work is meaningless)
       │                                          ▼
       └────────────▶  Tap "Suggest todos for tomorrow"
                                   │
                                   ▼
                  AI reads ALL the real data → returns structured JSON
                  (carry-over, new tasks, plan tasks, alerts)
                                   │
                                   ▼
                  You pick which to "Add to tomorrow"  ◀── you're still the one deciding
```

### 4.2 The learning loop (long-term)

As each day passes, the real data thickens → suggestions fit your "shape" better and better:

```
   Tasks + emotion + speed + energy (today)
                  │   accumulate
                  ▼
   AI calibrates: difficulty per task type · capacity/day · often-slipped tasks
                  │
                  ▼
   Tomorrow's suggestion is closer to reality → you finish more → better data
                  └───────────────── repeat ─────────────────┘
```

### 4.3 Long-term plans (rolling roadmap)

For a big goal ("Learn Japanese in a month"), the app does **not** pre-generate a hard 30-day schedule (any
slip becomes a pile of overdue tasks → discouraging). Instead:

```
   Goal ──▶ AI splits it into a milestone ROADMAP (you can edit)
                  │  Week1 Hiragana → Week2 Katakana → Week3 vocab → Week4 simple sentences
                  ▼
   Each day: "Suggest tomorrow" DRIPS the next 1–2 tasks of the current milestone,
             tracking real pace. Fast → push ahead; slow → warn + let you choose
             (extend the deadline / drop a milestone / speed up).
```

## 5. Features & mechanics

| Feature | What it does | What it serves |
| --- | --- | --- |
| **Emotion rating** | one tap after finishing a task (easy/normal/tiring) | a perceived-difficulty signal, near-zero friction |
| **Suggest tomorrow** | AI returns a feasible list + reasons | removes the "what do I do today" burden |
| **Task splitting** | AI breaks a large/often-slipped task into steps | lowers the bar, builds momentum (tick each step) |
| **Most Important Task (MIT)** | highlights the single most worthwhile task | 80/20 prioritization |
| **"when/where" cue** | attaches an implementation intention to an important task | strongly raises the chance it gets done |
| **Plans + milestones** | long-term goals, rolling roadmap | sustainable progress at real pace |
| **Streak** | counts consecutive days, **1-day grace** | soft motivation, no punishment |
| **Check-in & capacity/day** | energy/mood/stress/sleep → "capacity" | AI lightens the load, suggests a **recovery day** when drained |
| **Slip reason** | one tap to log why a task was postponed | the AI learns to split / lighten |
| **Reflection** | a short line about habits from real data | a sense of competence + identity |

## 6. Scientific basis (distilled, with citations)

Features were chosen on **strong evidence × low friction**, and counter-productive things were **removed**.

### 6.1 What IS applied

- **Planning fallacy** — people estimate too optimistically; only ~30% of tasks finish by the self-set
  deadline (Buehler/Kahneman). The remedy = the "outside view" / **reference class**: track your own real
  numbers. → The app uses real speed & emotion to calibrate task count and difficulty.
  ([Planning fallacy — Wikipedia](https://en.wikipedia.org/wiki/Planning_fallacy))
- **Implementation intentions** ("when–then", location plans) — one of the strongest & cheapest
  interventions, **d ≈ 0.65** across ~94 studies (Gollwitzer & Sheeran). → an optional **cue** field for
  important tasks. ([Meta-analysis — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/))
- **Near goals > distant goals** (Bandura & Schunk 1981): near milestones motivate strongly, a distant goal
  alone has "no significant effect". → concentrate the UI on the next milestone + 2–5 tasks today, no bloated
  planning tier. ([Bandura & Schunk, JPSP 1981](https://uploads-ssl.webflow.com/59faaf5b01b9500001e95457/5bc552d85141987915dab842_Bandura%20&%20Schunk,%201981.pdf))
- **Self-compassion** after a stumble (Breines & Chen 2012): being kind to yourself _increases_ motivation
  to improve and _reduces_ procrastination — opposite to the "coddling" fear. → a neutral/kind tone on a
  miss, "shrink it + start again" instead of blame. ([Breines & Chen, PSPB 2012](https://journals.sagepub.com/doi/abs/10.1177/0146167212445599))
- **Habits & a 1-day grace** (Lally 2010; "never miss twice" — Atomic Habits): missing _one_ day doesn't hurt
  automaticity; only _two_ in a row is dangerous. → the streak forgives a 1-day gap.
  ([Lally — University of Surrey](https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally))
- **80/20 (Pareto)** — prioritize by _value ÷ effort_; highlight a single **Most Important Task (MIT)**.
- **Goal-gradient** (Kivetz 2006): the closer to the finish, the more effort; emphasize _distance remaining_
  ("2 tasks left") rather than "% done". ([Kivetz, Urminsky & Zheng 2006](https://journals.sagepub.com/doi/abs/10.1509/jmkr.43.1.39))
- **Streak loss-soft** (Silverman & Barasch 2022): streaks are strong via loss-aversion, but self-blame on a
  break is harmful — need _grace/repair_ and to blame the calendar, not the person.
  ([J. Consumer Research 2022](https://academic.oup.com/jcr/article/49/6/1095/6623414))
- **Identity-as-evidence** (Self-Perception; Atomic Habits): reflect the real pattern ("5/7 days you kept the
  rhythm — that looks like a habit") instead of making the user role-play an identity.

### 6.2 What is DELIBERATELY NOT done (because it backfires)

- **Points/XP/level/badge tied to task completion, variable reward, punishment.** Extrinsic reward _erodes_
  intrinsic motivation for an interesting activity — **d ≈ −0.34** across 128 studies (Deci, Koestner & Ryan
  1999, "overjustification effect"). For a self-development app, durable intrinsic motivation is exactly what
  must be preserved → every "reward" is turned into **informative feedback**.
  ([Deci, Koestner & Ryan 1999](https://home.ubalt.edu/tmitch/642/articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf))
- **A bloated weekly-planning tier** — mid/distant goals have little motivational effect alone (Bandura).
- **Baiting with unfinished work to create tension** — the Zeigarnik effect is _weak/refuted_ in a 2025
  meta-analysis; unfinished work only stops nagging once it _has a concrete plan_ (Masicampo & Baumeister). →
  the app splits tasks to lower the bar, not to nag under pressure. ([Nature HSSC 2025](https://www.nature.com/articles/s41599-025-05000-w))
- **"Willpower depletion / decision fatigue"** as a base mechanism — near-zero after a 23-lab replication. The
  app reduces decisions via _habits + AI suggestions_, not by "saving willpower".
  ([Ego depletion — Wikipedia](https://en.wikipedia.org/wiki/Ego_depletion))

### 6.3 The overall model (SDT + Fogg)

- **Self-Determination Theory** (Deci & Ryan): support **autonomy** (the AI _suggests_, you _choose_) and
  **competence** (real calibration + reflecting progress). Single-user, so "relatedness" is skipped.
- **Fogg Behavior Model** (B = MAP): behavior needs Motivation × Ability × Prompt. The cheapest & strongest
  lever is raising **Ability** (split the task), not pumping motivation. ([behaviormodel.org](https://www.behaviormodel.org/))

## 7. Completed roadmap

The behavioral layer was built in order of **decreasing benefit/friction** (applying 80/20 to the roadmap itself):

1. **Phase 1** — learn difficulty from emotion + AI auto-splits hard/slipped tasks (strongest evidence, zero new input).
2. **Phase 2** — "when/where" cues + grace streak + goal-gradient + kind tone.
3. **Phase 3** — 80/20 prioritization + Most Important Task (MIT).
4. **Phase 4** — Personal OS: check-in + capacity/day + recovery days.
5. **Phase 5** — slip reasons + identity reflection + informative feedback.

Per-part technical detail: see [02 — Technical](./02-technical.md).
