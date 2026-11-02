# Deck design

The house design for `/ccs:deck` and demo title/end cards. Source of truth: the tokens in
[`skills/deck/template/deck.css`](../../skills/deck/template/deck.css); QA fails any colour not in them.

**Why this look:** light paper and near-black ink read on any projector; one accent keeps the
takeaway obvious; a calm frame lets the screenshots and the demo carry the colour.

## Sources

| | Used for | Spec |
|---|---|---|
| Panlytics (panlytics.net) | Base: paper, ink, cobalt, serif headlines, hairline grid, tight radii | `~/panlytics-design/DESIGN.md` |
| CoolDock (cooldock.app) | Only the device frame and soft glow around screenshots and video | `~/cooldock-design/DESIGN.md` |

Their fonts, art and logos are reference only. The deck ships free fonts (OFL), bundled for offline use.

## Tokens

| Role | Token | Value |
|---|---|---|
| Canvas | `--paper` | `#f9f8f6` |
| Card | `--surface` | `#ffffff` |
| Text | `--ink` / `--ink-2` / `--ink-3` | `#17171a` / `#45454e` / `#68686f` |
| Hairline | `--line` | `#dcdbd5` |
| Accent (one per slide) | `--accent` / `--accent-deep` | `#13359c` / `#0b1b66` |
| Device frame | `--frame` | `#000000` |
| Glow | `--glow` | cobalt at 20% |

## Type

| Use | Font | Size at 1920×1080 |
|---|---|---|
| Hero, headlines, big numbers | Instrument Serif (substitute for Panlytics' "nineties") | 176 / 112 / 400 px |
| Lede, body | Geist | 44 / 32 px |
| Kicker (`01 · THE PROBLEM`) | Geist Mono, uppercase, tracked | 24 px |

Floor: 24 px. One italic accent phrase per headline at most, in `--accent`.

## Layouts

`title` · `problem` · `idea` (before/after cards) · `product` (device frame + ≤ 3 numbered callouts)
· `demo` (full-bleed `--accent-deep`, video + poster) · `proof` (one big number + caption) ·
`built` (4-box flow, the verify step in ink) · `close` (the sentence + QR).

## Rules

- 1920×1080, 64 px safe area, hairline rules at its edges.
- ≤ 30 words, ≤ 3 bullets per slide. Drop a slide before shrinking text.
- Screenshots: crop to the part that proves the point, then frame. Never shrink a full page.
- Radii 6–8 px on cards; 28 px only on the device frame.
- No gradients except the frame glow. No icons for decoration.
