---
name: demo
description: Hackathon, at feature freeze. Writes the demo scenario, checks every external call has replay and reset, dry-runs each scene, then records a captioned demo video with the bundled Playwright recorder (16:9, 9:16, gif, srt, backup cut). User-invoked only.
argument-hint: "[scene hint] [max: 120s] [lang: uk]"
disable-model-invocation: true
---

# /ccs:demo

A demo that breaks on stage loses. A video that takes 40 seconds to show anything loses.
This makes a demo that can't do either.

Reads `hackathon/plan.md` (demo script v0, replay list) if present.

## Step 1 — scenario

Write `hackathon/demo.md`:

- **Prep**: exact start commands, reset step, window 1440×900, theme, production build (no dev badges), seeded data.
- **Scenes**:

  | # | Time | Action | Visible | Judge understands | Caption (≤ 8 words) |

- **Must stick**: the 1–2 moments a judge should retell. The first one lands ≤ 15 s into the video.

One user, one path, real data. Cut every scene that doesn't prove a rubric criterion.

## Step 2 — replay check

For every external call on the demo path (LLM, APIs, speech, payments), find in code:
a replay or fixture flag, and a reset for seeded state.

- Found → name the flag and file in `demo.md`.
- Missing → print the gap and the `/ccs:implement` command to add it. **Write no product code here.**
- Replay that was hand-scripted, not recorded from a real run → say so; it is not "a replay of a live run".
- Recording in replay → the recorder adds a "Replay of a live run" chip. Never claim "live".

## Step 3 — preflight and dry run

Start the app as `demo.md` says. Then write `hackathon/demo-readiness.md`:

| Check | Result | Fix |

Cover: health endpoint, keys present, model and quota/rate limits (a token-per-minute ceiling
stalls a live demo), reset works twice, every scene once end to end. PASS/FAIL per line.
FAIL on the core path → stop and report; don't record a broken demo.

## Step 4 — record

The engine lives in `${CLAUDE_SKILL_DIR}/recorder/`. If the repo has no `demo/` yet, copy it there
and install (`pnpm i` or `npm i`, then `npx playwright install chromium`). Needs ffmpeg; check first.

Write only `demo/scenario.ts`, from `scenario.example.ts`:
- one entry per scene from `demo.md`, with its caption; mark the wow scene `wow: true`
- selectors from a live snapshot of the running app (accessibility roles and names), never guessed
- `expect` locators for each scene so preflight can fail fast

Then: `npm run check` (all scenes' selectors and health, no recording) → fix until green →
`REPLAY=<0|1> npm run demo`.

## Step 5 — review the cut

Open `demo/out/poster.png` and frames around each caption. Check and print pass/fail:
- duration ≤ the limit and ≤ 90% of it for video submissions (default 120 s)
- first wow ≤ 15 s (the renderer warns)
- captions ≤ 8 words, readable at 960×540
- no dev badges, no secrets, no real customer data on screen

Outputs: `demo.mp4` (16:9), `demo-vertical.mp4` (9:16), `demo.gif`, `poster.png`, `demo.srt`.
Backup for the live pitch: `MAX_S=60 npm run render && mv out/demo.mp4 backup-60s.mp4 && npm run render`.
The backup goes outside `out/` because every render wipes `out/`; the replay chip follows the recording. Speed ramps only compress
`fast()` waits; if the core flow can't fit 60 s, drop scenes from a copy of `scenario.ts` instead.
Tell the user to keep the backup on the desktop and a USB stick.

## Manual path

Voice, mobile or real-microphone demos: write a shot list from `demo.md` for Screen Studio or
Cap, then check the user's recording against step 5.

## Language

`lang: uk` → demo.md and captions in Ukrainian; UI labels stay as on screen.

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

What the checks cannot do: tell whether the story lands. Watch the video once with sound off, as a judge would.

Outcome: success = video rendered, step 5 all pass · partial = scenario and readiness written, recording blocked or failing checks · failed = core path broken.

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
