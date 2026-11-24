# Spec: `/ccs:review` turns findings into guardrails; `learn` and `explain` removed

## Goal

A review should not only say "fix this", but "and here is the check that stops it coming
back". Every correction becomes a deterministic check, not another line of prose, until there
is little left for a human to review. Source: Lauren "Potato" talk *Turning slop into gold*
(trust pyramid: code and checks first, verification second, prose last).

## Non-goals

- **Writing `REVIEW.md`.** `review` stays read-only; it prints suggestions.
- **Auto-merge, approve or block.** A human still decides.
- **Formal verification or property tests as a skill step.** A repo that has them lists them in `## Checks`.
- **Flagging test coverage.** The evidence line shows gaps; it doesn't flag them.

## Current state

Base: `origin/main` at `e51fced`, plugin `0.7.0`.

| | Today |
|---|---|
| Fixes | `Fix:` only. A suggested `REVIEW.md` is printed only when none exists. |
| Suppressions | `Do not flag`: "code silenced on purpose (`noqa`, lint-ignore)" — including new ones. |
| Copied anti-patterns | 🟣 "not introduced here" lets a new copy of an old pattern pass as pre-existing. |
| Evidence | The diff is reviewed; whether claims have tests or artifacts is not reported. |
| Verifier | Reads code only. |
| `learn`, `explain` | Present. |

## Proposed design

| # | Change | Where |
|---|---|---|
| 1 | Verifier returns `Prevent:` per confirmed finding: a regex on added lines, a lint rule, an import contract. It runs it and keeps it only if it prints the hit. Prose rule now caught by a command → `Promote:` line. All printed under "Suggested REVIEW.md additions". | Step 4, Output |
| 2 | Escape-hatch scan: grep added lines for new suppressions and patches (`noqa`, `ts-ignore`, `as any`, `setTimeout(…, 0)`, `sleep(`, "workaround", …). Each hit → verifier; confirmed only if it names the cause it hides at `file:line`, and the fix is that cause. Old suppressions untouched. | Step 2, Step 4, Do not flag |
| 3 | `REVIEW.md` `## Phasing out`: `` `<regex>` [in `<path>`] — <use instead> ``, run on added lines only (ratchet). A new copy of an existing anti-pattern is never 🟣. | Step 2, Step 5 |
| 4 | `evidence` finder: each claim (spec acceptance criteria, else PR body) → test in diff, artifact in PR body, or `none`. One `Evidence:` line. UI change without an artifact → `Cannot check`. | Step 3, Output |
| 5 | Verifier may reproduce: `REVIEW.md` `## Run`, the test runner, or a script under `mktemp -d`. `confirmed (reproduced)` ranks above `confirmed (read)`. | Hard rule, Step 4, Step 5 |
| 6 | Inferred checks add `lint-imports` / `depcruise` when configured. | Step 2 |
| 7 | Remove `skills/learn`, `skills/explain`; README, `implement`, hackathon guide, plugin descriptions; `plugin.json` `0.8.0`. Reports stay. | — |

## Acceptance criteria

- [x] On a toy repo with planted cases, one run reports: the `## Phasing out` hit in the new file only (not the old one); the `sleep` workaround confirmed with its real cause; a benign `noqa` dropped; the `print()` rule violation with a `Promote:` line; the logic bug `reproduced`; `Evidence:` showing untested criteria
- [x] Every confirmed finding has a `Prevent:` line, either a command that prints the hit or `none`
- [x] No write in the repo besides the report
- [x] `skills/learn` and `skills/explain` are gone; `grep -rn "ccs:learn\|ccs:explain" README.md skills .claude-plugin docs/guides` is empty

Checked 24.11.2026 on a toy repo (6 planted cases, all reported as expected) by a fresh agent following only `SKILL.md`. Its friction list became the wording fixes in this branch: grep vs exit-code failures, caches, no-subagent fallback, `test:` prevents for logic bugs, where each suggestion goes.

Verification and `Prevent:` lower false positives and repeats; they can't find bugs outside the diff's reach, and a regex guardrail can miss a rephrased copy.
