---
name: review
description: Read-only. Review a PR or branch for bugs, regressions and rule violations, recall-first: maps every changed symbol and its callers, runs tests on head and base, parallel finders per lens with a per-hunk coverage check, one verifier per finding that tries to reproduce it. Use before asking a human to review, or when asked to review a PR.
argument-hint: "[PR number | branch | empty = current branch]"
---

# /ccs:review

Miss nothing. Finders maximise recall, verifiers own precision, the human sees what neither
could settle. A false positive costs a verifier run; a missed regression costs an incident.

## The hard rule

**Read-only.** No edits to the user's tree, no commits, no push, no `gh pr comment` or review.
Tests, checks and repro scripts run only in scratch worktrees. The one write in the repo is
this run's report.

Never approve or block: a human does. Fixes go to `/ccs:implement`.

## Step 0 — scope

- PR number → `gh pr view <n> --json title,body,baseRefName,headRefOid,isDraft,closingIssuesReferences,comments,reviews`,
  `gh pr diff <n>`, and `gh issue view` for each linked issue.
- Branch or empty → `git fetch`, then diff `origin/<base>...HEAD`.
- Base = the `Base:` line in `REVIEW.md`, else the repo default branch.
- Check out head and the merge base as scratch worktrees in the scratchpad:
  `git worktree add --detach <scratch>/head <head-sha>` and `<scratch>/base <merge-base>`.
  Never check out in the user's tree. Remove both at the end, whatever the outcome.
- Empty diff → say so, stop. Draft → note it, continue.

## Step 1 — rules

Collect paths, not contents:

- root `CLAUDE.md` / `AGENTS.md`, plus any in a directory holding a changed file
- `REVIEW.md`, read with `git show origin/<base>:REVIEW.md`: a PR can't relax its own review.
  Missing on base, present in the tree → use the tree copy and say so.

## Step 2 — map

One subagent builds the change map from the diff and the head worktree:

- every hunk, numbered `H1…Hn`, with `file:lines`
- every changed **symbol**: function, method, type, field, config key, CLI flag, route,
  DB column, env var, exported constant, file format
- per symbol, its contract change: signature, return, default, raises, side effect, ordering, removed
- per symbol, every caller or user in head **outside the diff** (`grep`, LSP if available), as `file:line`

Why: regressions live in code the diff doesn't show.

## Step 3 — checks and tests

- Run every command under `REVIEW.md` `## Checks` in head, each with `; echo "rc=$?"` appended.
  Non-zero exit or non-empty output = a failed check, reported as fact, no verifier.
- Run `## Tests` in head. None listed → detect from `package.json`, `pyproject.toml`,
  `Cargo.toml`, `go.mod`, `Makefile`; none found or env won't install → `Tests: not run: <why>`.
- Any test failing in head → run it in base. Head fail + base pass = 🔴 regression, as fact.
  Fails in both = 🟣.

Finders get the failed checks and skip those subjects.

## Step 4 — find

Launch finders **in parallel**, as subagents with fresh context: they never saw the code
being written. Each gets: the diff, the change map, PR title, body and linked issues, rule
paths, the do-not-flag list, its hunk group. Each **may read anything in the head worktree**.

| Finder | Looks for |
|---|---|
| regression | Every caller and user in the map still works under the new contract. Removed or narrowed behaviour still needed somewhere. Changed defaults, ordering, error types, serialization, migrations, config, env, public API. |
| logic | Wrong result for some input: boundaries, off-by-one, null / empty / zero, inverted condition, wrong variable, units, precedence, early return skipping work. |
| errors-state | Swallowed or wrong exceptions, missing cleanup, leaks, partial writes, non-idempotent retries, races, un-awaited async, shared mutable state, stale cache. |
| intent | Code doesn't do what the PR body, linked issue or spec says; a stated case not handled; unrelated behaviour changed. |
| tests | Tests changed to pass, not to check: deleted or weakened assertions, new skips, snapshots regenerated over a behaviour change, mocks hiding the changed path. Missing test only for the PR's main claim. |
| security | A hole provable from the changed code: injection, authz bypass, leaked secret, unsafe deserialization, path traversal. |
| rules | A violation of a rule in the collected files. Must quote the exact rule and its path. |
| one per `## Lenses` item | That item, in the changed code. |

