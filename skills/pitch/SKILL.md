---
name: pitch
description: Hackathon, after feature freeze. Audits the repo for what can be claimed, then writes a timed spoken pitch, a judge Q&A bank, a rehearsal sheet and the submission text, every claim backed by a file or command. User-invoked only.
argument-hint: "[live 3m | video 3m | 5m] [lang: uk]"
disable-model-invocation: true
---

# /ccs:pitch

Judges score the first 30 seconds, remember one sentence, and punish one exaggeration.
This writes a pitch that survives all three.

Reads `hackathon/plan.md` (from `/ccs:brief`) and `hackathon/demo.md` (from `/ccs:demo`) if
present. Missing plan → ask for the rubric and deadline; never invent criteria.

## Step 1 — facts

Audit in code, not docs. Write `hackathon/facts.md` at the current `<sha>`:

| Column | Rule |
|---|---|
| **Can claim** | Each line: the claim, the number, and the file or command that proves it. Run the command. |
| **Mocked / replayed** | What's simulated, seeded or replayed, and how it shows in the demo. |
| **Not built** | Promised in docs or slides, absent in code. |
| **Must not claim** | Anything a judge could disprove: "live" if shot in replay, "production", user counts you don't have. |

Every number in every later file must appear in **Can claim**. This is the one source of truth.

## Step 2 — proof map

Refresh the rubric table in `plan.md`: each criterion → demo moment + timestamp + file.
A criterion with no proof is a **gap**: print it; fix it in the demo or name it as a weakness.

## Step 3 — script

Write `hackathon/script.md`, for speaking, not reading. Word budget per section
(English ≈ 130 words/min; Ukrainian: time it, it runs longer).

3 minutes:

| Time | Section | Rule |
|---|---|---|
| 0:00–0:15 | What it is, for whom | First sentence says what it is. No team intro, no title-slide chat. |
| 0:15–0:35 | One user's pain | A named person, one concrete failure, one number. |
| 0:35–2:20 | Demo to the wow | One path, real data, wow by 2:00 at the latest. Narrate outcomes, not clicks. |
| 2:20–2:45 | Why trust it | One line on what's hard or safe ("the LLM proposes, code verifies"). Not the stack. |
| 2:45–3:00 | The sentence | End on it. Never "any questions?". |

5 minutes stretches the demo, not the setup. Video format: demo visible within 15 s, total ≤ 90% of the limit.

Include, somewhere, these three lines:
- **Built here**: what was built during the event (judges check commits).
- **One weakness**: named before anyone asks, with what you'd do next.
- **Contrast**: old way vs new, one line ("Chatbots explain. X resolves.").

## Step 4 — cut pass

- ≤ 5 numbers, all yours, all in `facts.md`. No market-size numbers.
- One idea per section. No feature list, no framework names, no terminal on screen.
- Every cut line goes to Q&A. Log it in `script.md` under `## Cut`.

## Step 5 — Q&A

Write `hackathon/qa.md`. One row per question, sorted by likelihood:

```
| Question | H/M/L | Answer (≤ 20 words) | Proof | Bridge back to the strength |
```

Pre-fill at least 12 from the repo, at least one per group:
real vs mocked ("is it live?", "what did you build this weekend?") · the user ("who exactly?",
"what do they do today?") · business (who pays, bottom-up: price × customers; why the sponsor
would fund it) · AI (model wrong? cost and latency per run? prompt injection? why not one prompt?
eval?) · scale (what breaks at 100×? privacy?) · competition (vs a named incumbent) · next 2 weeks.

Unknown → "Don't know yet; here's how we'd measure it." Never a made-up number.

## Step 6 — rehearsal sheet

Append to `script.md`:
- 3 timed runs out loud; record each; cut whatever made you stumble.
- Drill the first 30 s alone until it's automatic.
- Cold read to someone outside: they must say back what it is and who it's for. If they can't, rewrite the first section.
- Who talks, who drives the demo, the exact inputs to paste (type nothing new live).

## Step 7 — submission

Write `hackathon/submission.md`: Devpost/README copy. The sentence, the problem, what it does,
how it's built (one paragraph), what's real vs replayed, one section per sponsor prize with
the exact integration, live link, video link, repo link.

## Gate

Before ending, check and print pass/fail per line:
- script fits the time at the word budget
- first sentence says what it is
- wow lands ≤ 2:00
- every number in script, Q&A and submission is in `facts.md`
- the three required lines are present
- script ends on the sentence

A fail → fix it, check again. Then name the next command: `/ccs:deck`.

What the gate cannot check: whether it persuades. Rehearsal and a cold listener do.

## Language

`lang: uk` → script, Q&A and rehearsal in Ukrainian; product names, ids, code and UI labels stay as in the product. Submission stays in the event's language.

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

Outcome: success = gate all pass · partial = files written, gate has fails the user accepted · failed = no facts.md.

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
