/**
 * scripts/verify.mjs
 * -----------------------------------------------------------------------------
 * Verification harness for the optimized build.
 *
 * Run from the repository root:
 *     node portfolio-optimized/scripts/verify.mjs
 *
 * It loads BOTH the original single-file site and the new static build at
 * 375 / 768 / 1440 px and records:
 *
 *   1. Full-page screenshots for a visual before/after comparison.
 *   2. During a pointer sweep across the hero headline, a section headline and
 *      the footer wordmark:
 *        (a) layout-shift entries from a PerformanceObserver,
 *        (b) the number of Element.prototype.getBoundingClientRect calls,
 *        (c) long animation frames / frame times.
 *   3. The idle state: with the pointer still and the 3D scenes scrolled out of
 *      view, nothing should keep rendering.
 *
 * Results are printed as a table and written to scripts/results.json.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');            // portfolio-optimized/
const REPO_ROOT = path.resolve(SITE_DIR, '..');           // repository root
const SHOT_DIR = path.join(SITE_DIR, 'scripts', 'screenshots');

const WIDTHS = [375, 768, 1440];

/** Locate the original single-file site. */
function findOriginal() {
  const candidates = [
    path.join(REPO_ROOT, 'index (1).html'),
    path.join(REPO_ROOT, 'index.html'),
  ];
  try {
    for (const f of fs.readdirSync(REPO_ROOT)) {
      if (/^index.*\.html$/i.test(f)) candidates.push(path.join(REPO_ROOT, f));
    }
  } catch { /* ignore */ }

  for (const file of candidates) {
    try {
      const html = fs.readFileSync(file, 'utf8');
      if (html.includes('<title>Balaji S | Freelance Full-Stack Developer</title>')) return file;
    } catch { /* keep looking */ }
  }
  return null;
}

/**
 * Instrumentation installed before any page script runs.
 *  - counts getBoundingClientRect calls
 *  - counts pointermove events
 *  - observes layout-shift entries
 *  - observes long animation frames + a plain rAF frame counter
 */
const INSTRUMENT = () => {
  window.__m = { rect: 0, pointer: 0, shifts: [], frames: [], raf: 0 };

  const proto = Element.prototype;
  const orig = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (...args) {
    window.__m.rect++;
    return orig.apply(this, args);
  };

  window.addEventListener('pointermove', () => { window.__m.pointer++; }, { passive: true });
  window.addEventListener('mousemove', () => { window.__m.pointer++; }, { passive: true });

try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__m.shifts.push({
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* not supported */ }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__m.frames.push({
          duration: entry.duration,
          blockingDuration: entry.blockingDuration,
          isLoaf: true,
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { /* not supported */ }

  // Frame counter that works regardless of Long Animation Frame support.
  let last = performance.now();
  (function loop(t) {
    window.__m.raf++;
    window.__m.frames.push({ duration: t - last, blockingDuration: 0, isLoaf: false });
    last = t;
    requestAnimationFrame(loop);
  })(performance.now());
};

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

async function settle(page, ms = 1400) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
}

async function resetMetrics(page) {
  await page.evaluate(() => {
    window.__m.rect = 0;
    window.__m.pointer = 0;
    window.__m.shifts = [];
    window.__m.frames = [];
    window.__m.raf = 0;
  });
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const m = window.__m;
    const nonInput = m.shifts.filter((s) => !s.hadRecentInput);
    return {
      rectCalls: m.rect,
      pointerEvents: m.pointer,
      shiftEntries: m.shifts.length,
      shiftValue: +nonInput.reduce((a, s) => a + s.value, 0).toFixed(6),
      shiftWithInput: m.shifts.length - nonInput.length,
      rafFrames: m.raf,
longFrames: m.frames.filter((f) => f.duration > 50).length,
      maxFrameMs: +Math.max(0, ...m.frames.map((f) => f.duration)).toFixed(2),
      avgFrameMs: +(m.frames.reduce((a, f) => a + f.duration, 0) / (m.frames.length || 1)).toFixed(2),
    };
  });
}

