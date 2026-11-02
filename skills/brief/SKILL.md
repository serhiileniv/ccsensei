---
name: brief
description: Hackathon hour 0, before any code. Turns the organisers' brief and rubric into a picked idea and a winning plan: your ideas first, then your notes, then the LLM's; a simulated judge panel scores them; writes hackathon/plan.md. User-invoked only.
argument-hint: "[brief file | URL | pasted text] [hours: N] [lang: uk]"
disable-model-invocation: true
---

# /ccs:brief

The idea decides most of the result. Spend the first hour here, not in code.

You widen and stress-test; **the user picks**. Never choose the idea for them.

## Step 1 — the room

Read everything the organisers give: `$ARGUMENTS`, files or URLs it names, and the event page.
Then search the web for the judges, the sponsors and past winners of this event or series.

Collect, one line each:

- **Rubric**: criteria and weights. Not published → ask the user; never invent weights.
- **Deadline and format**: end time, live or video, pitch length, submission items.
- **Sponsors**: prizes, their tech, what they'd love to see built on it.
- **Judges**: who they are, what they've built or funded.
- **Past winners**: what won and why it fit the room.

`hours:` missing → compute from the deadline; unknown → ask.

## Step 2 — ideas, in this order

1. **Yours first.** Ask the user (and teammate) at most 5 questions that pull out domain
   knowledge: a problem they've lived, a tool they wish existed, data they can get, a user they
   know. Winners of Built with Opus 4.6/4.7 were domain experts solving their own problem.
   Wait for answers.
2. **Their notes.** If a Craft MCP is connected, search the user's second brain for past
   ideas, projects and domains that fit the theme. Quote what you found with its title.
   Not connected → say so in one line and continue.
3. **LLM extras.** At most 3 bold ideas, labelled `LLM`. They compete; they don't lead.

Merge duplicates. Keep 4–8 candidates.

## Step 3 — judge panel

Play each real judge and sponsor (from step 1; generic personas only if none are known).
For every candidate, score 1–5:

| | |
|---|---|
| Rubric fit | weighted by the published criteria |
| Wow | one moment a judge retells; reachable in the first 60 s of the demo |
| Buildable | one working end-to-end path in `hours × 0.6`, with replay for external calls |
| Sponsor fit | deep use of 1–2 sponsor techs, not 8 mentions |
| Domain edge | why this team, not any team |

Plus **the sentence test**: write "X for Y that Z". A judge must be able to repeat it an hour
later. No sentence → the idea isn't ready.

Show the table sorted by weighted score, each judge's one-line objection to the top 3, then
stop and ask the user to pick. Offer to merge two ideas if the table suggests it.

## Step 4 — the plan

Write `hackathon/plan.md` at the repo root (create the folder):

```markdown
# <Product> — plan

**The sentence:** <X for Y that Z>
**Deadline:** <date time tz> · **Format:** <live|video> <min> · **Freeze:** <time at 75%>

## Rubric
| Criterion | Weight | Proof moment in the demo |
Every criterion has a planned proof. Every feature names its criterion.

## Ideas
<score table from step 3, the pick and why, in 2 lines>

## Demo script v0 (90 s)
One user, one path, one wow by 0:60.
| # | Time | User does | Screen shows | Judge understands |

## Replay
Every external call (LLM, APIs, speech) that needs record/replay and a reset. Build these first.

## Timeline
| Time | Milestone |
Core loop end-to-end and deployed by 25% · "can we demo now?" every ~4 h · freeze at 75% ·
demo recording starts at freeze · submit a draft 2 h before the deadline.

## Cut order
What goes first when time runs short, top = first cut.

## Anti-drift
Lines to paste into the repo's CLAUDE.md.
```

Anti-drift always contains:
- No stack change after hour 2.
- No new feature after freeze; polish, demo and pitch only.
- No rename after freeze.
- Mock only what isn't the core; the core path is real.

## Step 5 — next

Print the sentence, the freeze time, then: build with `/ccs:spec` → `/ccs:implement`
(replay first); at freeze run `/ccs:demo`, then `/ccs:pitch`, then `/ccs:deck`.

## Language

`lang: uk` → write plan.md and questions in Ukrainian; product names, ids and code stay as they are.

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

The panel is a simulation: it catches weak fit and missing wow, not real judges' taste. Say so once.

Outcome: success = idea picked and plan.md written · partial = plan written with unknowns (rubric, deadline) · failed = no pick.

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
