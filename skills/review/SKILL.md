---
name: review
description: Read-only. Review a PR or branch for real bugs and rule violations: parallel finders in fresh context, one verifier per finding, only verified findings reported, each with a check that stops it coming back. Use before asking a human to review, or when asked to review a PR.
argument-hint: "[PR number | branch | empty = current branch]"
---

# /ccs:review

Report only what a verifier confirmed, and how to never review it again. A review people
stop reading is worse than none.

## The hard rule

**Read-only.** No edits, no commits, no push, no `gh pr comment` or review. Checks and tests
may leave their usual caches (`__pycache__`, `.pytest_cache`); any other file a run needs, such
as a repro script, goes under a `mktemp -d` outside the repo. The only other writes: this
run's report, and `.ccs/` in `.git/info/exclude`.

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

Deterministic first: what a command can catch, no finder should have to.

**Checks.** Run every command under `REVIEW.md` `## Checks`, each with `; echo "rc=$?"`
appended so the exit code is seen. A command fails on a non-zero exit; a `grep` fails on any
match. A failed check is reported as fact, no verifier. Finders get the list and don't flag
the same lines again.

No `## Checks` → infer them, and run what exists:

| Source | Commands |
|---|---|
| `package.json` scripts | `test`, `lint`, `typecheck` |
| `pyproject.toml` | `ruff check`, `pytest`, if installed |
| `Makefile` | `test`, `lint` targets |
| `Cargo.toml` / `go.mod` / `Package.swift` | `cargo test` / `go test ./...` / `swift test` |
| `.importlinter` / `[tool.importlinter]`, `.dependency-cruiser.*` | `lint-imports` / `npx depcruise src` |

Say `Checks: inferred (no REVIEW.md)`.

**Phasing out.** Each `REVIEW.md` `## Phasing out` line is `` `<regex>` [in `<path>`] — <use
instead> ``, run on added lines only:

```
git diff -U0 origin/<base>...HEAD [-- <path>] | grep -E '^\+' | grep -v '^+++ ' | grep -E '<regex>'
```

Each regex counts as one check. A hit fails it: `✗ <regex> — <file:line> — use instead: <…>`.
Old uses never fail it, new copies always do.

**Escape hatches.** Grep the added lines the same way, case-insensitive, for new
suppressions and patches:

```
noqa|type: ?ignore|pyright: ?ignore|eslint-disable|@ts-ignore|@ts-expect-error|as any|
nolint|#\[allow\(|@SuppressWarnings|swiftlint:disable|setTimeout\([^,]+, *0\)|
requestAnimationFrame|requestIdleCallback|sleep\(|workaround|hack|for now|temporar|quick fix
```

Each hit is a candidate, not a finding: it goes straight to Step 4. Suppressions already on
base are not touched.

## Step 3 — find

Launch finders **in parallel**, as subagents with fresh context: they never saw the code
being written. Each gets only: the diff, PR title and body, rule paths, the do-not-flag list.
No subagent tool → run each finder, then each verifier, one at a time, each judged only on
its own evidence, and add `finders and verifiers shared one context` to `Cannot check`.

| Finder | Looks for |
|---|---|
| rules | A violation of a rule in the collected files. Must quote the exact rule and its path. |
| bugs | From the diff alone: won't parse, compile or import; wrong for every input; a security hole provable from the changed lines. |
| one per `## Lenses` item | That item, in the changed code only. |
| evidence | Not a finding. Map each claim to its proof: claims = acceptance criteria of a spec the diff adds or the PR body links, else the PR body's claims. Proof = a test in the diff, or an artifact in the PR body (screenshot, video, `verified:` line), or `none`. |

Each finding: `file:line`, problem, trigger (the input or path that hits it), fix.

## Step 4 — verify

One subagent per finding and per escape-hatch candidate, in parallel. It reads the code
around it and returns one of:

- `confirmed (reproduced)`: the trigger was run and failed. Use `REVIEW.md` `## Run`, the
  repo's test runner, or a script; a new test or script lives under `mktemp -d`, never in the repo.
- `confirmed (read)`: proven from code, with a `file:line` citation, not an inference from a name.
- `rejected`, with evidence. Dropped.

An escape-hatch candidate is confirmed only if the verifier names the real cause it hides,
at `file:line`. Then its fix is that cause, not a better patch. The new patch is the
finding even when its cause is on base: never 🟣.

Every confirmed finding also gets `Prevent:` — the cheapest deterministic check that catches
it: a regex on added lines (as in Phasing out), an existing lint rule to enable, an import
contract, or, for a logic bug, the reproducing assertion as `test: <assertion>`, ready for
`/ccs:implement`'s red step. The verifier runs it against this diff and keeps it only if it
catches the hit. Nothing deterministic fits → `Prevent: none`. Never a rule in prose.

## Step 5 — rank

Dedupe, then, `reproduced` before `read` inside each:

- 🔴 Important: fix before merge
- 🟡 Nit: worth fixing, not blocking. At most 5.
- 🟣 Pre-existing: real, not introduced here; only when the diff touches that code

A new copy of an anti-pattern that already exists elsewhere is introduced here: never 🟣.

## Do not flag

Every finder and verifier gets this list:

- a pre-existing issue as 🔴
- style or taste
- anything a linter, type checker or CI catches
- "might fail" without a concrete input that makes it fail
- nits a senior engineer would skip
- test coverage, unless a rule demands it (the evidence line reports gaps, it doesn't flag them)
- a suppression or workaround already on base
- anything under `REVIEW.md` `## Do not report`

Not certain it is real → don't flag it.

## `REVIEW.md`

Optional, at the reviewed repo's root. All sections optional.

```markdown
# Review rules

Base: develop

## Checks
- `uv run ruff check src tests scripts`

## Phasing out
- `useEffect\(` in `src/ui/` — use the store's `subscribe()`
- `from src\.jobs` in `src/engine/` — engine must not import jobs

## Run
- `uv run pytest -x -q <test path>`
- `uv run python -m app.cli <args>`

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

Checks: <n> run, <failed> failed   (or: Checks: inferred (no REVIEW.md), <n> run, <failed> failed)
  ✗ <command> — <one line>
Evidence: <n> claims · <t> tested · <a> artifact · none: <claim>; <claim>

🔴 file.py:42 — <problem>   [reproduced | read]
   Rule: "<quoted rule>" (<path>)   ← rules finder only
   Trigger: <input or path that hits it>
   Fix: <one line, the cause>
   Prevent: <command | lint rule | test: <assertion> | none>
🟡 …
🟣 …

Dropped by verifier: <n> (<e> escape-hatch candidates)
Cannot check: <REVIEW.md ## Cannot check, verbatim, plus what this run could not see>

Suggested REVIEW.md additions:
  ## Checks       <inferred checks, if no REVIEW.md; every Prevent: command or lint rule>
  ## Phasing out  <every Prevent: regex; use instead = its Fix>
  Promote: "<rule>" (<path>) → <the line above that now enforces it>
```

`test:` lines stay on their finding: they go to `/ccs:implement`, not `REVIEW.md`.

No findings → `No issues found. Checked: <finders run>.`
`fix first` when any check failed or any 🔴 exists.
No claims to map → `Evidence: none stated`. A UI change with no screenshot or video →
also add it to `Cannot check`.
Print the suggestions; never write `REVIEW.md`. Omit the block when it would be empty.

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
