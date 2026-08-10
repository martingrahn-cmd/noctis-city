#!/usr/bin/env bash
#
# quiet-gates.sh — `npm run gates` under the CONTRACT §0 bar, unattended.
#
# WHY THIS EXISTS. Every absolute number in this project is measured on the
# machine the observer is sitting at, and the observer IS the load: sessions 9
# and 10 measured the Claude app at 22–36% CPU with load1 between 2.0 and 2.9,
# and `perfcheck`'s own ceilings sit 1.09× above what the hardware delivers
# quiet. Under that load `downtown_dense` returned 11.7 / 13.7 / 14.0 ms at wall
# p95 in one run — a 2.3-point spread against a 0.4–0.8 ms quiet resolution and a
# 12.5 ms ceiling, which is not a verdict about the content in either direction.
#
# So: close the app, run this, read the log. It refuses to start if the bar is
# not met rather than producing a number that has to be discounted afterwards.
#
#   chmod +x tools/quiet-gates.sh && tools/quiet-gates.sh
#   tools/quiet-gates.sh --measure-floor 10     # re-derive IDLE_FLOOR, app closed
#
# Writes tools/perf-out/quiet-gates-<timestamp>.log and exits with the gates'
# own exit code.
#
# SESSION 11 CORRECTION. This script refused 77 times running and passed zero,
# for three reasons that were all instrument and none of them machine. They are
# fixed below and each one carries its arithmetic, because a gate that can never
# pass produces zero measurements, and zero measurements is not stricter than
# imperfect ones — it is nothing. That is CONTRACT §9's failure mode with the
# sign flipped, and it is the eighth instance of it here.

set -u

# --- FIX 1: the locale, set here and not required of the caller ---------------
#
# The operator's shell is a Swedish locale, where `uptime` prints `load
# averages: 1,32` and `ps -o %cpu` prints `6,9`. Both numeric checks below broke
# on it, in opposite directions, and both looked like the machine's fault:
#
#   load1  `tr -d ','` turned 1,32 into 132, and 132 > 1.2 refuses forever.
#          Nine of the 77 refusal logs carry a comma-stripped load: 185, 188,
#          193, 200, 228, 294, 338, 340, 363 — i.e. 1.85 … 3.63.
#   %cpu   awk cannot read "6,9" as a number, so `$1 > 15` falls back to a
#          STRING comparison, where "6,9" > "15" is true on the first character.
#          Measured on this machine at the same instant: 27 processes flagged
#          as over 15% CPU under sv_SE.UTF-8 against 9 genuinely over it, the
#          false ones running at 2,0 and 3,0 percent. WindowServer at 6,9% trips
#          it every time. That check was unmeetable too, and silently.
#
# Set it, do not require the caller to know. The session-9 quiet battery was
# invoked as `LC_ALL=C zsh …/quiet-battery.sh` from the command line, which is
# exactly the knowledge this line removes the need for.
export LC_ALL=C

cd "$(dirname "$0")/.." || exit 2

# --- the two thresholds, both derived, and the derivation is CONTRACT §0.2 ----
#
# BAR   1.6 — the load1 at or under which this project has an ATTESTED quiet
#       reading. Derived, not chosen: the session-9 quiet battery
#       (2026-08-08 08:08–08:21) was admitted by its own bar of load1 < 2.0 with
#       top < 12% over two consecutive 30 s samples, and the two samples that
#       admitted it measured load1 = 1.46 and load1 = 1.56. The maximum
#       attested-quiet load1 is therefore 1.56, and 1.56 rounded up to the next
#       0.1 is 1.6. A bar below 1.56 refuses the very run it is derived from —
#       which is what 1.2 did, without support, for a day.
#
# FLOOR 1.32 — this machine's structural minimum, measured with the app closed
#       and nothing running: tools/perf-out/quiet-gates-20260809-084928.log,
#       load1 1.32, no process over 15% CPU. WindowServer draws the screen and
#       does not go away, so nothing below this is reachable on this hardware.
#
#       BAR − FLOOR = 1.6 − 1.32 = 0.28 of load1 headroom above the floor.
#
# Both are overridable for a machine that is not this one, and the override is
# floor-checked below rather than trusted.
BAR=${QUIET_BAR:-1.6}
FLOOR=${QUIET_FLOOR:-1.32}
CPU_BAR=${QUIET_CPU_BAR:-15}