/**
 * Scroll the page to an absolute Y, through Lenis when it is running.
 *
 * Two traps this helper exists to avoid:
 *
 * 1. Lenis owns the scroll when present, so a native jump is fought/undone on
 *    the next frame. `lenis.scrollTo(y, { immediate: true })` moves the real and
 *    the virtual position together.
 *
 * 2. `body { overflow-x: hidden }` (inherited from the original stylesheet)
 *    makes the computed `overflow-y` of BODY `auto`, so BODY - not the window -
 *    is the scrolling element. `window.scrollTo()` is then silently a no-op and
 *    `window.scrollY` stays 0. That is what made the first version of this
 *    helper fail to move the target into view at all. Detect the real scroller
 *    and drive whichever one is actually scrollable.
 */
async function scrollToY(page, y) {
  // Jump, then wait until the offset actually stops changing. Tailwind puts
  // `scroll-behavior: smooth` on the html element, so a bare scrollTop/scrollTo
  // assignment animates over several hundred ms - reading the box a couple of
  // frames later measures a position the page is still travelling through.
  await page.evaluate((targetY) => {
    const lenis = window.MainApp && window.MainApp.getLenis && window.MainApp.getLenis();
    const se = document.scrollingElement || document.documentElement;

    if (lenis) {
      lenis.scrollTo(targetY, { immediate: true, force: true });
      return;
    }
    // 'instant' overrides the stylesheet's smooth behaviour for this call.
    se.scrollTo({ top: targetY, behavior: 'instant' });
    se.scrollTop = targetY;
  }, y);

  // Poll until the offset settles (arrived, or stopped moving near the target).
  await page.evaluate(async (targetY) => {
    const se = document.scrollingElement || document.documentElement;
    const delta = () => Math.abs(se.scrollTop - targetY);
    let last = delta();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const now = delta();
      if (now === 0 || (now === last && i > 2)) return;   // arrived / settled
      last = now;
    }
  }, y);
}

/** Current absolute scroll offset, regardless of which element scrolls. */
async function getScrollY(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return window.scrollY || (el && el.scrollTop) || document.body.scrollTop || 0;
  });
}

/** Park the page at the very bottom (past every scene container). */
async function scrollToBottom(page) {
  await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    const maxY = el.scrollHeight - window.innerHeight;
    const lenis = window.MainApp && window.MainApp.getLenis && window.MainApp.getLenis();
    if (lenis) lenis.scrollTo(maxY, { immediate: true, force: true });
    else el.scrollTop = maxY;
  });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

/**
 * Park a selector in the middle of the viewport on the REAL scroll position.
 *
 * The returned `onScreen` flag is what makes the sweep trustworthy: a silent
 * no-op scroll (see the BODY scroller note above) must be reported as skipped
 * rather than measured as "0 pointer events".
 */
async function centerTarget(page, selector) {
  const m = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const se = document.scrollingElement || document.documentElement;
    const scrolled = window.scrollY || (se && se.scrollTop) || document.body.scrollTop || 0;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + scrolled,
      height: rect.height,
      maxScroll: se ? se.scrollHeight - window.innerHeight : 0,
    };
  }, selector);
  if (m === null) return { ok: false, reason: 'element not found' };

  const viewportH = page.viewportSize().height;
  // Ideal centre, clamped to the scrollable range. Near the document end the
  // page cannot scroll far enough to centre, and that is fine - the element
  // simply sits at the bottom of the viewport, which is still measurable.
  const desired = m.top - (viewportH - m.height) / 2;
  const clamped = Math.max(0, Math.min(desired, m.maxScroll));

  await scrollToY(page, clamped);

  const box = await page.locator(selector).first().boundingBox().catch(() => null);
  if (!box) return { ok: false, reason: 'no bounding box' };

  const onScreen = box.y + box.height > 0 && box.y < viewportH;
  return { ok: onScreen, reason: onScreen ? null : 'target not on screen after scroll' };
}

