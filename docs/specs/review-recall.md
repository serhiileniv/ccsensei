# Spec: `/ccs:review` v2 — recall-first PR review

## Goal

Make `/ccs:review` miss no bug and no regression a reviewer with the repo could find.
v1 is built for precision ("not certain → don't flag"); v2 finds broadly, then verifies
by running code, and shows what it couldn't settle instead of dropping it.

## Non-goals

- **Posting to GitHub, approving, fixing.** Unchanged from v1: a human posts and approves; fixes go to `/ccs:implement`.
- **Style, lint, coverage.** Linters and CI own them; noise hides the bugs this is for.
- **Security audit.** `/security-review` owns it; the security lens only flags holes it can show.
- **A guarantee.** "No missed bugs" is the target, not a property: see Acceptance criteria.

## Current state

| | |
|---|---|
| `skills/review/SKILL.md` | v1, on `feat/review` (`63ba614`, unmerged); installed as plugin `0.4.0`. Spec: `docs/specs/review.md` on that branch. |
| Finders | 2 fixed (`rules`, `bugs`) + one per `REVIEW.md` lens. `bugs` works **from the diff alone**. |
| Verify | One verifier per finding, reads code; `rejected` → silently dropped (count only). |
| Do-not-flag | Ends with "Not certain it is real → don't flag it." |
| Tests | Run only if listed in `REVIEW.md ## Checks`. |
| Runs | `archimedes` 2026-10-27: 5 findings shared one verifier. `ctxline` 2026-10-28: verified inline, not by subagents. No `REVIEW.md` in either → no checks ran. |

Why v1 misses regressions:

1. **Diff-only bug finder** can't see callers, so a changed signature, return value, default, error or ordering that breaks code outside the diff is invisible.
2. **One broad `bugs` finder** on a large diff loses attention; nothing proves every hunk was read.
3. **"Not certain → don't flag"** at the finder stage kills recall before the verifier can check.
4. **Silent drops**: a verifier wrong once hides a real bug with no trace.
5. **No tests** run unless `REVIEW.md` says so; tests are the cheapest regression detector.
6. **No intent check**: the PR body/linked issue is passed in but nothing checks the code does what it claims.

## Proposed design

Principle: **finders maximise recall, verifiers own precision, the human sees the residue.**

### Steps

