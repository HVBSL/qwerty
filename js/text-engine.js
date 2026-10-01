/*
 * text-engine.js
 * -----------------------------------------------------------------------------
 * Headline + footer wordmark proximity effect.
 *
 * Fixes implemented here:
 *   Fix 1 - No DOM reads during pointer movement. Letter centres are measured
 *           once (after fonts load, on debounced resize, and on first visibility)
 *           and cached in DOCUMENT coordinates. The pointer listener only stores
 *           x/y; all work happens in the single master-loop tick.
 *   Fix 2 - Text is split ONCE into word wrappers + letter wrappers. Each .char
 *           has a FIXED width equal to that letter's width at wght 900, so a
 *           letter changing weight can never move its neighbours.
 *   Fix 3 - Every letter gets a FIXED, seeded random angle and a FIXED theme
 *           colour at split time. Proximity strength only scales them.
 *   Fix 4 - The footer wordmark uses this same engine instead of a CSS :hover
 *           rule, which used to flicker (weight 100 made the glyph narrower, the
 *           pointer left the letter, it snapped back and neighbours shifted).
 */
(function (global) {
  'use strict';

  var THEME_COLORS = ['#ff2fd0', '#7a3cff', '#29e0e0', '#fbbf24', '#ffffff'];
  var RADIUS = 120;          // proximity radius in px (unchanged)
  var MAX_TILT = 14;         // degrees (unchanged)
  var MAX_LIFT = 14;         // px (unchanged)
  var MIN_WEIGHT = 100;
  var MAX_WEIGHT = 900;

  var SLEEP_EPSILON = 0.0006;   // strength below which a letter counts as settled
  var WRITE_EPSILON = 0.0015;   // only write styles when the value really moved
  var SETTLE_FRAMES = 3;        // consecutive idle frames before sleeping

  var reducedMotion = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var groups = [];       // { el, letters[], isWordmark, visible, measured }
  var loop = null;       // the master ticker, injected by main.js
  var pointer = { x: 0, y: 0, has: false };
  var running = false;
  var idleFrames = 0;
  var initialized = false;
  var lastTime = 0;

  /* ------------------------------------------------------------------ */
  /* Deterministic PRNG - angles/colours stable across reloads (Fix 3)  */
  /* ------------------------------------------------------------------ */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function findGroup(el) {
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].el === el) return groups[i];
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Splitting (Fix 2)                                                  */
  /* ------------------------------------------------------------------ */

  /** Split a headline into word wrappers holding fixed-width letter wrappers. */
  function splitHeadline(hl) {
    if (hl.dataset.proxSplit === '1') return;

    var text = (hl.innerText || hl.textContent || '').trim();
    hl.dataset.proxSplit = '1';
    if (!text) return;

    // Keep the original text available to assistive tech.
    hl.setAttribute('aria-label', text);

    var frag = document.createDocumentFragment();
    var seeded = mulberry32(hashString(text));
    var words = text.split(/(\s+)/);

    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (word === '') continue;

      // Whitespace runs stay as text nodes so spacing is preserved without
      // creating animatable boxes.
      if (/^\s+$/.test(word)) {
        frag.appendChild(document.createTextNode(word));
        continue;
      }

      var wordEl = document.createElement('span');
      wordEl.className = 'word';
      wordEl.setAttribute('aria-hidden', 'true');

      // Iterate by code point so multi-byte characters stay intact.
      var chars = Array.from(word);
      for (var i = 0; i < chars.length; i++) {
        var charEl = document.createElement('span');
        charEl.className = 'char';
        charEl.setAttribute('aria-hidden', 'true');

        var glyphEl = document.createElement('span');
        glyphEl.className = 'glyph';
        glyphEl.textContent = chars[i];

        charEl.appendChild(glyphEl);
        wordEl.appendChild(charEl);
        addLetter(hl, charEl, glyphEl, seeded, i, false);
      }

      frag.appendChild(wordEl);
    }

    hl.textContent = '';
    hl.appendChild(frag);
  }

  /** Split the footer wordmark row into the same .char/.glyph structure. */
  function splitWordmark() {
    var root = document.getElementById('giantWordmark');
    if (!root || root.dataset.proxSplit === '1') return;

    var spans = Array.prototype.slice.call(root.querySelectorAll('.wordmark-char'));
    if (!spans.length) return;

    root.dataset.proxSplit = '1';
    // Preserve the accessible name of the row.
    root.setAttribute('aria-label', spans.map(function (s) {
      return s.textContent.trim();
    }).join(''));

    var seeded = mulberry32(hashString('giant-wordmark'));
    var frag = document.createDocumentFragment();
    var built = [];

    spans.forEach(function (span, idx) {
      var charEl = document.createElement('span');
      charEl.className = 'char';
      charEl.setAttribute('aria-hidden', 'true');
      // Keep author-supplied utility classes (e.g. opacity-40 on the ".").
      var extra = span.className.replace(/\bwordmark-char\b/g, '').trim();
      if (extra) charEl.className += ' ' + extra;

      var glyphEl = document.createElement('span');
      glyphEl.className = 'glyph';
      glyphEl.textContent = span.textContent;
      // Odd letters cyan, even magenta - matches the original nth-child rule.
      glyphEl.setAttribute('data-stroke', (idx + 1) % 2 === 1 ? 'cyan' : 'magenta');

      charEl.appendChild(glyphEl);
      frag.appendChild(charEl);
      built.push({ charEl: charEl, glyphEl: glyphEl, idx: idx });
    });

    root.textContent = '';
    root.appendChild(frag);

    built.forEach(function (l) {
      addLetter(root, l.charEl, l.glyphEl, seeded, l.idx, true);
    });
  }

  /** Register a letter and assign its FIXED randomness once (Fix 3). */
  function addLetter(owner, charEl, glyphEl, seeded, idx, isWordmark) {
    var group = findGroup(owner);
    if (!group) {
      group = { el: owner, letters: [], isWordmark: !!isWordmark, visible: true, measured: false };
      groups.push(group);
    }

    group.letters.push({
      charEl: charEl,
      glyphEl: glyphEl,
      // Fixed angle in [-14, +14] degrees; strength only scales it.
      angle: (seeded() * 2 - 1) * MAX_TILT,
      // Fixed theme colour; strength only reveals it.
      color: isWordmark
        ? null
        : THEME_COLORS[Math.floor(seeded() * THEME_COLORS.length) % THEME_COLORS.length],
      cx: 0,
      cy: 0,
      strength: 0,
      written: -1,
      idx: idx
    });
  }

  /* ------------------------------------------------------------------ */
  /* Measurement (Fix 1) - the only place that reads layout             */
  /* ------------------------------------------------------------------ */

  /**
   * Measure each letter's centre once and cache it in DOCUMENT coordinates,
   * so scrolling never invalidates the cache and no read is needed per frame.
   *
   * Widths are (re)locked on EVERY call, not just the first one. Headline sizes
   * are viewport-relative (`text-[19vw]`, `md:text-9xl`, ...), so a width locked
   * at one viewport width is wrong at any other. This runs at most once per
   * debounced resize and never per frame, so the write-then-read cost is fine -
   * and doing all writes before all reads keeps it to one forced reflow.
   */
  function measure() {
    var scrollX = global.scrollX || global.pageXOffset || 0;
    var scrollY = global.scrollY || global.pageYOffset || 0;

    // PASS 1 (write only): drop the previous width lock and any in-flight paint
    // so the upcoming read sees the true intrinsic advance at wght 900 for the
    // CURRENT viewport size. Resetting strength/written keeps the engine from
    // believing a style it no longer owns is still on the element.
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      for (var i = 0; i < grp.letters.length; i++) {
        var L = grp.letters[i];
        L.charEl.style.width = '';
        L.glyphEl.style.fontVariationSettings = '';
        L.glyphEl.style.fontWeight = '';
        L.strength = 0;
        L.written = -1;
      }
    }

    // PASS 2 (read only): a single forced layout for the whole batch.
    for (var g2 = 0; g2 < groups.length; g2++) {
      var group = groups[g2];
      for (var j = 0; j < group.letters.length; j++) {
        var letter = group.letters[j];
        var rect = letter.charEl.getBoundingClientRect();

        // Lock the width to this letter's width at wght 900 (Fix 2).
        letter.charEl.style.width = rect.width.toFixed(2) + 'px';

        letter.cx = rect.left + rect.width / 2 + scrollX;
        letter.cy = rect.top + rect.height / 2 + scrollY;
      }
      group.measured = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Painting                                                            */
  /* ------------------------------------------------------------------ */

  function paintHeadline(letter, strength) {
    var glyph = letter.glyphEl;
    var weight = Math.round(MAX_WEIGHT - strength * (MAX_WEIGHT - MIN_WEIGHT));

    glyph.style.fontVariationSettings = "'wght' " + weight;
    glyph.style.fontWeight = String(weight);
    // Fixed per-letter angle scaled by strength (Fix 3).
    glyph.style.transform =
      'translateY(' + (-MAX_LIFT * strength).toFixed(2) + 'px) rotate(' +
      (letter.angle * strength).toFixed(2) + 'deg)';
    glyph.style.color = strength > 0.0001 ? letter.color : '';
  }

  function paintWordmark(letter, strength) {
    var glyph = letter.glyphEl;

    if (strength <= 0.0001) {
      glyph.style.fontVariationSettings = "'wght' " + MAX_WEIGHT;
      glyph.style.fontWeight = String(MAX_WEIGHT);
      glyph.style.transform = 'translateY(0px) scale(1)';
      glyph.style.color = '';
      glyph.style.webkitTextStroke = '';
      glyph.style.textShadow = '';
      return;
    }

    var weight = Math.round(MAX_WEIGHT - strength * (MAX_WEIGHT - MIN_WEIGHT));
    var magenta = glyph.getAttribute('data-stroke') === 'magenta';
    var strokeColor = magenta ? '#ff2fd0' : '#29e0e0';
    var glowRGB = magenta ? '255, 47, 208' : '41, 224, 224';

    glyph.style.fontVariationSettings = "'wght' " + weight;
    glyph.style.fontWeight = String(weight);
    glyph.style.color = 'transparent';
    // Exactly the look of the original :hover rule, driven by strength.
    glyph.style.webkitTextStroke = '1.5px ' + strokeColor;
    // Only the currently active letters get the glow.
    glyph.style.textShadow = '0 0 ' + (25 * strength).toFixed(2) + 'px rgba(' +
      glowRGB + ', ' + (0.5 * strength).toFixed(3) + ')';
    glyph.style.transform =
      'translateY(' + (-8 * strength).toFixed(2) + 'px) scale(' +
      (1 + 0.05 * strength).toFixed(4) + ')';
  }

  /** Frame-rate independent smoothing toward the target strength. */
  function smoothTowards(current, target, dt) {
    // Matches the original ~0.18s ease-out feel.
    var k = 1 - Math.exp(-dt / 60);
    return current + (target - current) * k;
  }

  /* ------------------------------------------------------------------ */
  /* The single tick (driven by the master loop)                        */
  /* ------------------------------------------------------------------ */

  /**
   * `time` comes from the GSAP ticker in SECONDS, so the delta must be scaled to
   * milliseconds before it is used as a frame time. Treating the raw seconds
   * value as ms made every easing 1000x too slow: a letter faded asymptotically
   * (dt ~0.016 instead of ~16.7) and never reached SLEEP_EPSILON, so the engine
   * could never settle and never slept.
   */
  function tick(time) {
    if (!running) return;

    var nowMs = time * 1000;
    var dt = lastTime ? Math.min(nowMs - lastTime, 64) : 16.7;
    lastTime = nowMs;

    var scrollX = global.scrollX || global.pageXOffset || 0;
    var scrollY = global.scrollY || global.pageYOffset || 0;
    // Convert the pointer into document space (Fix 1).
    var px = pointer.x + scrollX;
    var py = pointer.y + scrollY;

    var anyActive = false;
    var settled = true;

    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      // Only process headlines currently in the viewport (Fix 1).
      if (!group.visible || !group.measured) continue;

      for (var i = 0; i < group.letters.length; i++) {
        var letter = group.letters[i];

        var target = 0;
        if (pointer.has) {
          var dx = px - letter.cx;
          var dy = py - letter.cy;
          // Cheap bounding reject first, then the exact radius test.
          if (dx > -RADIUS && dx < RADIUS && dy > -RADIUS && dy < RADIUS) {
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < RADIUS) target = 1 - dist / RADIUS;
          }
        }

        if (target > 0.0005) { anyActive = true; settled = false; }
        else if (letter.strength > SLEEP_EPSILON) settled = false;

        var next = smoothTowards(letter.strength, target, dt);
        if (next < SLEEP_EPSILON) next = 0;
        letter.strength = next;

        // Write ONLY when the value actually changed (Fix 1).
        if (Math.abs(letter.strength - letter.written) > WRITE_EPSILON) {
          if (group.isWordmark) paintWordmark(letter, letter.strength);
          else paintHeadline(letter, letter.strength);
          letter.written = letter.strength;
        }
      }
    }

    // Sleep once the pointer is idle and every letter has settled (Fix 1).
    if (!anyActive && settled) {
      idleFrames++;
      if (idleFrames >= SETTLE_FRAMES) stop();
    } else {
      idleFrames = 0;
    }
  }

  function clearStyles() {
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      for (var i = 0; i < group.letters.length; i++) {
        var letter = group.letters[i];
        var glyph = letter.glyphEl;
        letter.strength = 0;
        letter.written = -1;
        glyph.style.fontVariationSettings = '';
        glyph.style.fontWeight = '';
        glyph.style.transform = '';
        glyph.style.color = '';
        if (group.isWordmark) {
          glyph.style.webkitTextStroke = '';
          glyph.style.textShadow = '';
        }
      }
    }
  }

  function start() {
    if (running || reducedMotion.matches) return;
    running = true;
    idleFrames = 0;
    lastTime = 0;
    if (loop) loop.add(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    lastTime = 0;
    if (loop) loop.remove(tick);
    // Clear inline styles and drop will-change once asleep (Fix 1).
    clearStyles();
    var glyphs = document.querySelectorAll('.prox-headline .glyph, #giantWordmark .glyph');
    for (var i = 0; i < glyphs.length; i++) glyphs[i].style.willChange = '';
  }

  /* ------------------------------------------------------------------ */
  /* Events - the pointer listener only stores coordinates (Fix 1)      */
  /* ------------------------------------------------------------------ */

  function onPointerMove(e) {
    if (reducedMotion.matches) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.has = true;
    idleFrames = 0;
    start();
  }

  function onPointerLeave() {
    pointer.has = false;
    start();   // run the fade-out, then the tick sleeps on its own
  }

  function onTouchEnd() {
    // Fade out after release so touch users are not left with a lit headline.
    pointer.has = false;
    start();
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      // Re-measure (debounced) after a layout-affecting resize.
      measure();
      if (global.ScrollTrigger) global.ScrollTrigger.refresh();
    }, 160);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  function splitAll() {
    var headlines = document.querySelectorAll('.prox-headline');
    for (var i = 0; i < headlines.length; i++) splitHeadline(headlines[i]);
    splitWordmark();
  }

  function observeGroups() {
    if (!('IntersectionObserver' in global)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var group = findGroup(entry.target);
        if (!group) return;
        group.visible = entry.isIntersecting;
        // First time a headline becomes visible, (re)measure it (Fix 1).
        if (entry.isIntersecting && !group.measured) measure();
      });
    }, { rootMargin: '120px' });

    for (var i = 0; i < groups.length; i++) io.observe(groups[i].el);
  }

  function init() {
    if (initialized) return;   // idempotent: calling twice must not re-split (Fix 2)
    initialized = true;

    // Reduced motion: leave every letter at its natural CSS state.
    if (reducedMotion.matches) return;

    global.addEventListener('pointermove', onPointerMove, { passive: true });
    global.addEventListener('pointerleave', onPointerLeave, { passive: true });
    global.addEventListener('blur', onPointerLeave, { passive: true });
    global.addEventListener('touchend', onTouchEnd, { passive: true });
    global.addEventListener('touchcancel', onTouchEnd, { passive: true });
    global.addEventListener('resize', onResize, { passive: true });

    var doSplit = function () {
      splitAll();
      measure();
      // Splitting changed layout: refresh ScrollTrigger exactly once.
      if (global.ScrollTrigger) global.ScrollTrigger.refresh();
      observeGroups();
    };

    // Split only once, AFTER fonts are ready, so the measured wght 900 widths
    // are the real ones (Fix 2).
    if (document.fonts && document.fonts.ready &&
        typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(doSplit, doSplit);
    } else {
      doSplit();
    }
  }

  global.TextEngine = {
    init: init,
    // Hooks used by main.js (master loop) and by scripts/verify.mjs.
    tick: tick,
    measure: measure,
    splitAll: splitAll,
    start: start,
    stop: stop,
    isRunning: function () { return running; },
    getGroups: function () { return groups; },
    setLoop: function (fn) { loop = fn; },
    isReducedMotion: function () { return reducedMotion.matches; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