async function sweepOver(page, selector, label) {
  // Centre the target FIRST, then re-read its box. Without this the services
  // and footer sweeps run with off-screen viewport coordinates and the pointer
  // never actually crosses the text. `centerTarget` reports a scroll that did
  // not take effect, so a broken position is surfaced instead of silently
  // measuring "0 pointer events".
  const placement = await centerTarget(page, selector);
  if (!placement.ok) return { label, skipped: placement.reason };

  const el = page.locator(selector).first();
  const box = await el.boundingBox();
  if (!box) return { label, skipped: 'no bounding box' };

  await resetMetrics(page);

  const y = box.y + box.height / 2;
  const startX = Math.max(2, box.x - 30);
  const endX = box.x + box.width + 30;

  await page.mouse.move(startX, y);
  await page.mouse.move(endX, y, { steps: 40 });
  await page.waitForTimeout(500);   // let the easing settle

  const m = await readMetrics(page);
  return {
    label,
    rectCalls: m.rectCalls,
    rectPerPointerEvent: m.pointerEvents ? +(m.rectCalls / m.pointerEvents).toFixed(2) : null,
    pointerEvents: m.pointerEvents,
    shiftEntries: m.shiftEntries,
    shiftValue: m.shiftValue,
    longFrames: m.longFrames,
    maxFrameMs: m.maxFrameMs,
    avgFrameMs: m.avgFrameMs,
  };
}

/**
 * Idle check: pointer still + 3D scenes scrolled out of view.
 *
 * The instrumentation's own rAF counter would always tick, so instead we detect
 * *page-initiated* loops: on the ORIGINAL, every scene keeps calling
 * requestAnimationFrame forever even when off screen; on the optimized build the
 * single master ticker stops doing scene work once nothing is visible.
 *
 * We patch requestAnimationFrame and count callbacks registered by page code
 * (i.e. excluding our own probe), then sample the delta over an idle window.
 */
async function idleCheck(page) {
  // Park at the very bottom so every scene container (hero sphere, tech orbit,
  // contact cube) is scrolled past and its IntersectionObserver has gated it
  // off. Scrolling to the TOP was wrong: that keeps the hero sphere on screen,
  // so it could never prove the scenes stopped rendering.
  await scrollToBottom(page);
  // Park the pointer off-target so nothing is animating when we start counting.
  await page.mouse.move(4, 4);
  await page.waitForTimeout(800);

  const res = await page.evaluate(async () => {
    // Count rAF callbacks scheduled by the page while we sit still.
    const origRaf = window.requestAnimationFrame;
    let pageLoops = 0;
    window.requestAnimationFrame = function (cb) {
      pageLoops++;
      return origRaf.call(window, cb);
    };

    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 1500));
    const elapsed = performance.now() - t0;
    window.requestAnimationFrame = origRaf;

    // Confirm the scene containers really are out of view, so "idle" is honest,
    // and name any that are not (a scene that is still on screen legitimately
    // keeps rendering, so the flag is reported rather than assumed).
    const containerIds = ['heroSphereContainer', 'techOrbitContainer', 'contactCubeContainer'];
    const visibility = containerIds.map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, present: false, offscreen: true };
      const r = el.getBoundingClientRect();
      return {
        id,
        present: true,
        offscreen: r.bottom <= 0 || r.top >= window.innerHeight,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
      };
    });
    const stillVisible = visibility.filter((v) => v.present && !v.offscreen).map((v) => v.id);

    return {
      rafRegisteredWhileIdle: pageLoops,
      // A continuously rendering page re-registers a loop every frame (~90/s).
      loopHz: +(pageLoops / (elapsed / 1000)).toFixed(1),
      textEngineRunning: window.TextEngine ? window.TextEngine.isRunning() : null,
      scenes: window.Scenes ? window.Scenes.registry.map((s) => s.visible) : null,
      allScenesOffscreen: stillVisible.length === 0,
      scenesStillVisible: stillVisible,
      sceneVisibility: visibility,
      canvases: document.querySelectorAll('canvas').length,
    };
  });

  return res;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function openSite(browser, file, width) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(INSTRUMENT);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await settle(page, 1600);
  return { page, errors };
}