Diff over 400 changed lines → split hunks into groups of ≤ 400 lines; each finder runs once
per group. Hunks under a `## Hot spots` path are never grouped: one run per hunk.

Flag anything with a concrete trigger. Don't self-filter on certainty: the verifier decides.

Each finding: `file:line`, problem, trigger (the input or path that hits it), fix.

## Step 5 — coverage

Each finder also returns, for every hunk in its group, either finding ids or
`clean: <one-line reason>`. `regression` also marks every mapped caller `checked`.

A hunk with no entry from a finder, or an unchecked caller → re-run that finder on just those,
once. Still missing → list it under `Not covered` in the output.

## Step 6 — verify

One subagent per finding, in parallel, never shared. It tries to **reproduce** in the head
worktree: a failing test or script (written under the scratchpad, not the repo), else a
`file:line` trace from input to failure. A claim about behaviour needs a `file:line`
citation, not an inference from a name. Returns one of:

- `confirmed` — repro or trace
- `rejected` — `file:line` evidence it can't happen
- `unsure` — what it couldn't settle

## Step 7 — rank

Dedupe, then:

- 🔴 Important: confirmed, fix before merge
- 🟠 Human check: verifier `unsure`. Never dropped.
- 🟡 Nit: worth fixing, not blocking. At most 5.
- 🟣 Pre-existing: real, not introduced here; only when the diff touches that code

## Cost guard

Agents = 1 map + finders × groups + re-runs + verifiers. Estimate after Step 2; over 40 →
print the estimate and ask before Step 4.

## Do not flag

Every finder and verifier gets this list:

- a pre-existing issue as 🔴
- style or taste
- anything a linter, type checker or CI catches
- "might fail" without a concrete input: the verifier must name one or return `rejected` / `unsure`
- nits a senior engineer would skip
- test coverage, beyond the `tests` finder
- code silenced on purpose (`noqa`, lint-ignore)
- anything under `REVIEW.md` `## Do not report`

## `REVIEW.md`

Optional, at the reviewed repo's root. All sections optional.

```markdown
# Review rules

Base: develop

## Checks
- `uv run ruff check src tests scripts`

## Tests
- `uv run pytest -q -m "not integration"`

## Lenses
- Docs chain: a change under `src/engine/` has its card and History line

## Hot spots
- `src/engine/` — every hunk reviewed alone

## Do not report
- Generated files, lockfiles

## Cannot check
- Whether geometry is clinically right
```

## Output

```
Review: <PR #n | branch> vs <base> · <files> files, +<a>/-<d>

Verdict: fix first | needs human check on 🟠 | ready for human review

Checks: <n> run, <failed> failed
  ✗ <command> — <one line>
Tests: <command> — head <pass | n failed>, base <pass | n failed> | not run: <why>
Coverage: <h> hunks × <f> finders, <c> callers checked · re-runs: <n>

🔴 file.py:42 — <problem>
   Trigger: <input or path that hits it>
   Repro: <test or script path | file:line trace>
   Fix: <one line>
🟠 file.py:88 — <problem>
   Why unsure: <what the verifier couldn't settle>
🟡 …
🟣 …

Rejected: <n>
  file.py:10 — <claim> — <reason, file:line>
Not covered: <hunks or callers no finder reported on | none>
Cannot check: <REVIEW.md ## Cannot check, verbatim, plus what this run could not see>
```

No findings → `No issues found. Checked: <finders run>, <h> hunks, <c> callers.`
`fix first` when any check or test failed or any 🔴 exists; else `needs human check on 🟠` when any 🟠 exists.

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

Outcome: success = review completed · partial = a step could not run (say which) · failed = no diff reviewed.

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
