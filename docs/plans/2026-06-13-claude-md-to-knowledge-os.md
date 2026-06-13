---
title: Finish todo's Knowledge OS — add 00-map + decisions, translate CLAUDE.md to English
status: done
created: 2026-06-13
updated: 2026-06-13  # 00-map + decisions + English CLAUDE.md done; spec-docs translation is the open follow-up
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
- [x] Write `docs/00-map.md` (English primer) — done 2026-06-13 (~1 page: module map + flows + invariants + secrets).
- [x] Create `docs/decisions.md`, seeded with the foundational whys — done 2026-06-13.
- [x] Translate `CLAUDE.md` → English (331 lines, 0 VN remaining), structure + every invariant preserved, kept thin — done 2026-06-13.
- [x] **Translate the spec docs to English** — `01-product`, `02-technical`, `03-user-guide`, `04-features-spec`,
  `README` all translated (done 2026-06-13, one commit each). Remaining VN strings are deliberate UI labels (tab
  names, button copy) and the `intensity` enum value `"vừa"`. Also fixed README's stale deploy section
  (self-hosted runner / port 3002 → real ghcr + Watchtower) and the MCP tool list (Project removed).
- [x] Update `nuc-platform/06-knowledge-ledger.md §B` pointer for todo (decisions.md established) — done.
- [x] Verified: no broken doc cross-refs; docs-only so the build is unaffected (`paths-ignore` skips it).

## Out of scope
No app code / behavior / schema changes. No re-slimming CLAUDE.md (already done). No redesign.

## Open questions / risks
- Risk: a subtle invariant lost in translation → map every CLAUDE.md section to its meaning before editing.
- Confirm 01–04 docs are fully English prose (not just code comments) — if not, fold translation into this pass.

## Decisions to distill (→ decisions.md when this closes)
- todo's CLAUDE.md was slimmed (463→327) by extracting feature specs to `docs/04-features-spec.md` — the pattern for keeping a per-project CLAUDE.md thin.
- Highest-value whys to capture: §11 behavioral-layer invariants (optimise long-term adherence, not task count; the LÀM/KHÔNG evidence list, overjustification d≈−0.34); dynamic-compute over stored columns (delay/streak/progress/difficulty/capacity); the §15 stateless JWT OAuth shim + the Anthropic 2026-06 claude.ai bearer bug.
