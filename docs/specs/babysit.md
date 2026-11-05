# Spec: `/ccs:babysit` — clear my PR queue in this repo

## Goal

Cut review overhead. One command finds every PR in the current repo that waits on me (my
review, or my reply or fix), drafts the review comments, replies and fixes, has a fresh
agent check each draft, then briefs me. Nothing reaches GitHub or the remote without my yes.

## Non-goals

- **Other repos.** Fixes need a checkout; one repo keeps every item actionable.
- **Approving, requesting changes, merging.** Those are human decisions; reviews are left PENDING for me to submit.
- **Agreeing by default.** A reviewer comment is a claim to check, not an order.
- **Re-implementing review, TDD or debugging.** It runs the `/ccs:review`, `/ccs:implement` and `/ccs:root-cause` methods.
- **Running unattended.** Wrap it in `/loop` if wanted; the skill itself stops at the brief.

## Current state

| | |
|---|---|
| `skills/review/SKILL.md` | Read-only branch/PR review: parallel finders, one verifier per finding. Never posts. |
| `skills/implement/SKILL.md` | Test-first fixes; never commits. |
| `skills/root-cause/SKILL.md` | Read-only cause-finding from repo, CLIs, MCPs. |
| `README.md` | Skills table; no queue or PR-response skill. |
| `.claude-plugin/plugin.json` | `0.5.0`. |
| GitHub access | `gh` 2.97 authed. `gh pr list --search "review-requested:@me"` and GraphQL `reviewThreads` checked on this repo. GitHub MCP not connected. |

Nothing in the repo reads PR comments or writes to GitHub today.

## Proposed design

### Skill

`skills/babysit/SKILL.md`, user-invoked only: it can post and push.

```yaml
name: babysit
description: Clear your PR queue in this repo: PRs waiting for your review, and your PRs waiting on your reply or fix. Drafts reviews, replies and fixes, checks its own drafts, then briefs you. Posts or pushes only on your yes per item. User-invoked only.
argument-hint: "[PR number | empty = whole queue]"
disable-model-invocation: true
```

### The hard rule

No push, no GitHub write (comment, reply, review, resolve) without a yes for that item.
Never approve, request changes, merge or close. Never resolve a thread someone else opened.
Local commits in a worktree are fine; they are the draft.

### Steps

| # | Step | Rule |
|---|---|---|
| 0 | Preflight | `gh auth status`; `gh repo view --json nameWithOwner`; `gh api user -q .login`. Not a GitHub repo or not authed → say so, stop. |
| 1 | Queue | **To review:** `gh pr list --search "review-requested:@me" --json number,title,author,isDraft,headRefName`. **To answer:** `gh pr list --author @me --json number,title,reviewDecision,statusCheckRollup,headRefName`; per PR, GraphQL `reviewThreads(first:100){isResolved isOutdated path line comments(last:20){databaseId author{login} body createdAt url}}` (REST has no resolved flag). Keep: unresolved threads whose last comment isn't mine, review bodies after my last commit, `CHANGES_REQUESTED`, failing checks. Empty → `Nothing waiting on you in <repo>.` |
| 2 | Review others | Per PR, the `/ccs:review <n>` method. Each verified finding → one draft inline comment: problem, trigger, suggested fix. Specific, kind, one issue per comment. |
| 3 | Triage mine | Per thread, read the code at `path:line` on the PR head before judging. Verdict below. A fix with a real choice → name 2 options, pick one, say why. Failing check → the `/ccs:root-cause` method on `gh run view <id> --log-failed`. |
| 4 | Draft fixes | `git worktree add` on the PR head branch; the `/ccs:implement` method (failing test, smallest fix, suite green). One local commit per thread, message cites the thread URL. No push. |
| 5 | Self-check | One fresh-context subagent per draft, in parallel; it never saw the drafting. Gets the draft, the thread or diff, the code. Returns `keep` or `drop` with a reason: correct? evidenced with `file:line`? answers what the reviewer actually said? tone fit to send? would a senior skip it? Drop → one rewrite, rechecked; dropped again → gone, counted. |
| 6 | Brief | Output below. Then wait. |
| 7 | Act on yes | Reply: `gh api repos/<o>/<r>/pulls/<n>/comments/<id>/replies -f body=…`. Review: `gh api repos/<o>/<r>/pulls/<n>/reviews` with `comments[]` and **no `event`** → PENDING; I submit it. Fix: `git push` from the worktree, then reply with the sha. Remove worktrees after. |

### Verdicts (step 3)

| Verdict | When | Action |
|---|---|---|
| agree | The comment is right | Fix |
| partly | Part is right | Fix that part; reply on the rest with evidence |
| disagree | Wrong, or the cost outweighs it | Reply with evidence (`file:line`, test, spec); no change |
| question | Asks, doesn't request | Answer |
| done | Already fixed | Reply with the sha |
| out of scope | Right, not for this PR | Reply; offer a follow-up issue |

Honesty: "disagree" needs evidence, not preference. Can't decide → say so, ask me.

### Output

```
Babysit: <owner/repo> · to review: <n> PRs · to answer: <n> threads on <m> PRs

To review
  [1] #12 "<title>" @author · <files> files, +a/-d · fix first | looks good
      🔴 api.ts:42 — <draft comment>
         Why: <one line>
To answer
  [2] #9 api.ts:10 @reviewer: "<quote, one line>"
      Verdict: agree · Fix: <sha> "<subject>", tests: <n> pass
      Reply: <draft>
      Why: <one line>
  [3] #9 checks: <job> failing — <root cause, one line> · Fix: <sha>

Dropped by self-check: <n> · Not checked: <what this run could not see>

Reply: post all | post 1,3 | edit 2: <text> | skip
```

`[n]` = one actionable item (a review, a thread, a check). `post` on a fix item pushes it.

Ends with the shared `## Writing` and `## Report` blocks.

### Wiring

| File | Change |
|---|---|
| `skills/babysit/SKILL.md` | New |
| `README.md` | Skills-table row: `/ccs:babysit [PR]` — "Your PR queue in this repo: reviews to give, threads to answer. Drafts and self-checks each, acts only on your yes. User-invoked only." |
| `.claude-plugin/plugin.json` | `0.5.0` → `0.6.0` |

## Acceptance criteria

- [ ] `skills/babysit/SKILL.md` exists with the frontmatter above
- [ ] Its `## Writing` and `## Report` blocks match `skills/review/SKILL.md` exactly, except the `Outcome:` line
- [ ] README row and `0.6.0` present
- [ ] Empty queue: prints the empty line, writes a report, makes no GitHub call that writes
- [ ] Run on a PR with 3 threads (valid bug, wrong suggestion, question): verdicts agree / disagree / question, one local fix commit with a test, zero GitHub writes before `post`
- [ ] A review posted via `post` shows as PENDING in GitHub, not submitted
- [ ] `post 1` writes only item 1

Criteria 4–7 are behaviour, checked by one run on a scratch repo; grep can't check them.
The "to review" queue needs a second account or team request: GitHub won't let you request
your own review.
The self-check lowers wrong drafts; it can't prove a reply is right. I still read the brief.

## Open questions

1. ~~A PENDING review already exists on a PR (GitHub allows one per user) → append comments to it, or report and skip?~~ Settled: report and skip.
2. ~~Queue items on draft PRs → include or skip?~~ Settled: skip others' drafts; include mine.
