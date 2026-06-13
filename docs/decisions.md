# Knowledge log — Smart Todo

> Architecture decisions + pitfalls + the *why*, recorded so the next session doesn't re-derive them or
> repeat mistakes. Append-only, **newest on top**. Standard: `nuc-platform/05-documentation-standard.md §5`.
> Record only the non-obvious (what code/git doesn't say on its own). Maintained by `/session-wrap`.

---

## 2026-06-13 — Foundational design decisions (seeded from the established spec)

This log was started when todo's spec moved out of `CLAUDE.md` into the doc-set. Dates below are when
recorded, not necessarily when first decided. The non-obvious *why*s behind the existing design:

- **Optimize long-term adherence, not task-count (the deepest invariant).** Every mechanic passes 3 gates —
  low-friction · transparent · ethical (regret test). Explicitly NO XP/level/badge/points-on-completion,
  variable reward, punishment, or anxiety-push notifications. **Why:** extrinsic reward on already-intrinsic
  behavior backfires (overjustification effect, d≈−0.34); the evidence-backed DO/DON'T list lives in
  `04-features-spec.md §11`. New features must not violate this.
- **Dynamic compute over stored columns.** delay, streak, progress, behind-days, difficulty, capacity,
  free-minutes are computed on read (`lib/{plan,difficulty,capacity,velocity,streak,schedule}.ts`), never
  persisted. **Why:** a stored derived value goes stale the moment its source changes; recompute is cheap and
  always correct. (Platform-wide lesson — see `nuc-platform/06-knowledge-ledger.md`.)
- **Plan = rolling roadmap, never a 30-day prefill.** A plan stores milestones; daily tasks are dripped 1–2
  at a time through `/api/suggest` from roadmap position + real pace. **Why:** pre-generating 30 days means any
  slip becomes a pile of overdue tasks — the opposite of the feasibility goal. Creating a plan does NOT spawn
  tasks; the user ticks milestones (the AI only suggests).
- **MCP runs in-process; AI logic lives on Claude's side — the server only CRUDs + serves context.**
  `app/api/[transport]` shares `lib/db` + helpers; one process writes SQLite. The sync rules in
  `lib/mcp/repository.ts` exist because the app filters by `done`/`date`, NOT `status`: set `scheduledFor` ⇒
  set local `date`; `status=DONE` ⇒ `done=true`+`completedAt`; `delete_task` = **HARD delete** (a soft
  CANCELLED task would leak into the UI). `Project` was removed from MCP — long-term goals route to `Plan`.
- **Stateless OAuth shim for claude.ai web.** code/access/refresh are HMAC-signed JWTs (`lib/mcp/oauth.ts`,
  no DB table); PKCE S256 required; consent gate = the owner enters `MCP_AUTH_TOKEN`. **Why:** claude.ai web
  only supports OAuth (no pasted bearer), and a stateless shim avoids a session table. ⚠️ Known Anthropic bug
  (2026-06): claude.ai web sometimes completes OAuth but doesn't attach the bearer (401 loop) — the server is
  spec-correct; fall back to Desktop/Cursor if hit.
- **Schedule is a context layer, and the AI's slots are a suggestion the server re-validates.**
  `lib/schedule.computeFreeSlots` recomputes free time server-side and discards any AI-proposed slot that
  collides with a hard commitment (trust boundary). Calendar entries are NOT Tasks → never counted in
  streak/stats/completion.
- **Tab roles + naming are a single source of truth (`CLAUDE.md §16`).** Each tab has ONE role + ONE name
  ("Kế hoạch" = `/plans` only, "Ấp ủ" = `/incubating` only, "Việc" = a dated task, "Lịch" = a weekly
  commitment). **Why:** AI-via-MCP was scattering "plans" across History and Plans, and `Project` was
  invisible — so the naming was pinned and MCP tool descriptions map onto it.

**Meta:** `CLAUDE.md` was slimmed (463→327) by extracting the feature spec to `04-features-spec.md`; this
session added `00-map.md` + this log and translated `CLAUDE.md` to English — completing the Knowledge OS
doc-set for the reference web-app (plan `docs/plans/2026-06-13-claude-md-to-knowledge-os.md`).

---

_(Add new decisions/pitfalls above this line, newest on top.)_
