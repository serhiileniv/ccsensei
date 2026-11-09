---
name: learn
description: Turn this session's lessons into edits to the ccs skills themselves, then commit on approval.
argument-hint: "[what to learn | empty = review this session]"
disable-model-invocation: true
---

# /ccs:learn

The skills get better with use. This turns what a session taught into edits to them.
If `$ARGUMENTS` is given, that is the lesson.

## Step 1 — find lessons

A lesson is one of:

- a user correction a ccs skill should have prevented
- a step that was skipped or misread because its wording allowed it
- a rule that proved wrong
- a friction shared by reports from **≥2 repos or ≥2 dates** with `learned: false`, or one
  report plus a user correction. One-off friction is not a lesson.

Reports live in every repo. Read them all:

```
find "${CCS_SCAN_ROOT:-$HOME/Projects}" -maxdepth 6 -path '*/.ccs/reports/*' -name '*.md'
```

Project facts and one-off preferences are not lessons — the harness memory holds those.
Never write memory files, and never edit `~/.claude/CLAUDE.md`.

## Step 2 — map each to one skill

Each lesson goes to one skill in `skills/`. No skill fits → report it, don't edit, don't
scaffold a new one.

## Step 3 — locate the source

`$CCS_REPO`, else `~/Projects/ccsensei`. It must be a git checkout whose `origin` is
`serhiileniv/ccsensei`. Otherwise print the proposed diff and stop.

Never edit `~/.claude/plugins/cache` — it is overwritten on update.

## Step 4 — edit

- Tree dirty → stop and say so.
- `git fetch`, then branch `learn/<slug>` off `origin/main`: local `main` can be stale.
- Smallest change to that skill's `SKILL.md` or supporting file. Tighten an existing line
  before adding one.

## Step 5 — drift

Every skill carries the same `## Writing` and `## Report` blocks. If any differs from
the one in `skills/spec/SKILL.md`, make it match in the same diff.

## Step 6 — gate

Show the diff, then one line per lesson: *what happened → what changed*. Stop.

On approval, commit on the branch, then set `learned: <short sha>` on the reports that fed
it, in whichever repo each lives (`.ccs/` is excluded, so no diff there). Never delete reports. Never push or open a PR.

Nothing qualified → say so and change nothing. An empty run beats filler.

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

Outcome: success = edit committed · partial = edit shown, not approved · failed = nothing qualified.

## Report

Last step, every run, whatever the outcome: write `.ccs/reports/<skill>/<YYYY-MM-DD>-<slug>.md`
at the repo root, and add `.ccs/` to `.git/info/exclude` if missing. One line per field,
no secrets, tokens or customer data. Print the path.

```
---
skill: <skill>
date: <YYYY-MM-DD>
repo: <owner/name>
target: <argument, one line>
outcome: success | partial | failed
learned: false
---

Used: <tools, CLIs, MCPs, files that did the work>
Found: <the result, one or two lines>
Friction: <what slowed or blocked it; a user correction; "none">
```
