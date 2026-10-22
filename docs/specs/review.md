# Spec: `/ccs:review`: high-signal code and PR review

## Goal

Review a branch or PR the way Anthropic's own reviewers do: parallel narrow finders in fresh
context, one verifier per finding, only verified findings reported. Generic skill; each repo
adds its own review rules in a `REVIEW.md`. Read-only; output in the terminal.

## Non-goals

- **Posting to GitHub.** The user posts by hand; the skill never writes to a PR.
- **Approving or blocking.** A human approves. The skill gives a verdict line only.
- **Fixing.** Findings hand off to `/ccs:implement`.
- **Style, lint, coverage.** CI and linters own them; duplicating them is noise.
- **Security audit.** `/security-review` exists; this skill only flags security bugs it can prove in the diff.

## Current state

| | |
|---|---|
| `skills/` | `spec`, `implement`, `root-cause`, `explain`, `learn`. No review skill. |
| `README.md` | Skill table + flow diagram (`spec ──► implement ◄── root-cause`). |
| `.claude-plugin/plugin.json` | `0.3.0`, installed (cache `~/.claude/plugins/cache/ccs/ccs/0.3.0`). |
| `docs/specs/skill-reports.md` | Shared report format every skill ends with. |
| `~/Dental/dental-lab-worker` | First consumer. No `REVIEW.md`, no `.claude/`. CI: ruff, `scripts/check_docs.py`, pytest, docker `--check`. PR template has a 10-item documentation checklist. |

Sources the design copies (fetched 21.10.2026):
`anthropics/claude-code` `plugins/code-review/commands/code-review.md`, `plugins/pr-review-toolkit/`;
`code.claude.com/docs/en/code-review`, `code-review-customize`, `best-practices`;
`anthropics/claude-code-security-review`.

## Proposed design

### Skill

`skills/review/SKILL.md`, model-invocable.

```yaml
name: review
description: Read-only. Review a PR or branch for real bugs and rule violations: parallel finders in fresh context, one verifier per finding, only verified findings reported. Use before asking a human to review, or when asked to review a PR.
argument-hint: "[PR number | branch | empty = current branch]"
```

Hard rule: read-only. Tests and checks that don't write are fine. The one write is the report.

### Steps

