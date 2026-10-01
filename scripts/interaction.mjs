import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

const URL = pathToFileURL(process.cwd() + '/portfolio-optimized/index.html').href;
let pass = 0;
let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const browser = await chromium.launch({ headless: true });

async function newPage(opts = {}) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForTimeout(2200);
  p.__errs = errs;
  return p;
}

// ---------------------------------------------------------------- marquee easing
console.log('\nMarquee playbackRate easing');
{
  const p = await newPage();
  const rate = () => p.evaluate(() => {
    const t = document.querySelector('.marquee-track');
    const a = t && t.getAnimations ? t.getAnimations()[0] : null;
    return a ? a.playbackRate : null;
  });
  const before = await rate();

  await p.evaluate(() => {
    const lenis = window.MainApp && window.MainApp.getLenis && window.MainApp.getLenis();
    if (lenis) lenis.scrollTo(1500, { immediate: true, force: true });
    else (document.scrollingElement || document.documentElement).scrollTop = 1500;
  });
  await p.waitForTimeout(500);
  const during = await rate();

  await p.waitForTimeout(1500);
  const after = await rate();

  ok(typeof before === 'number', `marquee animation exists (playbackRate=${before})`);
  ok(during > 2.5, `rate actually reaches ~3 while scrolling fast (got ${during})`);
  ok(Math.abs(after - 1) < 0.05, `rate eases back to 1 (got ${after})`);
  ok(p.__errs.length === 0, `no page errors (${p.__errs.join(' | ') || 'none'})`);
  await p.close();
}

// ---------------------------------------------------------------- reduced motion
console.log('\nprefers-reduced-motion: reduce');
{
  const p = await newPage({ reducedMotion: 'reduce' });
  const r = await p.evaluate(() => {
    const g = document.querySelector('.prox-headline .glyph');
    const t = document.querySelector('.marquee-track');
    const a = t && t.getAnimations ? t.getAnimations()[0] : null;
    return {
      split: !!document.querySelector('.prox-headline .char'),
      inlineOnGlyph: g ? g.getAttribute('style') : null,
      engineRunning: window.TextEngine ? window.TextEngine.isRunning() : null,
      marqueeState: a ? a.playState : null,
    };
  });
  ok(r.split === false, 'headlines are NOT split into per-letter boxes');
  ok(r.inlineOnGlyph === null, 'no inline styles written to glyphs');
  ok(r.engineRunning === false, `text engine not running (${r.engineRunning})`);
  ok(r.marqueeState !== 'running', `marquee animation not running (${r.marqueeState})`);
  ok(p.__errs.length === 0, `no page errors (${p.__errs.join(' | ') || 'none'})`);
  await p.close();
}


// ---------------------------------------------------------------- will-change sleep
console.log('\nwill-change released when the text engine sleeps');
{
  const p = await newPage();
  await p.mouse.move(700, 500);
  await p.mouse.move(400, 400, { steps: 20 });
  await p.waitForTimeout(200);
  const active = await p.evaluate(() => {
    const g = document.querySelector('.prox-headline .glyph');
    return { inline: g ? g.getAttribute('style') : null };
  });
  await p.mouse.move(5, 5);
  await p.waitForTimeout(2500);
  const asleep = await p.evaluate(() => {
    const g = document.querySelector('.prox-headline .glyph');
    return { inline: g ? g.getAttribute('style') : null, running: window.TextEngine.isRunning() };
  });
  ok(active.inline !== null, `glyph carries inline styles while animating (${(active.inline || '').slice(0, 40)})`);
  ok(asleep.running === false, `engine sleeps when idle (running=${asleep.running})`);
  const wc = asleep.inline ? (asleep.inline.match(/will-change/g) || []).length : 0;
  ok(wc === 0, `no leftover will-change on glyph once asleep (found ${wc})`);
  await p.close();
}

// ---------------------------------------------------------------- scroll progress
console.log('\nScroll progress bar renders and tracks');
{
  const p = await newPage();
  const r = await p.evaluate(async () => {
    const el = document.getElementById('scrollProgress');
    const se = document.scrollingElement || document.documentElement;
    const read = () => el.getBoundingClientRect().width;
    const atTop = read();
    const tTop = el.style.transform;
    se.scrollTo({ top: se.scrollHeight, behavior: 'instant' });
    await new Promise((res) => setTimeout(res, 800));
    return {
      widthStyle: getComputedStyle(el).width,
      inlineWidth: el.style.width,
      atTop, atBottom: read(),
      tTop, tBottom: el.style.transform,
    };
  });
  ok(r.widthStyle !== '0px', `computed width is not zero (${r.widthStyle})`);
  ok(r.atBottom > r.atTop, `bar grows with scroll (${r.atTop.toFixed(1)} -> ${r.atBottom.toFixed(1)})`);
  ok(/scaleX|matrix/.test(String(r.tBottom)), `progress applied via transform (${r.tBottom})`);
  ok(r.inlineWidth === '', `no inline width written, so no layout (${r.inlineWidth || 'empty'})`);
  ok(p.__errs.length === 0, `no page errors (${p.__errs.join(' | ') || 'none'})`);
  await p.close();
}

await browser.close();
console.log(`\n${fail === 0 ? 'ALL INTERACTION TESTS PASSED' : fail + ' FAILED'}, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
