# Portfolio (Optimized Static Build)

A drop-in recreation of the original single-file portfolio
(**"Balaji S | Freelance Full-Stack Developer"**) that removes the re-rendering,
layout thrashing, flicker and jitter from its animations **without changing a
single word, section, ID, class, colour, font or interaction**.

Plain static site: open `index.html`, or deploy this folder to Vercel. No
framework, no build step required at runtime, no new libraries.

```
portfolio-optimized/
├── index.html            same markup/content as the original (inline CSS/JS moved out)
├── css/tailwind.css      precompiled Tailwind (Fix 7)
├── css/custom.css        original custom <style> rules, adjusted
├── js/main.js            init order + THE single master loop (Fix 5)
├── js/text-engine.js     headline + footer wordmark effect (Fixes 1-4)
├── js/scenes.js          hero sphere, tech orbit, contact cube (Fix 5)
├── js/ui.js              filters, modal, form, accordion, nav, marquee, clock, stats
├── scripts/compare.mjs    static parity check vs. the original
├── scripts/interaction.mjs  marquee / reduced-motion / sleep / progress-bar tests
├── scripts/verify.mjs    Playwright before/after verification
└── tailwind.config.js    exact original config, used only to rebuild tailwind.css
```

## Run it

```bash
open index.html            # macOS
xdg-open index.html        # Linux
npx serve .                # or serve it, the way it is deployed
```

## Rebuilding the CSS

`css/tailwind.css` is committed, so this is only needed if the markup changes:

```bash
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > /tmp/in.css
npx tailwindcss -c tailwind.config.js -i /tmp/in.css -o css/tailwind.css --minify
```

`content` scans `index.html` **and** `js/**/*.js`, so classes that only appear at
runtime (filter states, nav toggles, modal chips, selected service chips) are
included in the build.

## Verification

```bash
npm install                 # playwright + tailwind (already in the root package.json)
npx playwright install chromium

node portfolio-optimized/scripts/compare.mjs      # static parity vs. the original
node portfolio-optimized/scripts/interaction.mjs  # behaviour tests
node portfolio-optimized/scripts/verify.mjs       # before/after measurements
```

**`compare.mjs`** proves nothing was lost in the rewrite: the `<body>` markup is
byte-identical to the original, the visible text matches exactly, and every inline
handler used by the markup (`cycleSpherePalette`, `handleQuoteSubmit`, ...) is
defined in the shipped JS.

**`verify.mjs`** loads **both** the original site and this build at
375 / 768 / 1440 px, writes full-page screenshots to `scripts/screenshots/`, and
records layout shifts, `getBoundingClientRect` calls and frame times during a
pointer sweep across the hero headline, a section headline and the footer
wordmark. It also checks the idle state. Raw output is written to
`scripts/results.json`.

### Measured results

Per pointer sweep, at all three widths (identical workload: ~80 pointer events
crossing the target in both builds):

| Metric | Original | Optimized |
| --- | --- | --- |
| `getBoundingClientRect()` calls | 2,480 - 2,542 | **0** |
| Cumulative layout shift | up to **0.1516** | ≤ **0.0027** |
| Layout-shift entries per sweep | 14 - 43 | 0 - 19 |

The residual shift is not reflow. Letter widths are locked, so changing a
letter's weight can never move its neighbours; what is left is the deliberate
`scale()`/`translateY()` of the hover effect, which LayoutShift reports because
it changes the painted rect. The original shifts **56x more** (0.1516 vs
0.0027), and that difference is the whole point: its shifts come from glyphs
reflowing and dragging neighbours, which is what caused the visible jitter.

Idle, with the pointer parked and all three 3D scenes off screen, the text engine
reports `isRunning() === false` and detaches from the master ticker, so no
per-frame work continues.

One caveat the verifier now reports explicitly: at 1440 px the contact cube is
still within the viewport when the page is scrolled to the very bottom, so it
keeps rendering and the "all scenes off screen" flag is `false` there. That is
the gating working correctly - a scene that is genuinely visible is entitled to
render - not a leak. The 375 px and 768 px runs do park with all three gated
off.

Two notes on how these numbers are obtained, because both are easy to get wrong:

- The verifier scrolls through Lenis when it is running and drives the real
  scrolling element otherwise. The original sets `body { overflow-x: hidden }`,
  which makes BODY the scroller, so a plain `window.scrollTo()` is a silent
  no-op. Tailwind also puts `scroll-behavior: smooth` on `<html>`, so a scroll
  has to be waited out rather than assumed to have landed.
- These measurements were taken in a headless container where GSAP, ScrollTrigger
  and Three.js load but **Lenis is blocked at the CDN** (`ERR_BLOCKED_BY_ORB`).
  The optimized build therefore exercises its no-Lenis fallback path here. A
  3D/WebGL scene also runs on software rendering there, so its frame times are
  not representative of real hardware.

## What changed and why

### Fix 1 - No layout reads during pointer movement
*Before:* every `mousemove`/`touchmove` looped over every letter of every
`.prox-headline`, called `getBoundingClientRect()` on each, and wrote styles in
the same loop - including for off-screen headlines and letters outside the radius.

