# Spec: `/ccs:harness` — harness from how the agent actually failed

## Goal

Build a repo's harness (rules, hooks, skills) from evidence of repeated agent mistakes in
that repo, not from scanning its code. Every proposal cites the sessions it came from and is
checked against a replay before it's kept. Pitch: "your agent stops making the same mistake
twice", with a number behind it.

## Non-goals

- **No code-derived rules** ("uses Next.js", "tests in `tests/`"). The agent reads the code
  itself; `/init` already covers it. This is the whole differentiator.
- **No edits to `~/.claude/CLAUDE.md` or memory files.** User-level, same rule as `learn`.
- **No commits, no PRs.** Writes the working tree after approval; the user commits.
- **No new ccs skills.** That's `learn`'s job for the plugin itself; `harness` targets the
  user's repo.
- **No cloud or cross-machine transcripts in v1.** Local `~/.claude/projects` only.

## Current state

| | |
|---|---|
| `skills/learn/SKILL.md` | Same idea for ccs skills: ≥2 reports or 1 + correction → edit. Reads the current session and `.ccs/reports`, not past transcripts. |
| `/init`, `skill-creator` | Generate CLAUDE.md / skills from code and prompts. No behaviour evidence. |
| `fewer-permission-prompts` | Scans transcripts for repeated tool calls → allowlist. Proves the transcript-mining pattern. |
| `~/.claude/projects/<cwd-slug>/*.jsonl` | One file per session. kavalerka: 24 sessions, 284 MB. sleep-coach, ascenari: run from `~`, so they sit in `-Users-serhiileniv/` (3 and 23 files mention them); each record has a `cwd` field. |
| Human turns in transcripts | kavalerka: 1344 short `user` texts, mostly noise (bash output, compaction summaries, injected skill bodies). Explicit markers ("ні", "stop", interrupts) ≈ 1. Corrections are implicit, so regex can't find them. |
| PR review comments | kavalerka PRs #9–#11: 0 review comments (solo repo). Optional source, often empty. |
| `claude plugin eval` | Runs `evals/**/case.yaml` + graders against a plugin, with `--ablation` no-plugin baseline. |

## Proposed design

```
/ccs:harness [repo path, default cwd] [--since 30d]
```

User-only (`disable-model-invocation: true`): it writes config.

### Files

```
skills/harness/
├── SKILL.md
├── mine.py        # stdlib only; transcripts + git → candidates.jsonl
└── LADDER.md      # which output type each lesson becomes
```

### Step 1 — mine (`mine.py`, deterministic)

Input: repo path. Output: `.ccs/harness/candidates.jsonl` (never committed; `.ccs/` is excluded).

| Source | Selection | Emits |
|---|---|---|
| Transcripts | sessions whose records have `cwd` under the repo | turn pairs: last assistant text/tool call (≤400 chars) → next human message (≤400 chars) |
| Transcripts | rejected tool calls, `[Request interrupted by user]` | same pair, `kind: reject` |
| git | `Revert` commits; a file changed again within 24 h by a `fix` commit | commit subject + files, `kind: git` |
| `gh` (if authed) | PR review comments | comment + path, `kind: review` |

Human message filter: drop `isMeta`, tool results, `<bash-stdout>`/`<command-*>` blocks,
compaction summaries, skill bodies. Secrets: redact anything matching the usual key/token
patterns before writing. Raw transcripts never leave the miner.

### Step 2 — classify (model)

Batches of ~100 pairs, one subagent per batch: `correction | preference | noise`, plus a
one-line "what the agent did wrong". Why a model: corrections are implicit (see Current
state).

### Step 3 — cluster and threshold

Group corrections by the mistake. Keep a cluster only if it spans **≥2 sessions** (same bar
as `learn`). Drop anything a reader could get from the code.

### Step 4 — pick the output type (`LADDER.md`, strongest first)

| Mistake shape | Becomes | Where |
|---|---|---|
| Checkable before/after a tool call (wrong command, forbidden path, skipped test) | hook | `.claude/settings.json` + `.claude/hooks/<name>.sh` |
| A judgement rule ("Ukrainian copy, no dashes", "Telegram auth path first") | one line | the repo's agent file: `AGENTS.md` if present, else `CLAUDE.md` |
| A multi-step procedure repeated and corrected (deploy, migration) | skill | `.claude/skills/<name>/SKILL.md` |

A hook beats a rule because it blocks instead of asking. A rule beats a skill because it's
always loaded and one line.

### Step 5 — gate

One block per proposal: the change, the sessions (id + date), one quoted line of evidence.
Stop. Approved items are written; nothing is committed.

### Step 6 — replay eval

For each approved cluster, write `.ccs/harness/evals/<slug>/case.yaml`: the original user
request as prompt, a grader "does not repeat <mistake>". Run with and without the new
harness; report pass rate both ways. A proposal that doesn't move the rate is flagged for
removal.

Can't do: prove the original mistake reproduces (models and repo state moved on). A case
that passes in both arms means "not reproduced", not "fixed".

### Report

Standard ccs report block, plus `Found: N candidates → M corrections → K clusters → J written; eval A% → B%`.

## Acceptance criteria

- [ ] `mine.py` on kavalerka writes candidates with zero bash-output, skill-body or compaction lines in a 50-line sample.
- [ ] No string matching a token/key pattern appears in `candidates.jsonl` or any proposal.
- [ ] Every proposal cites ≥2 distinct session ids.
- [ ] No proposal states something derivable from `package.json`, configs or the file tree.
- [ ] Nothing is written before approval; nothing is committed after.
- [ ] Run on kavalerka, sleep-coach, ascenari; report per repo: clusters found, kept after 1 week, eval with/without.
- [ ] Kill criterion: across the 3 repos, <50% of written items survive a week → stop, don't ship.
- [ ] README lists `/ccs:harness`; `plugin.json` version bumped.

## Open questions

1. Does `claude plugin eval` accept a repo's `.claude/` as the target, or must replay cases run via `claude -p` with/without the harness files?
2. Classification cost on 24 sessions × ~1000 pairs: run it on Haiku, or let it use the session model?
3. Ship inside `ccs`, or as a separate plugin for a cleaner pitch on TikTok/marketplaces?