numeric() { printf '%s' "$1" | grep -qE '^[0-9]+(\.[0-9]+)?$'; }

read_load1() { uptime | sed 's/.*load averages*: *//' | awk '{print $1}'; }

# --- --measure-floor: how the floor is re-derived rather than inherited -------
#
# Run with the app closed and nothing else running. Samples load1 every 10 s and
# reports the minimum, which is the number FLOOR should carry on this machine.
if [ "${1:-}" = "--measure-floor" ]; then
  MINUTES=${2:-10}
  if ! numeric "$MINUTES"; then echo "usage: $0 --measure-floor [minutes]"; exit 2; fi
  SAMPLES=$(awk "BEGIN { printf \"%d\", ${MINUTES} * 6 }")
  STAMP=$(date +%Y%m%d-%H%M%S)
  FLOORLOG="tools/perf-out/idle-floor-${STAMP}.log"
  mkdir -p tools/perf-out
  echo "idle-floor ${STAMP} — ${MINUTES} min, ${SAMPLES} samples at 10 s" | tee "$FLOORLOG"
  echo "close the app and leave the machine alone; this measures what it cannot go below" | tee -a "$FLOORLOG"
  i=0
  while [ "$i" -lt "$SAMPLES" ]; do
    L=$(read_load1)
    printf '%s load1 %s\n' "$(date +%H:%M:%S)" "$L" | tee -a "$FLOORLOG"
    i=$((i + 1))
    [ "$i" -lt "$SAMPLES" ] && sleep 10
  done
  awk '/load1/ {print $3}' "$FLOORLOG" | sort -n > /tmp/quiet-floor-$$
  MIN=$(head -1 /tmp/quiet-floor-$$); MAX=$(tail -1 /tmp/quiet-floor-$$)
  MED=$(awk '{a[NR]=$1} END {print (NR%2) ? a[(NR+1)/2] : (a[NR/2]+a[NR/2+1])/2}' /tmp/quiet-floor-$$)
  rm -f /tmp/quiet-floor-$$
  echo "" | tee -a "$FLOORLOG"
  echo "min ${MIN}  median ${MED}  max ${MAX} — the MINIMUM is the floor" | tee -a "$FLOORLOG"
  echo "set FLOOR=${MIN} in this script and cite ${FLOORLOG}; a bar under it is unmeetable" | tee -a "$FLOORLOG"
  echo "log: ${FLOORLOG}"
  exit 0
fi

STAMP=$(date +%Y%m%d-%H%M%S)
LOG="tools/perf-out/quiet-gates-${STAMP}.log"
mkdir -p tools/perf-out

echo "quiet-gates ${STAMP}" | tee "$LOG"
echo "  bar load1 ≤ ${BAR}   idle floor ${FLOOR}   cpu bar ${CPU_BAR}%   (CONTRACT §0.2)" | tee -a "$LOG"

# --- FIX 3: the bar is floor-checked before the machine is even read ----------
#
# A threshold under this machine's structural minimum is unmeetable by
# construction, and the right place to discover that is one line into the run,
# not over a night of waiting for a load average to go somewhere it cannot go.
if ! numeric "$BAR" || ! numeric "$FLOOR"; then
  echo "  ✗ bar '${BAR}' or floor '${FLOOR}' is not a number — refusing" | tee -a "$LOG"
  exit 2
