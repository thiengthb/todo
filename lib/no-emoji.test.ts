import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Platform rule: NO emoji in the codebase — not in the UI, not in user-facing copy, not in a protocol
 * string sent to a model, not in a comment. Use a lucide icon, a markdown heading, or plain words.
 *
 * Why a test and not a line in the conventions: the rule was already written down ("lucide icons ONLY,
 * no emoji as a UI icon-marker") and was broken anyway — measured 2026-07-29 across the fleet, in 14
 * files in three apps that all had the prose. A written rule is a reminder; a failing test is a gate.
 *
 * The case against emoji, concretely: they are decoration posing as structure (a markdown heading
 * anchors a "copy this verbatim" block better than a pictograph, and costs fewer tokens on text re-sent
 * every turn), and they leak across layers — one app baked emoji INTO a label formatter and the UI then
 * called stripEmoji() to take them back out.
 *
 * Per-repo configuration lives OUTSIDE this file, in docs/gates.json, so the file itself stays identical
 * in every repo and a fork is never needed to add an exception:
 *
 *   { "no-emoji": { "roots": ["app", "components", "lib"], "allow": ["lib/protocol.ts"] } }
 *
 * An exception is a listed, deliberate decision — never a silent weakening of the regex.
 */

// Pictographs, dingbats, symbols, variation selector and keycap combiner. Deliberately EXCLUDES the
// arrow block (U+2190-21FF) so "A -> B" written as an arrow survives in a comment, and of course all
// CJK and Vietnamese text.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/u;

const DEFAULT_ROOTS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next', 'dist', 'build', '.git']);

interface GateConfig {
  roots?: string[];
  allow?: string[];
}

function readConfig(): GateConfig {
  const path = join(process.cwd(), 'docs', 'gates.json');
  if (!existsSync(path)) return {};
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const gate = (parsed as Record<string, unknown>)?.['no-emoji'];
  return (gate as GateConfig) ?? {};
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('no emoji anywhere in the codebase', () => {
  it('finds no emoji in the scanned roots', () => {
    const config = readConfig();
    const roots = (config.roots ?? DEFAULT_ROOTS).filter((root) => existsSync(root));
    // This file necessarily NAMES the ranges it bans; it holds escape sequences, not emoji, but keep it
    // out of the walk so the rule can never fail on its own definition.
    const allow = new Set(['lib/no-emoji.test.ts', ...(config.allow ?? [])]);

    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        const rel = relative(process.cwd(), file).split(sep).join('/');
        if (allow.has(rel)) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (EMOJI.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
          });
      }
    }

    // Reported as one list so a failure names every site at once, not one per run.
    expect(
      offenders,
      `Emoji found (use a lucide icon, a markdown heading, or plain words). Add a deliberate exception to docs/gates.json "no-emoji".allow if a site is genuinely required:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
