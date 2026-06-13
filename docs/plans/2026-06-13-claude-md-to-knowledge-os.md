---
title: Finish todo's Knowledge OS — add 00-map + decisions, translate CLAUDE.md to English
status: draft
created: 2026-06-13
updated: 2026-06-13
related: [CLAUDE.md, docs/01-product.md, docs/02-technical.md, docs/03-user-guide.md, docs/04-features-spec.md, ../../nuc-platform/05-documentation-standard.md, ../../nuc-platform/06-knowledge-ledger.md]
---

## Goal
todo (the platform's reference web-app) fully satisfies the Knowledge OS: a `docs/00-map.md` AI primer
exists, `docs/decisions.md` exists, and `CLAUDE.md` is thin **and in English**. The context-loading path
(`INVENTORY → docs/00-map.md → docs/`) works for todo.

## Context (corrected 2026-06-13 — earlier read was a stale local checkout)
Earlier analysis assumed CLAUDE.md was a 463-line VN spec with no docs split. The **actual remote** is
further along: CLAUDE.md is already slimmed to **327 lines** with §10–17 summarized + detail extracted to
`docs/04-features-spec.md`, and `docs/{01-product,02-technical,03-user-guide,04-features-spec}.md` exist.
**Remaining real gaps:** (1) no `docs/00-map.md` (the "always read first" primer); (2) no
`docs/decisions.md` (knowledge log); (3) `CLAUDE.md` is still **Vietnamese** (dev-artifact rule = English).
yakudoku already has 00-map + decisions — todo still lags its own reference standard on these.

## Approach & tradeoffs
- **Write `docs/00-map.md` fresh** (1-page English primer) modeled on `yakudoku/docs/00-map.md`: essence ·
  module map · key flows · invariants · secrets · pointers. Synthesize from the existing 01–04 docs + code.
- **Create `docs/decisions.md`** from the template; seed with the non-obvious whys (below).
- **Translate `CLAUDE.md` to English** in place, keeping it thin (it's already well-structured at 327 lines —
  this is a translation pass, not a re-slim). Keep the §12 UI-shell + §16 tab-role rules inline (they're
  high-frequency conventions); leave feature detail in `04-features-spec.md`.
- **Ruled out:** re-splitting CLAUDE.md (already done well); touching app code (out of scope).
- **Tradeoff:** translation must preserve every invariant precisely — map each section before editing.

## Steps
- [ ] Write `docs/00-map.md` (English primer) · Test: covers module map + flows + invariants + secrets in ~1 page.
- [ ] Create `docs/decisions.md` from `project-docs` template; seed the whys (see below).
- [ ] Translate `CLAUDE.md` → English, preserving structure + every invariant; keep it thin.
- [ ] Verify `04-features-spec.md` + 01/02/03 are English too (comments already translated — confirm prose).
- [ ] Update `06-knowledge-ledger.md §B` pointer for todo; run `/session-wrap`.
- [ ] Verify: no broken doc cross-refs; build unaffected (docs-only; `paths-ignore` now skips it).

## Out of scope
No app code / behavior / schema changes. No re-slimming CLAUDE.md (already done). No redesign.

## Open questions / risks
- Risk: a subtle invariant lost in translation → map every CLAUDE.md section to its meaning before editing.
- Confirm 01–04 docs are fully English prose (not just code comments) — if not, fold translation into this pass.

## Decisions to distill (→ decisions.md when this closes)
- todo's CLAUDE.md was slimmed (463→327) by extracting feature specs to `docs/04-features-spec.md` — the pattern for keeping a per-project CLAUDE.md thin.
- Highest-value whys to capture: §11 behavioral-layer invariants (optimise long-term adherence, not task count; the LÀM/KHÔNG evidence list, overjustification d≈−0.34); dynamic-compute over stored columns (delay/streak/progress/difficulty/capacity); the §15 stateless JWT OAuth shim + the Anthropic 2026-06 claude.ai bearer bug.
