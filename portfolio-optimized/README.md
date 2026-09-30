# Portfolio Optimization

This directory contains the highly optimized version of the original "Balaji S | Freelance Full-Stack Developer" portfolio, focused on fixing rendering performance and layout thrashing without changing the visual or interactive design.

## What Changed & Why

*   **Fix 1 & 2 & 3 & 4: Text Animation Engine**
    *   *Problem:* The headline and footer proximity effects were running `getBoundingClientRect` on every letter during every `mousemove` event and modifying styles, causing extreme layout thrashing and jitter. Font weights changing also affected character widths, shifting neighbors. Random colors/tilts re-rolled on every move.
    *   *Solution:*
        *   Extracted the logic to `js/text-engine.js`.
        *   Text is now split exactly once after fonts load into `.char` (fixed width) and `.glyph` (animated) spans, preventing layout shifts entirely.
        *   Pointer tracking is passive and simply updates a target X/Y.
        *   A single `requestAnimationFrame` tick smoothly lerps the letters. When the pointer is idle, the tick sleeps.
        *   Colors and random tilt angles are seeded and deterministic.
        *   The footer wordmark uses the exact same efficient engine instead of expensive CSS `:hover` selectors.
*   **Fix 5: 3D Scene Management**
    *   *Problem:* Three independent `requestAnimationFrame` loops were running infinitely, even when off-screen.
    *   *Solution:* Consolidated rendering for the Hero Sphere, Tech Orbit, and Contact Cube into a single master `gsap.ticker` loop. Scenes now use `IntersectionObserver` to pause rendering when out of viewport.
*   **Fix 6: Scroll and UI Optimizations**
    *   *Problem:* Scroll events triggered excessive layout writes and janky CSS animation duration changes (Marquee).
    *   *Solution:* Tied all scroll updates (progress bar, sticky nav threshold) directly into the optimized Lenis scroll callback. Changed the progress bar to use `transform: scaleX` instead of `width`. Adjusted the Marquee speed using the Web Animations API `playbackRate` for seamless speed transitions.
*   **Fix 7: Precompiled Tailwind CSS**
    *   *Problem:* The original site used the Tailwind CDN, which parsed and injected CSS at runtime, causing flashes and unnecessary work.
    *   *Solution:* Configured a local `tailwind.config.js` and pre-compiled all required styles into `css/tailwind.css`.

## Verification Results
Running the verification script (`node scripts/verify.mjs`) simulates a pointer sweep across the screen while instrumenting the browser.

*   **Layout Reads (getBoundingClientRect) during pointer sweep:** 0 calls. (Down from thousands per second in the original).

## How to Run
Since this is a static site, you can simply open `index.html` in a modern browser, or run a local HTTP server:
\`\`\`bash
npx serve .
\`\`\`

To run the Playwright verification script:
\`\`\`bash
npm install
node scripts/verify.mjs
\`\`\`