| # | Step | Rule |
|---|---|---|
| 0 | Scope | PR number → `gh pr view` + `gh pr diff`. Branch / empty → `git fetch`, diff `origin/<base>...HEAD`. Base = `REVIEW.md` `Base:` line, else repo default branch. Empty diff → say so, stop. Draft PR → note it, continue. |
| 1 | Rules | Collect paths: root `CLAUDE.md`/`AGENTS.md` + any in a directory holding a changed file, and `REVIEW.md`. `REVIEW.md` is read from `origin/<base>`, not the branch (a PR can't relax its own review). Missing on base but present in the tree → use it, warn. |
| 2 | Checks | Run every command under `REVIEW.md` `## Checks`, each with `; echo "rc=$?"` appended. Non-zero exit or non-empty grep = a finding, reported as fact, no verifier. Their subject is then off-limits to finders. |
| 3 | Find | Parallel subagents, fresh context, given only the diff, PR title/body and rule paths. Fixed lenses: **rules** (must quote the exact rule broken), **bugs** (diff only; won't parse/compile, or wrong for all inputs). Plus one finder per `REVIEW.md` `## Lenses` item. Each returns `file:line`, problem, trigger, fix. |
| 4 | Verify | One subagent per finding, reads surrounding code, returns `confirmed` / `rejected` + evidence. Rejected → dropped. Claims about behaviour need a `file:line` citation, not an inference from a name. |
| 5 | Rank | Dedupe. 🔴 Important = fix before merge. 🟡 Nit = worth fixing, cap 5. 🟣 Pre-existing = real, not introduced here (shown only when the diff touches it). |
| 6 | Output | Block below. Then the shared report. |

### Do not flag (every finder and verifier gets this list)

Pre-existing issues as 🔴 · style or taste · anything a linter, type checker or CI catches ·
input-dependent "might fail" without a concrete input · nits a senior engineer would skip ·
test coverage unless a rule demands it · code silenced on purpose (lint-ignore, noqa) ·
anything in `REVIEW.md` `## Do not report`.
"Not certain it is real → don't flag it."

Why: Anthropic's reviewers keep findings marked wrong under 1% by flagging only what a verifier confirms; a review people stop reading is worse than none.

### `REVIEW.md` format (in the reviewed repo)

```markdown
# Review rules

Base: develop

## Checks
- `uv run ruff check src tests scripts`
- `git diff origin/develop...HEAD | grep -nP '[\x{0400}-\x{04FF}]'`   # Cyrillic

## Lenses
- Docs chain: a change under `src/engine/` has its card, History line, traceability row

## Do not report
- Generated files, `uv.lock`

## Cannot check
- Whether geometry is clinically right
```

All four sections optional. `## Cannot check` is printed verbatim in the output.

### Output

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
Cannot check: <from REVIEW.md, plus anything the run could not see>
```

No findings → `No issues found. Checked: <lenses>.`
Verdict is `fix first` if any check failed or any 🔴 exists.

Ends with the shared `## Writing` and `## Report` blocks.
Outcome: success = review completed · partial = a step could not run (say which) · failed = no diff reviewed.

### First consumer: `dental-lab-worker/REVIEW.md`

Separate PR in that repo (`feature/review-md` from `develop`, Sasha's git rules). Contents:

- `Base: develop`
- Checks: ruff, `scripts/check_docs.py`, `pytest -m "not integration"`; greps on the diff for Cyrillic, `*.stl` / `regress-out/`, `src/engine` importing `src.jobs`, SQL outside `postgres.py`; `uv.lock` changed without `docs/registers/soup.md`; commits or PR body with Claude attribution
- Lenses: docs chain (card + History, traceability, tests register, impact paragraph and `CONFIG_VERSION` when a default/algorithm changes, records only from a real `report.json`, clinical values left `[TBD – Clinical]`); geometry bugs (units, tolerances, mesh validity, failure codes assigned not parsed); ownership (edits to `src/jobs/*`, `src/regression/*`)
- Cannot check: clinical correctness, whether a regression run is needed, provable vs hypothesis anomalies, transitive licences

### Wiring

| File | Change |
|---|---|
| `skills/review/SKILL.md` | New |
| `README.md` | Row `/ccs:review [PR | branch]`; diagram: `implement ──► review` |
| `skills/implement/SKILL.md` | Last step suggests `/ccs:review` before opening a PR |
| `.claude-plugin/plugin.json` | `0.3.0` → `0.4.0` |

## Acceptance criteria

- [ ] `skills/review/SKILL.md` exists with the frontmatter above
- [ ] Its `## Writing` and `## Report` blocks match `skills/spec/SKILL.md` exactly
- [ ] `README.md` lists `/ccs:review`; `plugin.json` is `0.4.0`
- [ ] On a branch with a planted bug (`src/engine` imports `src.jobs`), the check catches it and the verdict is `fix first`
- [ ] On a branch with a planted logic bug the linter can't see, a 🔴 finding with `file:line` appears
- [ ] On a clean branch: `No issues found.`, no ruff or style findings
- [ ] Every reported finding has a verifier `confirmed`; the transcript shows one verifier per finding
- [ ] No write besides the report: no edits, no `gh pr comment`, no push

Criteria 4–8 are behaviour, checked by runs on scratch branches in `dental-lab-worker`; grep can't check them.
Verification lowers false positives but can't remove them; nor can it find bugs outside the diff's reach.

## Open questions

1. ~~Finder and verifier model?~~ Settled: inherit the session model (no model ids in the skill).