function printSweeps(title, rows, key) {
  console.log('='.repeat(84));
  console.log(title);
  console.log('='.repeat(84));
  for (const [w, e] of Object.entries(rows)) {
    const sweeps = e[key];
    if (!sweeps) continue;
    console.log(`\n@ ${w}px`);
    for (const s of sweeps) {
      if (s.skipped) { console.log(`  ${s.label.padEnd(30)} skipped (${s.skipped})`); continue; }
      console.log(
        `  ${s.label.padEnd(24)} pointerEvt=${String(s.pointerEvents).padStart(4)}  ` +
        `rectCalls=${String(s.rectCalls).padStart(6)} ` +
        `(${String(s.rectPerPointerEvent ?? 'n/a').padStart(7)}/evt)  ` +
        `shiftEntries=${String(s.shiftEntries).padStart(3)} shift=${String(s.shiftValue).padStart(8)}  ` +
        `longFrames=${String(s.longFrames).padStart(3)} maxFrame=${s.maxFrameMs}ms`
      );
    }
    const idle = key === 'sweeps' ? e.idle : null;
    if (idle) {
      console.log(
        `  idle: ${idle.rafRegisteredWhileIdle} rAF registrations in 1.5s ` +
        `(${idle.loopHz}/s) | textEngineRunning=${idle.textEngineRunning} | ` +
        `sceneVisible=[${idle.scenes}] allOffscreen=${idle.allScenesOffscreen}` +
        (idle.scenesStillVisible && idle.scenesStillVisible.length
          ? ` (still on screen: ${idle.scenesStillVisible.join(', ')})`
          : '') +
        ` | canvases=${idle.canvases}`
      );
    }
  }
}

async function run() {
  const original = findOriginal();
  const optimized = path.join(SITE_DIR, 'index.html');

  fs.mkdirSync(SHOT_DIR, { recursive: true });

  console.log('Original site :', original || 'NOT FOUND');
  console.log('Optimized site:', optimized);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const report = {
    original,
    optimized,
    generatedAt: new Date().toISOString(),
    widths: {},
  };

  for (const width of WIDTHS) {
    const entry = { sweeps: [], originalSweeps: [] };

    // 1. screenshots for both sites
    if (original) {
      const { page, errors } = await openSite(browser, original, width);
      await page.screenshot({
        path: path.join(SHOT_DIR, `original_${width}.png`),
        fullPage: true,
      });
      entry.originalScreenshot = `scripts/screenshots/original_${width}.png`;
      entry.originalErrors = errors;
      await page.close();
    }

    const { page, errors } = await openSite(browser, optimized, width);
    await page.screenshot({
      path: path.join(SHOT_DIR, `optimized_${width}.png`),
      fullPage: true,
    });
    entry.optimizedScreenshot = `scripts/screenshots/optimized_${width}.png`;
    entry.errors = errors;

    // 2. measured sweeps on the optimized build
    entry.sweeps.push(await sweepOver(page, '#hero .prox-headline', 'hero headline'));
    entry.sweeps.push(await sweepOver(page, '#services .prox-headline', 'section headline'));
    entry.sweeps.push(await sweepOver(page, '#giantWordmark', 'footer wordmark'));

    // 3. idle state
    entry.idle = await idleCheck(page);
    await page.close();

    // baseline sweeps on the original
    if (original) {
      const { page: opage } = await openSite(browser, original, width);
      entry.originalSweeps.push(await sweepOver(opage, '#hero .prox-headline', 'hero headline'));
      entry.originalSweeps.push(await sweepOver(opage, '#services .prox-headline', 'section headline'));
      entry.originalSweeps.push(await sweepOver(opage, '#giantWordmark', 'footer wordmark'));
      await opage.close();
    }

    report.widths[width] = entry;
  }

  await browser.close();

  printSweeps('OPTIMIZED (after)', report.widths, 'sweeps');
  printSweeps('ORIGINAL (before, baseline)', report.widths, 'originalSweeps');

  const errs = Object.values(report.widths).flatMap((e) => e.errors || []);
  console.log('\nPage errors (optimized):', errs.length ? errs.join(' | ') : 'none');
  console.log('Screenshots ->', SHOT_DIR);

  fs.writeFileSync(
    path.join(SITE_DIR, 'scripts', 'results.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('Results     -> scripts/results.json');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