*Now:* each letter's centre is measured **once** (after `document.fonts.ready`, on
a debounced resize, and when a headline first becomes visible) and cached in
**document** coordinates. The pointer listener only stores `x`/`y` and is
`passive`. All work happens in one tick driven by the master loop, which skips
headlines that are not in the viewport (IntersectionObserver) and rejects letters
outside the 120 px radius with a cheap bounding test before the exact distance
check. Letters are smoothed toward their target and styles are written **only**
when a value moved by more than an epsilon. When the pointer goes idle and every
letter has settled, the tick detaches and inline styles + `will-change` are cleared.

### Fix 2 - Fixed-width letters, so weight changes can never shift anything
*Before:* a letter's weight change changed its advance width, so neighbours moved
and the line re-flowed on every pointer move.

*Now:* text is split **once**, after fonts load, into word wrappers
(`.word`, `inline-block`, `white-space: nowrap`) containing letter wrappers.
Each `.char` has a **fixed width** locked to that letter's width at `wght 900`;
the inner `.glyph` receives the weight/transform/colour changes and is centred
with `overflow: visible`. Because the outer width never changes, nothing around it
can move. `ScrollTrigger.refresh()` is called exactly once after the split, and
`TextEngine.init()` is idempotent.

### Fix 3 - Stable per-letter randomness
*Before:* `rotation = sin(letterCenterX + pointerX)` and `color = letterCenterX % 5`
re-rolled on every pixel of movement and on every layout shift.

*Now:* every letter is assigned a **fixed** random angle in [-14°, +14°] and a
**fixed** theme colour at split time, from a seeded PRNG, so values are stable
across reloads. Proximity strength only scales them; nothing is ever re-rolled.

### Fix 4 - The footer wordmark uses the engine, not `:hover`
*Before:* `.wordmark-char:hover` with `transition: all` switched the weight to
100, which made the letter narrower, so the pointer left it, it snapped back, and
it flickered - and because the row is `justify-between`, the neighbours shifted too.

*Now:* the wordmark is rebuilt with the same fixed-width `.char`/`.glyph`
structure and driven by the same proximity engine. It keeps the exact original
look - thin weight, transparent fill with a 1.5 px stroke (cyan on odd letters,
magenta on even), `translateY(-8px) scale(1.05)` and the soft glow - with
`text-shadow` applied only to the currently active letters. The `·` keeps
`opacity: 0.4` and the row layout is unchanged. `transition: all` is gone.

### Fix 5 - One master loop instead of four
*Before:* Lenis, the hero sphere, the tech orbit and the contact cube each ran
their own endless `requestAnimationFrame` loop, even when off screen, and
ScrollTrigger was not synced with Lenis.

*Now:* a single `gsap.ticker` (with `lagSmoothing(0)`) drives everything:
`lenis.raf(time * 1000)`, the text engine, and the 3D scenes, with
`lenis.on('scroll', ScrollTrigger.update)` keeping ScrollTrigger in sync. Each
scene registers an update function and renders **only** while its container is
intersecting the viewport and `document.hidden` is false. Geometry, shaders,
palettes and interactions are untouched, the pixel ratio is still capped at 2,
resizes are handled by a `ResizeObserver` that updates size and camera aspect
in place, and the cube's `setInterval` submit spin now advances inside the master
loop with the same 0.22 rad step and 4π target.

### Fix 6 - Scroll work batched and transform-only
*Before:* the window scroll handler wrote on every event - setting the progress
bar's `width`, toggling the nav class every time, and rewriting the marquee's
`animation-duration`, which made the running CSS animation visibly jump.

*Now:* scroll work runs from the Lenis callback (or one rAF-batched handler).
The progress bar uses `transform: scaleX()` with `transform-origin: left`. The
sticky nav class is only toggled when the 320 px threshold is crossed. The
marquee keeps **one constant** CSS animation and changes speed through the Web
Animations API (`getAnimations()[0].playbackRate`), easing up while scrolling
fast and back to normal after 300 ms - no duration changes, so no jump. The live
clock keeps the same `IST h:mm am/pm` format but is scheduled to the next minute
boundary and only writes when the text actually changed.

### Fix 7 - Tailwind compiled ahead of time
*Before:* `cdn.tailwindcss.com` ran in the browser and rescanned the DOM on every
change, causing flashes and repeated work.

*Now:* Tailwind is compiled into `css/tailwind.css` with the exact original
`tailwind.config` (same colours, `fontFamily`, `darkMode: 'class'` and the forms
and container-queries plugins). The CDN script is removed. The Google Fonts links
(same families and weights) and `class="dark scroll-smooth"` on `<html>` are kept.

### Also
- `prefers-reduced-motion` disables the letter effect, the curtain scrub and the
  marquee speed-up, and keeps all content fully visible.
- Headings use `touch-action: pan-y` and pointer events, so touch drags can drive
  the effect but never block vertical scrolling; the effect fades out on release.
- No new libraries, sections, copy, tracking or analytics were added.

The visual result is unchanged: weights 900 → 100, tilt up to 14°, lift up to
14 px, and the same five theme colours. The heading keeps an `aria-label` with
the original text and the split letters are `aria-hidden`, so spaces and
punctuation (e.g. the period in "DEVELOPER.") are preserved for screen readers.
