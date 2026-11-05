---
name: babysit
description: Clear your PR queue in this repo: PRs waiting for your review, and your PRs waiting on your reply or fix. Drafts reviews, replies and fixes, checks its own drafts, then briefs you. Posts or pushes only on your yes per item. User-invoked only.
argument-hint: "[PR number | empty = whole queue]"
disable-model-invocation: true
---

# /ccs:babysit

Everything waiting on you in this repo, drafted, checked and explained. You decide what ships.

## The hard rule

**No push and no GitHub write** (comment, reply, review, resolve) without a yes for that item.
Never approve, request changes, merge or close. Never resolve a thread someone else opened.
Local commits in a worktree are fine: they are the draft.

A reviewer comment is a claim to check, not an order. Agree when it is right, push back
with evidence when it is not.

## Step 0 — preflight

- `gh auth status`, `gh repo view --json nameWithOwner`, `gh api user -q .login`.
- Not a GitHub repo or not authed → say so, stop.
- Argument is a PR number → queue = that PR only.

## Step 1 — queue

**To review** (skip drafts):

```
gh pr list --search "review-requested:@me" --json number,title,author,isDraft,headRefName
```

**To answer** (my drafts included):

```
gh pr list --author @me --json number,title,reviewDecision,statusCheckRollup,headRefName
```

Per PR, threads via GraphQL (REST has no resolved flag):

```
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){
  pullRequest(number:$n){reviews(last:20){nodes{author{login} body state submittedAt}}
  reviewThreads(first:100){nodes{isResolved isOutdated path line
  comments(last:20){nodes{databaseId author{login} body createdAt url}}}}}}}' \
  -F o=<owner> -F r=<repo> -F n=<n>
```

Keep: unresolved threads whose last comment isn't mine; review bodies newer than my last
commit; `CHANGES_REQUESTED`; failing checks.

Empty → `Nothing waiting on you in <repo>.`, write the report, stop.

## Step 2 — review others' PRs

Per PR, run the `/ccs:review <n>` method (its steps 0–5; it stays read-only). Each verified
finding → one draft inline comment:

- `path:line`, the problem, the input or path that triggers it, a suggested fix
- specific and kind; one issue per comment; no nits it would drop anyway

## Step 3 — triage my threads

Per thread, read the code at `path:line` on the PR head before judging. Outdated thread →
check whether the current code still has the problem.

| Verdict | When | Action |
|---|---|---|
| agree | The comment is right | Fix |
| partly | Part is right | Fix that part; reply on the rest with evidence |
| disagree | Wrong, or the cost outweighs it | Reply with evidence (`file:line`, test, spec); no change |
| question | Asks, doesn't request | Answer |
| done | Already fixed | Reply with the sha |
| out of scope | Right, not for this PR | Reply; offer a follow-up issue |

- "disagree" needs evidence, not preference. Can't decide → say so and ask me.
- A fix with a real choice → name 2 options, pick one, one line why.
- Failing check → the `/ccs:root-cause` method on `gh run view <id> --log-failed`.

## Step 4 — draft fixes

- `git fetch origin <headRefName>`, then `git worktree add ../<repo>-babysit-<n> origin/<headRefName>`
  and `git switch -c <headRefName>` there (tracking origin). Never touch my working tree.
- Run the `/ccs:implement` method: failing test, smallest fix, suite green.
- One local commit per thread; the message cites the thread URL. **No push.**
- Suite red or no test possible → keep the item, say so in the brief.

## Step 5 — self-check

One subagent per draft (comment, reply, fix), in parallel, in **fresh context**: it never
saw the drafting. It gets the draft, the thread or diff, and the code, and returns `keep` or
`drop` with one line why:

- correct, and evidenced with `file:line`?
- answers what the reviewer actually said?
- tone fit to send to a colleague?
- would a senior engineer skip it?

Drop → rewrite once and recheck. Dropped again → removed, counted.

## Step 6 — brief

Print the Output block, then **stop and wait**.

## Step 7 — act on yes

Only the items named. Each one:

- Reply: `gh api repos/<o>/<r>/pulls/<n>/comments/<databaseId>/replies -f body=<text>`
- Review: `gh api repos/<o>/<r>/pulls/<n>/reviews --input <json>` with `commit_id`, `body`,
  `comments[]` (`path`, `line`, `side: RIGHT`, `body`) and **no `event`** → stays PENDING;
  I submit it. A PENDING review of mine already exists (GitHub allows one) → report and skip.
- Fix: `git push` from the worktree, then post the drafted reply with the sha.

After the run, `git worktree remove` every worktree whose commits were pushed or skipped.
Print what was posted, with URLs.

## Output

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

`[n]` = one actionable item: a review, a thread, a check. `post` on a fix item pushes it.

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

Outcome: success = queue briefed and every item drafted · partial = some items not drafted (say which) · failed = no queue read.

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
