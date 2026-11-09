# Spec: every skill writes a run report; `learn` improves skills from them

## Goal

Each ccs skill run ends with a short report: did it work, what it used, what it found,
what got in the way. Reports gather in the repo's `.ccs/reports/`. Once a few runs show the same
friction, `/ccs:learn` turns it into a skill edit. That gives `learn` evidence from many
runs instead of one session's memory.

## Non-goals

- **Telemetry or upload.** Reports stay on this machine.
- **Automatic skill edits.** `learn` still stays user-invoked and still gates on approval.
- **Committing reports.** `.ccs/` is excluded through `.git/info/exclude`, so it never shows up in a diff or PR and no tracked `.gitignore` changes.

## Current state

| | |
|---|---|
| `skills/*/SKILL.md` | No skill records its outcome. Each shares only the `## Writing` block. |
| `skills/learn/SKILL.md` step 1 | Lessons come from the current session only. |
| `skills/learn/SKILL.md` step 5 | Drift check covers the `## Writing` block only. |
| Report storage | None. |

## Proposed design

### Location

```
<repo root>/.ccs/reports/<skill>/<YYYY-MM-DD>-<slug>.md
```

Per repo, next to the work it describes. The first write adds `.ccs/` to `.git/info/exclude`
if it isn't there yet. Outside a git repo: the current directory's `.ccs/reports/`.
Superseded: `learn` now scans every repo; see [report-driven-fixes](report-driven-fixes.md).

### Report format

```markdown
---
skill: root-cause
date: 2026-09-18
repo: serhiileniv/ccs
target: <argument the skill was given, one line>
outcome: success | partial | failed
learned: false
---

Used: <tools, CLIs, MCPs, files: what actually did the work>
Found: <the result in one or two lines: root cause, spec path, tests added…>
Friction: <what slowed or blocked it: missing access, a step that didn't fit, a user correction. "none" if none>
```

Each skill defines what `success` means for it:

| Skill | success | partial | failed |
|---|---|---|---|
| `spec` | Approved | Approved after `modify:` rounds | Abandoned |
| `implement` | Every list item green or `manual`, suite green | Some items left | Suite red, or stopped |
| `root-cause` | Root cause found | Proximate only | Not found |
| `explain` | Guide written | Written, then rewritten on request | Not written |
| `learn` | Edit committed | Edit shown, not approved | Nothing qualified |

### Shared `## Report` block

Copied inline into every skill, next to `## Writing`, byte-identical (same reason: each
skill stays copyable as one directory):

```markdown
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
```

The success table lives in each skill as one line of its own, outside the shared block.

### `learn` changes

- Step 1: lessons also come from the current repo's `.ccs/reports/` with `learned: false`. A report lesson needs
  **≥2 reports with the same friction**, or one report plus a user correction. One-off
  friction is not a lesson.
- Step 5: drift check covers `## Report` as well as `## Writing`.
- Step 6: after the commit, set `learned: <short sha>` on the reports that fed it.
- Reports that fed nothing stay `false`; `learn` never deletes reports.

### Wiring

| File | Change |
|---|---|
| `skills/{spec,implement,root-cause,learn}/SKILL.md` | `## Report` block + a one-line success definition |
| `skills/explain/SKILL.md` | Same, in §4 "Close the loop" |
| `skills/learn/SKILL.md` | Steps 1, 5, 6 as above |
| `README.md` | One line under Skills: runs write reports to `.ccs/reports/`; `/ccs:learn` reads them |

## Acceptance criteria

- [ ] All five skills contain an identical `## Report` block (checked with `diff`)
- [ ] Each skill states its `success / partial / failed` in one line
- [ ] A run of any skill leaves exactly one file under `.ccs/reports/<skill>/` with every frontmatter field filled
- [ ] `git status` stays clean after a report is written
- [ ] `learn` with two reports sharing a friction proposes an edit; with one, it doesn't
- [ ] After an approved `learn` commit, its source reports read `learned: <sha>`

Criteria 3, 5 and 6 are behavioural, checked by real runs. Grep can't check whether a
report's `Friction` line is honest; a run that hides its friction teaches `learn` nothing.

## Open questions

1. ~~Location?~~ Settled: per repo, `.ccs/reports/`, excluded locally.
2. ~~Per item or per run?~~ Settled: per run; the list goes in `Found`.
