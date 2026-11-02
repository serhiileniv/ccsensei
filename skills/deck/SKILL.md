---
name: deck
description: Hackathon, after /ccs:pitch. Builds the whole pitch deck (7–9 slides, demo video at the centre) as offline HTML in the house design, then screenshots and checks every slide and exports PDF. User-invoked only.
argument-hint: "[minutes: 3] [pptx] [lang: uk]"
disable-model-invocation: true
---

# /ccs:deck

The deck supports the talk and frames the demo. It never repeats the script and never
shows a number the repo can't prove.

## Step 0 — inputs

Read `hackathon/plan.md`, `facts.md`, `script.md` (from `/ccs:brief` and `/ccs:pitch`),
`demo/out/` (video + poster), and screenshots the repo has.
No `facts.md` → stop and run `/ccs:pitch` first. Design: [the house design](../../docs/guides/deck-design.md).

## Step 1 — outline

One idea per slide, mapped to a section of `script.md`:

| # | Slide | Content |
|---|---|---|
| 1 | Title | Product name + the promise (the sentence, shortened). No agenda. |
| 2 | Problem | One user's moment, one visual, at most 2 costs. |
| 3 | Idea | The one idea, ≤ 12 words, or the contrast line. |
| 4 | Product | One cropped real screenshot in a device frame, ≤ 3 callouts. Crop, never shrink. |
| 5 | Demo | `demo.mp4` full-bleed, local file, poster frame; live fallback note in speaker notes. |
| 6–7 | Proof | One wow per slide: a big number from `facts.md` + one caption that says what it means. |
| 8 | How it's built | Diagram of the trust path ("LLM proposes, code verifies"), not the stack list. |
| 9 | Close | The sentence + QR to the live link or repo. |

7 slides is fine; 9 is the ceiling. Drop slides before shrinking text.
Demo-data numbers are labelled as demo data.
Show the outline, then build — no approval wait unless the user asked for one.

## Step 2 — build

Copy `${CLAUDE_SKILL_DIR}/template/` to `hackathon/deck/` (keep `vendor/` and `fonts/`; it must present offline).
Edit only the slide sections in `index.html`; reuse the layouts the template already has.

- Speaker notes per slide (`<aside class="notes">`) = that slide's lines from `script.md`.
- Images and video copied into `hackathon/deck/assets/`; relative paths only.
- Colours only from the tokens in `deck.css`. A new colour is a design change: stop and ask.
- ≤ 30 words, ≤ 3 bullets, ≥ 24 px, inside the 64 px safe area.

## Step 3 — QA loop

Once: `cd ${CLAUDE_SKILL_DIR}/qa && npm i && npx playwright install chromium`. Then:
`node ${CLAUDE_SKILL_DIR}/qa/qa.ts hackathon/deck/index.html --out hackathon/deck/out --minutes <limit>`. It renders every slide,
fails on overflow, safe area, small text, word and bullet counts, fonts not loaded, broken or
upscaled images, missing video, off-token colours and > 9 slides, exports the PDF and checks
its page count, and prints talk time from the notes.

Then read the contact sheet and every slide at 960×540 (a projector proxy):
- one idea, takeaway readable in 5 seconds
- consistent alignment and spacing with the other slides
- every number on a slide is in `facts.md`

Fix only failing slides; re-run. At most 3 rounds per slide; still failing → report it.

## Step 4 — output

`hackathon/deck/index.html` (present: open in a browser, `S` for speaker view),
`hackathon/deck/out/deck.pdf`, `hackathon/deck/out/slide-*.png`, `contact-sheet.png`.
QA's Chromium can't play H.264, so it checks the video file and poster exist; open the deck in Chrome once to see it play.
`pptx` in arguments → also one PPTX of full-slide images with notes (not editable; say so).

Print: slide count, talk time vs limit, QA result, and the manual list: team photo, live-state
screenshots not yet captured, test on the venue projector.

What QA cannot check: whether the deck persuades, or how the venue projector renders it.

## Language

`lang: uk` → slide text and notes in Ukrainian; product names, ids and UI labels stay as in the product.

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

Outcome: success = QA passes, PDF exported · partial = deck built, QA fails left · failed = no deck.

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