fi
if awk "BEGIN { exit !(${BAR} < ${FLOOR}) }"; then
  echo "  ✗ bar load1 ${BAR} is BELOW this machine's measured idle floor ${FLOOR} — unmeetable by construction, nothing to wait for" | tee -a "$LOG"
  echo "" | tee -a "$LOG"
  echo "The floor is what the machine costs to exist: WindowServer draws the screen" | tee -a "$LOG"
  echo "and does not go away. Re-derive it with '$0 --measure-floor 10' (app closed)" | tee -a "$LOG"
  echo "if you believe this hardware is quieter than ${FLOOR}, and cite the log." | tee -a "$LOG"
  exit 2
fi

# --- the bar, checked rather than assumed ------------------------------------
#
# Three conditions and all three are §0's. LOAD is the machine; ORPHANS is this
# project's own leavings — a vite or a chromium from a killed probe run keeps a
# GPU context alive and is invisible in a load average that has already settled;
# BIGCPU is anything else awake, the Claude app included.

LOAD=$(read_load1)
ORPHANS=$(pgrep -fl 'vite|playwright|Chromium.*--use-angle' 2>/dev/null | grep -v quiet-gates | wc -l | tr -d ' ')
BIGCPU=$(ps -A -o %cpu,comm | awk -v b="$CPU_BAR" 'NR>1 && ($1+0) > b {print $1" "$2}' || true)

echo "  load1 ${LOAD}   orphan vite/chromium/playwright processes ${ORPHANS}" | tee -a "$LOG"
if [ -n "$BIGCPU" ]; then
  echo "  processes over ${CPU_BAR}% CPU:" | tee -a "$LOG"
  echo "$BIGCPU" | sed 's/^/    /' | tee -a "$LOG"
fi

BAD=0

# --- FIX 4: an unreadable load refuses, it does not pass ----------------------
#
# `awk "BEGIN { exit !(${LOAD} > ${BAR}) }"` with an empty LOAD is a syntax
# error, awk exits 2, and `&&` reads that as "not over the bar" — so a parse
# failure declared the bar MET and ran the gates. Fail-open on the honesty check
# is worse than the refusal loop it hid behind: it produces a number that looks
# attested and is not.
if ! numeric "$LOAD"; then
  echo "  ✗ load1 '${LOAD}' did not parse — refusing rather than assuming it is low" | tee -a "$LOG"
  echo "    (uptime output: $(uptime))" | tee -a "$LOG"
  BAD=1
else
  awk "BEGIN { exit !(${LOAD} > ${BAR}) }" && { echo "  ✗ load1 ${LOAD} > ${BAR}" | tee -a "$LOG"; BAD=1; }
  # A reading under the recorded floor is evidence about the floor, not the run.
  awk "BEGIN { exit !(${LOAD} < ${FLOOR}) }" && \
    echo "  · load1 ${LOAD} is under the recorded floor ${FLOOR} — the floor is stale, re-derive it with --measure-floor" | tee -a "$LOG"
fi

[ "$ORPHANS" -gt 0 ] && { echo "  ✗ ${ORPHANS} orphan render process(es) — kill them first" | tee -a "$LOG"; BAD=1; }
[ -n "$BIGCPU" ] && { echo "  ✗ something is using the CPU — close it, the Claude app included" | tee -a "$LOG"; BAD=1; }

if [ "$BAD" = 1 ]; then
  echo "" | tee -a "$LOG"
  echo "The §0 bar is not met. A number measured now is a bound, not a measurement," | tee -a "$LOG"
  echo "and this refuses rather than producing one that has to be discounted later." | tee -a "$LOG"
  exit 2
fi

echo "  ✓ bar met — load1 ${LOAD} ≤ ${BAR}, ${FLOOR} floor, nothing over ${CPU_BAR}%" | tee -a "$LOG"
echo "" | tee -a "$LOG"

npm run gates 2>&1 | tee -a "$LOG"
CODE=${PIPESTATUS[0]}

echo "" | tee -a "$LOG"
echo "gates exit ${CODE}" | tee -a "$LOG"
LOAD_AFTER=$(read_load1)
echo "  load1 after ${LOAD_AFTER} (was ${LOAD}) — a large rise means the run drifted under itself" | tee -a "$LOG"
echo "log: ${LOG}"
exit "$CODE"
