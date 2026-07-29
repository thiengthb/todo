#!/usr/bin/env bash
#
# Rebuild a local containerized app and verify it ACTUALLY SERVES. Generic: every app-specific value
# comes from scripts/verify.env (or flags), so this file stays byte-identical in every repo.
#
#   bash scripts/rebuild-and-verify.sh                # build, wait for health, sweep routes
#   bash scripts/rebuild-and-verify.sh --gates        # run lint/test/format first (fail before the build)
#   bash scripts/rebuild-and-verify.sh --no-build     # compose up without rebuilding, then verify
#   bash scripts/rebuild-and-verify.sh --verify-only  # touch docker NOT AT ALL — health + routes only
#   bash scripts/rebuild-and-verify.sh --timeout 180
#
# Use --verify-only against an app that is already serving (a smoke check, or anything public where
# `compose up` could recreate the container and cause downtime).
#
# Per-repo config — create scripts/verify.env (it is sourced if present):
#   SERVICE=myapp                       # compose service name, used for `logs` on failure
#   BASE=http://localhost:3000          # where the app answers
#   HEALTH=/api/health                  # health path
#   EXPECT='"ok":true'                  # substring the health body must contain
#   ROUTES="/ /settings /guide"         # every route a user can reach
#   COMPOSE_FILES="-f docker-compose.yml"
#   GATE_CMDS="npm run lint|npm test|npm run format:check"
#
# Why this exists (carried over from the app it was extracted from, where the same sequence was run by
# hand ~14 times and got it wrong twice): an unbounded `until` wait hung the terminal, and success was
# once declared from a green BUILD without ever loading a page. Both traps are closed here — every wait
# is bounded, and the exit code reflects the ROUTES, not the build.

set -uo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

# ---------------------------------------------------------------- config
SERVICE=""
BASE="http://localhost:3000"
HEALTH="/api/health"
EXPECT='"ok":true'
ROUTES="/"
COMPOSE_FILES=""
GATE_CMDS="npm run lint|npm test|npm run format:check"

# shellcheck source=/dev/null
[ -f "$ROOT/scripts/verify.env" ] && . "$ROOT/scripts/verify.env"

BUILD=1
GATES=0
TIMEOUT=120

while [ $# -gt 0 ]; do
  case "$1" in
    --no-build) BUILD=0 ;;
    --verify-only) BUILD=-1 ;;
    --gates) GATES=1 ;;
    --timeout) TIMEOUT="${2:?--timeout needs a value}"; shift ;;
    --url) BASE="${2:?--url needs a value}"; shift ;;
    --routes) ROUTES="${2:?--routes needs a value}"; shift ;;
    --service) SERVICE="${2:?--service needs a value}"; shift ;;
    -h|--help) sed -n '3,26p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown flag: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

FAILURES=0
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32mOK\033[0m   %s\n' "$*"; }
bad()  { printf '   \033[31mFAIL\033[0m %s\n' "$*"; FAILURES=$((FAILURES + 1)); }
note() { printf '   ---- %s\n' "$*"; }

# ---------------------------------------------------------------- gates (opt-in)
if [ "$GATES" = 1 ]; then
  step "Gates"
  log="$(mktemp)"
  # A failing gate means the code is wrong; building a broken image wastes minutes.
  while IFS= read -r g; do
    [ -z "$g" ] && continue
    if eval "$g" >"$log" 2>&1; then ok "$g"; else bad "$g"; tail -20 "$log"; fi
  done <<< "${GATE_CMDS//|/$'\n'}"
  rm -f "$log"
  [ "$FAILURES" -gt 0 ] && { printf '\n%s gate(s) failed — not building.\n' "$FAILURES"; exit 1; }
fi

# ---------------------------------------------------------------- build & start
# shellcheck disable=SC2086
if [ "$BUILD" = 1 ]; then
  step "docker compose up -d --build"
  docker compose $COMPOSE_FILES up -d --build || { bad "compose build/up"; exit 1; }
elif [ "$BUILD" = 0 ]; then
  step "docker compose up -d (no rebuild)"
  docker compose $COMPOSE_FILES up -d || { bad "compose up"; exit 1; }
else
  step "Verify only — docker untouched"
fi

# ---------------------------------------------------------------- bounded health wait
# NEVER an unbounded `until` — a container that never turns healthy must END the script, not hang it.
step "Waiting for $HEALTH (max ${TIMEOUT}s)"
deadline=$(( $(date +%s) + TIMEOUT ))
healthy=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  if curl -fsS --max-time 3 "$BASE$HEALTH" 2>/dev/null | grep -qF "$EXPECT"; then
    healthy=1
    break
  fi
  printf '.'
  sleep 2
done
printf '\n'

if [ "$healthy" != 1 ]; then
  bad "never reported healthy within ${TIMEOUT}s (expected $EXPECT at $BASE$HEALTH)"
  # Only ask compose for logs if we actually drove compose — otherwise this prints a confusing
  # "no configuration file provided" from whatever directory --verify-only was run in.
  if [ -n "$SERVICE" ] && [ "$BUILD" != -1 ]; then
    note "last 40 log lines:"
    docker compose $COMPOSE_FILES logs --tail 40 "$SERVICE"
  fi
  exit 1
fi
ok "$HEALTH contains $EXPECT"

# ---------------------------------------------------------------- route sweep
# A green build says NOTHING about whether a page renders — a server-component throw is a runtime 500.
step "Route sweep"
for route in $ROUTES; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE$route")
  case "$code" in
    200|30[0-8]) ok "$route ($code)" ;;
    *) bad "$route ($code)" ;;
  esac
done

# ---------------------------------------------------------------- verdict
printf '\n'
if [ "$FAILURES" -eq 0 ]; then
  printf '\033[32mAll checks passed.\033[0m %s is serving.\n' "$BASE"
  exit 0
fi
printf '\033[31m%s check(s) failed.\033[0m Do not claim this build works.\n' "$FAILURES"
exit 1
