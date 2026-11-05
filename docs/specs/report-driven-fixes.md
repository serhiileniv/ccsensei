# Spec: report-driven fixes

## Goal

Fix the six frictions that recur across the 37 ccs reports in `~/Projects` (20 repos). Each
fix cites the reports behind it. Several are the frictions `learn` itself should have caught,
and it couldn't, because it never saw them (fix 2).

## Non-goals

- **No new skills.** Every fix is an edit to an existing skill.
- **No central report store.** Moving reports to `~/.ccs` would change every skill's report path; scanning finds the same files with one edit to `learn`.
- **No auto-written `REVIEW.md`.** `review` is read-only; it suggests one instead.
- **No environment fixes** (auto-mode classifier timeouts, ECC GateGuard). Not ccs.

## Current state

Base: `origin/main` at `ef3c4ba`, plugin `0.5.0`. Local `main` is stale (`9d6b03d`).

| Fix | File | Today | Reports |
|---|---|---|---|
| 1 manual verify | `skills/implement/SKILL.md` step 1, 6 | Uncheckable item → `manual: <why>`, left open | callout, aside, rozkladka ×2, lidpuppet, flybar, module-hoses: 10/21 implement runs `partial` |
| 2 cross-repo learn | `skills/learn/SKILL.md` step 1 | Reads `.ccs/reports/` of the current repo only (caveat already in `docs/specs/skill-reports.md`) | ccsensei sees 3 of 37 reports |
| 3 preflight | `skills/spec`, `skills/implement` | No repo/branch/base check | every (base behind), review-recall (wrong branch), evals (wrong repo), this spec (stale local main) |
| 4 how it's used | `skills/spec/SKILL.md` template | No section on who triggers it and how | ctxline ("має працювати автоматично"), personal-website, every |
| 5 review w/o REVIEW.md | `skills/review/SKILL.md` step 2 | No `REVIEW.md` → no checks run | ctxline, archimedes, ccsensei-hackathon: 3/3 |
| 6 no test runner | `skills/implement/SKILL.md` step 0 | "No test runner → stop. Choosing one is a spec." | ccsensei-hackathon (switched to `node --test`) |

## Proposed design

Branch `feat/report-driven-fixes` off `origin/main`.

### 1. `implement`: verify manual items before calling them manual

Step 1: `manual: <why>` stays. Step 6 adds a pass over every `manual` item, stopping at the first rung that works:

1. **Run it**: the `run` skill, Playwright MCP, a CLI call, or a rendered screenshot. Evidence → item becomes `verified: <how>`.
2. **Can't run it** (OS permission, hardware, voice, real GPU) → one checklist line: `do <action> → expect <result>`.

The output and the report get a `Manual:` block listing the checklist. Outcome: items on the checklist don't make the run `partial`; unrun and unlisted items still do.

### 2. `learn`: scan every repo's reports

Step 1 reads reports from:

```
find "${CCS_SCAN_ROOT:-$HOME/Projects}" -maxdepth 6 -path '*/.ccs/reports/*' -name '*.md'
```

Depth 6 covers nested repos (`startup/rozkladka`, `Ideas/noupload`). It keeps `learned: false` only. The "≥2 reports" bar must now span **≥2 repos or ≥2 dates**, so that one bad day in one repo isn't counted as a pattern.
After commit, set `learned: <sha>` in each source file, wherever it lives. These files sit in `.ccs/`, which is excluded from git, so other repos' diffs stay clean.

Update the caveat line in `docs/specs/skill-reports.md` to point to this spec.

### 3. Preflight line in `spec` and `implement`

The first output line is `repo <owner/name> · branch <b> · base <origin/x @ sha> · <clean|dirty>`. Run `git fetch` first.
Stop and ask only when one of these holds:

- the request names a repo or path that isn't this one
- `implement` is on the default branch
- the local base is behind `origin/<base>`

Otherwise continue. A confirmation on every run is noise.

### 4. `spec`: "How it's used" section

New template section after `## Goal`:

```markdown
## How it's used
Who triggers it, how (automatic | flag | command | UI), and what they see. One line each.
```

At the gate, it's the first thing restated, before the open questions. That's the line the three rejected designs would have failed on.

### 5. `review`: inferred checks when there's no `REVIEW.md`

Step 2: no `## Checks` → infer them from the repo, in this order, and run what exists:

| Source | Commands |
|---|---|
| `package.json` scripts | `test`, `lint`, `typecheck` |
| `pyproject.toml` | `ruff check`, `pytest`, if installed |
| `Makefile` | `test`, `lint` targets |
| `Cargo.toml` / `go.mod` / `Package.swift` | `cargo test` / `go test ./...` / `swift test` |

The output says `Checks: inferred (no REVIEW.md)`. It ends with a suggested `REVIEW.md` holding the inferred checks, printed and not written.

### 6. `implement`: built-in runner instead of a stop

Step 0: no test runner → use the language's built-in one (`node --test`, `python -m unittest`, `go test`, `cargo test`, `swift test`) and say so in one line. Stop only when the language has none, or when the repo has tests that no runner covers.

### Also

- Every edited skill keeps the shared `## Writing` and `## Report` blocks byte-identical.
- README: `learn` row says "reports from every repo under `~/Projects`".
- `plugin.json` and `marketplace.json` → `0.6.0`.

## Acceptance criteria

- [ ] `implement` step 6 has the run → checklist ladder; the report template has a `Manual:` line.
- [ ] The `find` from fix 2, run on this machine, returns the 37 known reports.
- [ ] `learn` step 1 names `CCS_SCAN_ROOT` and the ≥2 repos-or-dates rule.
- [ ] `spec` and `implement` start with the preflight line; the three stop conditions are listed.
- [ ] The `spec` template has `## How it's used`; step 4 restates it first.
- [ ] `review` step 2 has the inference table; the output template has `Checks: inferred`.
- [ ] `implement` step 0 no longer says "stop" for a missing runner.
- [ ] `diff` of the `## Writing` + `## Report` blocks across all `skills/*/SKILL.md` is empty.
- [ ] Version `0.6.0` in both manifests; README `learn` row updated.

What these checks can't do: prove the frictions stop. Only new reports can, so re-count `partial` runs and repeated frictions after ~10 runs.

## Open questions

1. Should checklist-only items still count as `success` (fix 1)? Doing so hides how much can't be verified. Default: yes, plus a `Manual: <n>` line in the report so `learn` can still count them.
2. This spec and the uncommitted `learn/open-question-defaults` diff both edit `skills/spec/SKILL.md`. Which merges first? Default: `learn/open-question-defaults` first (it's small), then rebase this branch.
3. Is the scan root `~/Projects` right for all your work? Some repos run from `~`. Default: `~/Projects`, overridable with `CCS_SCAN_ROOT`.
