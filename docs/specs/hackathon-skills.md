# Spec: hackathon skills — brief, pitch, demo, deck

## Goal

Win hackathons, not take part. Judges score fit to the rubric, one working path, an early wow
and an honest pitch; the code is only part of it. Four skills cover the whole event, from hour 0
to submission, each backed by evidence from the repo. They encode what worked in Resolly
(codefest) and Silpo, and fix what didn't.

## Non-goals

- **No team formation or post-event follow-up.** Nothing to automate; a public repo and demo link are enough.
- **No live-stage tooling (slides clicker, timer apps).** Rehearsal is a checklist, not a skill.
- **No auto-implementing replay mode.** `/ccs:demo` finds the gap and hands it to `/ccs:implement`; product code is not its job.
- **No Claude Design / Gamma prompts as output.** `/ccs:deck` builds the deck itself; a prompt for another tool can't be checked.

## Current state

| | |
|---|---|
| `skills/` | spec, implement, root-cause, explain, learn. Nothing before the build or after it. |
| codefest `docs/criteria.md`, `docs/execution-plan.md` | Criterion → proof table; freeze 15:30 planned, boxes F1–F3 never ticked; Fix-it agent, redesign and rename Verdict→Resolly shipped 15:00–15:57; recorder committed 16:19, deadline 17:00. |
| codefest `presentation/` | research.md (real/simulated/don't claim), speaker-notes.md, demo-scenario.md, design-prompt.md (for Claude Design, unchecked). Pitch opens with "Ми — команда Resolly"; demo at slide 5; 9+ numbers. |
| codefest `demo/` | Playwright recorder: CDP frames at 2×, cursor glide, ripple, speed ramps, captions → mp4/gif (685 lines). Engine fused with the Resolly scenario; zoom is a CSS transform on `<body>`; selectors went stale after the redesign; no audio. |
| codefest `docs/decisions.md` | "Replay" = scripted from the FE mock, not recorded live runs. |
| silpo `docs/` | 6 overlapping plan docs (FINAL-PLAN 728 lines, pitch-prep 518); no footage 3 days before deadline; new scope added 4 days out. demo-readiness.md (live dry run, PASS/FAIL) is good. |
| `docs/guides/design.md` | Framer marketing-site guide (Montserrat/Open Sans, teal). Not a deck design. |

## Proposed design

### Flow

```
hour 0                build (existing)              freeze (75%)        last 25%
/ccs:brief ──► /ccs:spec ──► /ccs:implement ──► /ccs:demo ──► /ccs:pitch ──► /ccs:deck
   │                                                │              │              │
   └── hackathon/plan.md (rubric, idea, wow, freeze, cut order)   facts.md is the only source of claims
```

- All write into `hackathon/` at the target repo root (one folder, one plan file, no doc sprawl).
- All `disable-model-invocation: true`: run by typing `/ccs:<name>`. Multi-step, write files, cost no context until typed. Plain words ("make the pitch") won't trigger them; that's the trade.
- All take `lang: uk`, carry the shared `## Writing` and `## Report` blocks.
- Skills don't call each other (undocumented); each reads the previous one's files and names the next command.
- Stay in `ccs`: one install, one `/ccs:learn` loop over all reports. User-invoked skills add no listing cost.

### `/ccs:brief [brief file or URL]` — hour 0, before code

The idea decides most of the result, so the first hour is an idea engine. The user picks; the skill widens and stress-tests.

1. **Inputs**: organisers' brief, rubric, sponsors, judges, past winners (web).
2. **Your ideas first** (~15 min): questions that pull out the user's and teammate's domain knowledge. Domain experts won Built with Opus 4.6/4.7.
3. **Craft second brain**: search Craft for past ideas, projects and domains that fit the theme.
4. **LLM ideas**: a few bold extras, labelled as such.
5. **Judge panel**: the LLM plays the real judges and sponsors, scores every idea on rubric fit · wow · feasibility in the time · sponsor fit · domain edge, plus the one-sentence test.
6. **Pick + plan**: user chooses; skill writes `hackathon/plan.md`:

| Section | Content |
|---|---|
| Rubric | Criteria with weights; asks for them if not published. |
| Ideas | Score table from step 5, the pick and why. |
| Criterion → proof | Each criterion → the demo moment that will prove it. Every feature names its criterion. |
| The sentence | "X for Y that Z", repeatable by a judge an hour later. |
| Demo script v0 | 90 s: one user, one path, one wow by 0:60. Written before code. |
| Replay | Every external call (LLM, APIs) that needs record/replay; specced now, built by `/ccs:implement`. |
| Timeline | Freeze at 75% of time, cut order, "can we demo now?" checkpoints every ~4 h, video start time. |
| Anti-drift | Lines for the repo's `CLAUDE.md`: no stack change after hour 2, no new feature after freeze, no rename. |

### `/ccs:pitch [format: live 3m | video 3m | 5m]` — after freeze

1. **Audit** → `hackathon/facts.md`: at `<sha>`, *can claim* (number + command or file that proves it) · *mocked/replayed* · *must not claim*. Checked in code, not docs.
2. **Proof map**: refresh `plan.md` criterion → proof with demo timestamps; empty proof = gap, printed.
3. **Script** → `hackathon/script.md`, spoken, word budget per section (≈130 wpm EN; UK timed):
   `0:00 what + for whom (no team intro) · 0:15 one user's pain, one number · 0:35 demo to the wow · 2:20 why trust it (one line, not the stack) · 2:45 the sentence, stop.` 5 min stretches the demo, not the setup.
4. **Cut pass**: ≤ 5 numbers, all from `facts.md`; one named weakness said before it's asked; a "built during the event" line; cut lines go to Q&A, logged.
5. **Q&A** → `hackathon/qa.md`: `question | H/M/L | answer ≤ 20 words | proof | bridge`, pre-filled for real/mocked, user, business (bottom-up), AI failure/cost/injection, scale, competitor, next 2 weeks. Unknown → "don't know yet, here's how we'd measure", never a made-up number.
6. **Rehearsal sheet**: 3 timed runs out loud, cut what stumbled, cold read to a stranger who must say back what and for whom.
7. **Submission text** → `hackathon/submission.md`: Devpost/README copy, one section per sponsor prize, live link, video link.

Gate (checked by the skill before it ends): under time, opens with what it is, wow ≤ 2:00, every number in `facts.md`, ends on the sentence.

### `/ccs:demo [scene hint]` — at freeze, before pitch

1. **Scenario** → `hackathon/demo.md`: prep (start, reset, window, theme, prod build), scene table (# · time · action · visible · takeaway · caption), the 1–2 moments that must stick. Wow ≤ 0:15 into the demo video.
2. **Replay check**: every external call has a replay flag and a reset. Missing → gap + `/ccs:implement` suggestion. Shot in replay → auto "replay of a live run" chip; never claim live.
3. **Preflight + dry run** → `hackathon/demo-readiness.md`: health, keys, quota/rate limits, every scene's locators; PASS/FAIL per step.
4. **Record** with the bundled engine (`${CLAUDE_SKILL_DIR}/recorder/`, copied to `demo/`); Claude writes only `scenario.ts` (scenes + captions); selectors from a live snapshot.
5. **Outputs**: 16:9 mp4 (≤ 10% under the limit, default 120 s), 9:16 cut, gif, poster, srt, and a 60 s backup of the core flow.

Recorder engine = codefest `demo/`, upgraded:

| Change | Why |
|---|---|
| Engine split from `scenario.ts` (`scenes[]: {name, run, caption, expect}`) | Reusable across hackathons. |
| `--check` preflight of all locators + API | Stale selectors killed a whole 3,844-frame run. |
| Per-scene frames, retry a scene N times | One failure no longer restarts everything. |
| Zoom in post (click/spotlight rects → ffmpeg crop+scale, eased) | DOM-transform zoom is baked in and shifts fixed elements. |
| Captions per scene set hold time (≈ 3 words/s); srt from captions; optional music bed | No voiceover by choice; captions carry the story. |
| Lint: first wow > 0:15, caption > 8 words → warn | Judges stop watching. |

Manual path (voice/mobile, real mic, phone mirroring): Screen Studio or Cap; the skill writes the shot list and checks the result's length and wow time.

### `/ccs:deck` — builds the whole deck

Reads `hackathon/{plan,facts,script}.md`, screenshots, demo video, and `docs/guides/deck-design.md`.

**Structure** (7–9 slides; demo is the centre — hackathon rubrics weight it, unlike YC):
`1 name + promise · 2 one user's problem · 3 the idea · 4 product (cropped screenshot, ≤ 3 callouts) · 5 demo video full-bleed, local, poster + live fallback · 6–7 one wow proof per slide (big number + takeaway caption) · 8 how it's built (diagram, "LLM proposes, code verifies") · 9 the sentence + QR.`
Slides support the script, never repeat it. ≤ 30 words, ≤ 3 bullets, ≥ 24 px at 1920×1080.

**Build**: hand-written HTML/CSS on a fixed 1920×1080 canvas, reveal.js only as runtime (scaling, speaker notes from `script.md`, offline). Design tokens as CSS variables from the design guide; fonts and video local. Export PDF + per-slide PNG via Playwright; PPTX (image per slide + notes) only on request.

**QA loop** (≤ 3 rounds per slide), bundled script:
1. Render each slide to PNG.
2. DOM checks fail the build: overflow, outside 64 px safe area, font < 24 px, > 30 words, brand font not loaded, upscaled/broken image, missing video, colour not a token; axe contrast 0 violations.
3. Claude reads a contact sheet + each slide at 960×540 (projector proxy): one idea, readable in 5 s, every number in `facts.md`.
4. Fix only failing slides; PDF page count = slide count; timing from notes word count.

What QA cannot check: whether it persuades, and how the venue projector renders it. Rehearse on the real screen.

### Design guide

`docs/guides/deck-design.md`: the house deck system (tokens, type, slide layouts, video frame, diagram style), shared by deck and demo title/end cards.

- **Base: Panlytics** (`~/panlytics-design/`): light paper, near-black ink, one cobalt accent, big serif headlines, hairline grid. Light + high contrast reads on any projector; a calm frame lets screenshots and the demo carry the colour.
- **Screenshot and video slides: cooldock** (`~/cooldock-design/`): device frames, soft glow behind the product.
- Free font substitutes; Panlytics/cooldock fonts, art and logos are reference only.
- Both specs also stay as product/landing references, linked from `docs/guides/`.

### Also

- `docs/guides/hackathon.md`: checklist only — submission items, links public, video length, commit timestamps before deadline (codefest had post-deadline commits), backup video on desktop + USB, DND on, rehearse on venue screen.

### Repo changes

```
skills/brief/SKILL.md
skills/pitch/SKILL.md
skills/demo/SKILL.md
skills/demo/recorder/{package.json,record.ts,render.ts,lib/*.ts,scenario.example.ts}
skills/deck/SKILL.md
skills/deck/{template/index.html,template/deck.css,qa.ts}
docs/guides/deck-design.md
docs/guides/hackathon.md
README.md                     # skills table + hackathon flow
.claude-plugin/plugin.json    # version bump, keywords: hackathon, pitch, demo, deck
```

## Acceptance criteria

- [ ] `/ccs:brief` on the codefest brief writes `plan.md` with all 8 sections; every criterion has a planned proof moment; freeze time = 75% of the event.
- [ ] `/ccs:pitch` on codefest: `script.md` first line says what Resolly is (no team intro); ≤ 5 numbers, each found in `facts.md`; 38-customer wow before 2:00; `qa.md` has ≥ 12 questions incl. "what's mocked" answered from `decisions.md`.
- [ ] `/ccs:demo` on codefest names `VERDICT_REPLAY` and flags that it's scripted, not recorded; on a repo without replay it prints the gap and writes no product code.
- [ ] Recorder: `grep -ri 'resolly\|verdict'` in `skills/demo/recorder` is empty; `--check` fails fast on a broken selector; a sample scenario renders mp4 + srt + gif; zoom happens in render, not in the DOM.
- [ ] `/ccs:deck` on codefest: ≤ 9 slides; QA script exits 0; PDF pages = slides; every image path exists; all colours are design tokens.
- [ ] Each skill writes a report to `.ccs/reports/<skill>/`.
- [ ] README lists the four skills and the flow; `plugin.json` bumped.

Checks can't judge whether the pitch persuades; the next hackathon judges that, fed back via `/ccs:learn`.

## Decisions

- Deck base: Panlytics; cooldock only for screenshot/video framing.
- No voiceover: captions only.
- Clipwise: skipped; upgrade our own recorder.
- `/ccs:brief` reads the Craft second brain.
