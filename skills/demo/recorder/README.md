# Demo recorder

Records a scripted browser run and renders a captioned, zoomed, speed-ramped demo video. No voiceover.

```sh
cp -R recorder demo && cd demo && npm install && npx playwright install chromium
cp scenario.example.ts scenario.ts   # write scenes + captions; selectors from a live snapshot
npm run check    # preflight: health + every scene's `expect` selectors + dry run; exits 1 naming the first broken scene
npm run record   # frames/<scene>/ per scene, failed scenes retried
npm run render   # out/demo.mp4, demo-vertical.mp4, demo.gif, poster.png, demo.srt
npm test
```

Scene: `{ name, run(d), caption?, expect?, wow? }`. Start each scene with `d.goto(...)` so a retry can replay it.
Director: `goto, click, type, hover, scroll, spotlight, fast(on), pause`, plus `d.page` for Playwright.
`spotlight` and `click` log focus marks; render turns them into eased crops (zoom never touches the DOM).
`fast(true)` … `fast(false)` wraps waits; render speeds them up until the video fits `MAX_S`.

| Env | Default | Effect |
|---|---|---|
| `BASE_URL` | `meta.url` | App to open |
| `HEALTH_URL` | none | Must return 2xx before check/record |
| `RETRIES` | 2 | Retries per failed scene |
| `HEADLESS` | 0 | 1 = headless (frames may drop to 1×) |
| `MAX_S` | `meta.maxSeconds` or 120 | Length budget |
| `REPLAY` | 0 | 1 = "Replay of a live run" chip on every frame |
| `PUBLIC_URL` | `meta.url` | URL on the end card |

Render warns when the first `wow` scene starts after 0:15 or a caption is over 8 words.
Needs `ffmpeg` and `ffprobe` on PATH (no drawtext needed).