| # | Step | Change from v1 |
|---|---|---|
| 0 | Scope | + `gh pr view --json title,body,baseRefName,headRefOid,closingIssuesReferences,comments,reviews` and linked issue bodies. Check out head in a **scratch worktree** (`git worktree add <scratchpad>/head <sha>`), never in the user's tree; base in `<scratchpad>/base`. Removed at the end. |
| 1 | Rules | Unchanged. |
| 2 | Map | **New.** Build the change map (one subagent): every hunk with an id (`H1…`), and every changed **symbol** (function, method, type, field, config key, CLI flag, route, DB column, env var, exported const) with its contract change (signature, return, default, raises, side effect, removed). For each symbol, `grep`/LSP its callers and users in head, outside the diff. |
| 3 | Checks + tests | `REVIEW.md ## Checks` as v1. **+ tests:** run `## Tests` (or the detected test command, see Q1) on head; any failure re-runs on base. Fails on head, passes on base = 🔴 regression, reported as fact. Fails on both = 🟣. |
| 4 | Find | Parallel, fresh context. Each finder gets the diff, map, PR intent, rules, do-not-flag list, and **may read the whole head worktree**. Fixed lenses below. Diff > 400 changed lines → each lens is split by hunk groups of ≤ 400 lines. |
| 5 | Coverage | **New.** Each finder returns, per hunk it owns, `finding ids` or `clean: <one-line reason>`. Any hunk with no entry from a lens → that lens re-runs on it once. Every caller from the map must be marked checked by `regression`. |
| 6 | Verify | One subagent per finding (never shared). Must **try to reproduce**: a failing test or script in the scratch worktree, else a `file:line` trace from input to failure. Returns `confirmed` (repro or trace), `rejected` (with `file:line` evidence it can't happen), or `unsure`. |
| 7 | Rank | 🔴 confirmed, blocks merge · 🟠 **unsure — human check** (new; never dropped) · 🟡 nit, cap 5 · 🟣 pre-existing. Rejected listed one line each with the reason. |

### Lenses (fixed)

| Lens | Looks for |
|---|---|
| `regression` | Every caller/user from the map still works under the new contract. Removed or narrowed behaviour still needed somewhere. Changed defaults, ordering, error types, serialization, migrations, config/env, public API. |
| `logic` | Wrong result for some input: boundaries, off-by-one, null/empty/zero, inverted conditions, wrong variable, unit mix-ups, precedence, early return skipping work. |
| `errors-state` | Swallowed/wrong exceptions, missing cleanup, leaks, partial writes, retries not idempotent, races, async not awaited, shared mutable state, cache invalidation. |
| `intent` | Code doesn't do what the PR body / linked issue / spec says; a stated case not handled; scope creep that changes unrelated behaviour. |
| `tests` | Tests changed to pass rather than to check: deleted or weakened assertions, skipped tests, snapshots regenerated over a behaviour change, mocks hiding the changed path. New behaviour with no test **only** when it carries the PR's main claim. |
| `security` | Holes provable from the changed code: injection, authz bypass, secrets, unsafe deserialization, path traversal. |
| `rules` | As v1: must quote the rule and its path. |
| `REVIEW.md ## Lenses` | One finder each, as v1. |

### Do not flag (changed)

Keep v1's list, with two changes:

- **Drop** "Not certain it is real → don't flag it." Replace: *finders flag anything with a concrete trigger; the verifier decides.*
- "Might fail" still needs a concrete input — at the verifier, which must name it or return `rejected`/`unsure`.

Why: false positives cost a verifier run; a missed regression costs a production incident.

### `REVIEW.md` additions

```markdown
## Tests
- `uv run pytest -q -m "not integration"`

## Hot spots
- `src/engine/` — clinical geometry; every change gets `regression` + `logic` at full depth
```

`## Hot spots`: paths whose hunks are never grouped (one finder per hunk per lens).

### Output (changed lines only)

```
Coverage: <h> hunks × <l> lenses, <c> callers checked · re-runs: <n>
Tests: <cmd> — head <pass/fail>, base <pass/fail> | not run: <why>

🔴 file.py:42 — <problem>
   Trigger: <input>   Repro: <test/script path or file:line trace>
   Fix: <one line>
🟠 file.py:88 — <problem>
   Why unsure: <what the verifier couldn't settle>
…
Rejected: <n>
  file.py:10 — <claim> — <reason, file:line>
```

`fix first` when any check/test failed or any 🔴. `🟠` alone → `needs human check on 🟠`.

### Cost guard

Agents = 1 map + lenses × groups + verifiers. Over 40 agents → print the estimate and ask before Step 4.

### Wiring

| File | Change |
|---|---|
| `skills/review/SKILL.md` | Rewrite per above; keep `## Writing` / `## Report` identical to siblings |
| `docs/specs/review.md` | Header line: superseded by this spec |
| `README.md` | Review row: "recall-first, verified by repro" |
| `.claude-plugin/plugin.json` | `0.4.0` → `0.5.0` |

Lands on `feat/review` (v1 is unmerged), rebased on `main`.

## Acceptance criteria

Behaviour, checked by planted-bug runs on scratch branches; grep can't check them.

- [ ] Changed function return type breaks a caller **outside the diff** → 🔴 from `regression`, with the caller's `file:line`
- [ ] Changed default value breaks an existing test → test run reports head fail / base pass → 🔴
- [ ] Off-by-one in a 600-line diff, in the 5th hunk group → found
- [ ] Assertion deleted to make a test pass → 🔴 from `tests`
- [ ] PR body says "handles empty input", code doesn't → 🔴 from `intent`
- [ ] Clean refactor PR → no 🔴, ≤ 2 🟠, no style findings
- [ ] Every hunk has an entry from every lens (coverage line matches hunk count)
- [ ] Every reported 🔴 has a repro or a `file:line` trace; transcript shows one verifier per finding
- [ ] User's working tree and branch unchanged after the run; scratch worktrees removed

Limits: recall is bounded by what agents notice; criteria test known classes, not unknown ones.
Repro needs a runnable env; without one, 🔴 rests on a trace and more lands in 🟠.

## Open questions

1. ~~No `## Tests`?~~ Settled: detect the test command (package.json, pyproject, Cargo, Makefile) and run it.
2. ~~Opt-in `--post`?~~ Settled: no; posting stays manual.
3. ~~Cost guard threshold?~~ Settled: 40 agents.
