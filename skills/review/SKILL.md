---
name: review
description: Read-only. Review a PR or branch for real bugs and rule violations: parallel finders in fresh context, one verifier per finding, only verified findings reported. Use before asking a human to review, or when asked to review a PR.
argument-hint: "[PR number | branch | empty = current branch]"
---

# /ccs:review

Report only what a verifier confirmed. A review people stop reading is worse than none.

## The hard rule

**Read-only.** No edits, no commits, no push, no `gh pr comment` or review. Checks and
tests that don't write are fine. The one write is this run's report.

Never approve or block: a human does. Fixes go to `/ccs:implement`.

## Step 0 — scope

- PR number → `gh pr view <n>` (title, body, base, draft) and `gh pr diff <n>`.
- Branch or empty → `git fetch`, then diff `origin/<base>...HEAD`.
- Base = the `Base:` line in `REVIEW.md`, else the repo default branch.
- Empty diff → say so, stop. Draft → note it, continue.

## Step 1 — rules

Collect paths, not contents:

- root `CLAUDE.md` / `AGENTS.md`, plus any in a directory holding a changed file
- `REVIEW.md`, read with `git show origin/<base>:REVIEW.md`: a PR can't relax its own review.
  Missing on base, present in the tree → use the tree copy and say so.

## Step 2 — checks

Run every command under `REVIEW.md` `## Checks`, each with `; echo "rc=$?"` appended so the
exit code is seen. Non-zero exit or non-empty output = a failed check, reported as fact, no verifier. Finders get the list and skip those subjects.

## Step 3 — find

Launch finders **in parallel**, as subagents with fresh context: they never saw the code
being written. Each gets only: the diff, PR title and body, rule paths, the do-not-flag list.

| Finder | Looks for |
|---|---|
| rules | A violation of a rule in the collected files. Must quote the exact rule and its path. |
| bugs | From the diff alone: won't parse, compile or import; wrong for every input; a security hole provable from the changed lines. |
| one per `## Lenses` item | That item, in the changed code only. |

Each finding: `file:line`, problem, trigger (the input or path that hits it), fix.

## Step 4 — verify

One subagent per finding, in parallel. It reads the code around the finding and returns
`confirmed` or `rejected` with evidence. A claim about behaviour needs a `file:line`
citation, not an inference from a name. Rejected → dropped.

## Step 5 — rank

Dedupe, then:

- 🔴 Important: fix before merge
- 🟡 Nit: worth fixing, not blocking. At most 5.
- 🟣 Pre-existing: real, not introduced here; only when the diff touches that code

## Do not flag

Every finder and verifier gets this list:

- a pre-existing issue as 🔴
- style or taste
- anything a linter, type checker or CI catches
- "might fail" without a concrete input that makes it fail
- nits a senior engineer would skip
- test coverage, unless a rule demands it
- code silenced on purpose (`noqa`, lint-ignore)
- anything under `REVIEW.md` `## Do not report`

Not certain it is real → don't flag it.

## `REVIEW.md`

Optional, at the reviewed repo's root. All sections optional.

```markdown
# Review rules

Base: develop

## Checks
- `uv run ruff check src tests scripts`

## Lenses
- Docs chain: a change under `src/engine/` has its card and History line

## Do not report
- Generated files, lockfiles

## Cannot check
- Whether geometry is clinically right
```

## Output

```
Review: <PR #n | branch> vs <base> · <files> files, +<a>/-<d>

Verdict: fix first | ready for human review

Checks: <n> run, <failed> failed
  ✗ <command> — <one line>

🔴 file.py:42 — <problem>
   Trigger: <input or path that hits it>
   Fix: <one line>
🟡 …
🟣 …

Dropped by verifier: <n>
Cannot check: <REVIEW.md ## Cannot check, verbatim, plus what this run could not see>
```

No findings → `No issues found. Checked: <finders run>.`
`fix first` when any check failed or any 🔴 exists.

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
