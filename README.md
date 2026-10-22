<p align="center"><img src="assets/sensei.svg" width="168" alt="CCS sensei: pixel-art old master with a long white beard, clay headband and a spec scroll"></p>

# Claude Code Sensei

A workflow for [Claude Code](https://code.claude.com/docs/en/skills.md), built from
[Agent Skills](https://agentskills.io): spec before code, test before fix, evidence before
theory. Every run reports on itself, and the skills improve from those reports.

```
spec ──► implement ──► review
              ▲    │
     root-cause    explain          every run ──► .ccs/reports ──► learn ──► better skills
```

![A real run: /ccs:root-cause finds the commit that turned "10% off" into "charge 10%", then /ccs:implement writes the failing tests, fixes one line and runs the suite green](assets/demo.gif)

<sub>A real run on a toy repo, 1.5× speed.</sub>

## Skills

| Skill | What it does |
|---|---|
| `/ccs:spec <slug>` | Writes a design spec to `docs/specs/<slug>.md`, then stops for approval. Refuses trivial work. |
| `/ccs:root-cause <symptom>` | Read-only. Checks every source in reach (repo, CLIs, MCPs such as Sentry, Datadog, PostHog), then finds the root cause with evidence. |
| `/ccs:implement <what>` | Test-first for bugs and features: read the touched code → failing test → smallest code (reuse → stdlib → installed dep → minimum) → refactor for the next reader → suite green. Takes a spec or a root cause. Never commits. |
| `/ccs:review [PR \| branch]` | Read-only. Parallel finders in fresh context, one verifier per finding; reports only verified bugs and rule violations. Repo rules in `REVIEW.md`. |
| [`/ccs:explain`](skills/explain/SKILL.md) | Standalone HTML study guide for finished work, so you can defend it. Optional target and `lang: uk`. User-invoked only. |
| `/ccs:learn` | Turns session corrections and friction repeated across reports into edits to these skills; commits on approval. User-invoked only. |

All skills write KISS: one line where one line does.

## Reports

Every run writes one file to `.ccs/reports/<skill>/<date>-<slug>.md` at the repo root:
outcome (`success | partial | failed`), what it used, what it found, what got in the way.
`.ccs/` goes into `.git/info/exclude`, so reports never show up in a diff.

`/ccs:learn` proposes a skill edit only when **two or more** reports share the same
friction (or one report plus your correction), then marks those reports `learned: <sha>`.

## Guides

| Guide | What it is |
|---|---|
| [design](docs/guides/design.md) | Conventions for Solt Wagner–style Framer marketing sites. Plain markdown, not a skill: point any AI at it before building. |

## Install

```
/plugin marketplace add serhiileniv/ccsensei
/plugin install ccs@ccs
```

Restart Claude Code.

<details>
<summary>Or copy a single skill by hand</summary>

```bash
cp -r skills/explain ~/.claude/skills/explain
```

Or into one project: `<repo>/.claude/skills/explain`. Restart, then type `/explain`.

</details>

## Skill anatomy

A skill is a directory with a `SKILL.md` entry point (YAML frontmatter + instructions) plus
optional files loaded on demand:

```
skills/explain/
├── SKILL.md        # frontmatter + the steps the agent follows
├── STYLE.md        # the study-guide style contract
└── example.html    # a finished guide; its <head>, CSS, nav and script are the template
```

Design records live in [`docs/specs/`](docs/specs/).

## Portability

`argument-hint` and `disable-model-invocation` are Claude Code extensions, not part
of the [Agent Skills](https://agentskills.io) spec. Uploading to claude.ai or packaging with
`package_skill.py` fails with `Unexpected key(s) in SKILL.md frontmatter`: drop those lines
first. The spec allows `name`, `description`, `license`, `compatibility`, `metadata` and
`allowed-tools`.
