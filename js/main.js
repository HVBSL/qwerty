/*
 * main.js
 * -----------------------------------------------------------------------------
 * Init order and THE single master loop.
 *
 * Fix 5 - the original ran four independent endless requestAnimationFrame loops
 * (Lenis, hero sphere, tech orbit, contact cube) and ScrollTrigger was never
 * synced with Lenis. Here gsap.ticker is the only rAF driver:
 *
 *   gsap.ticker.lagSmoothing(0)      -> no time-warping stalls
 *   lenis.raf(time * 1000)           -> smooth scroll on the master clock
 *   Scenes.update(...)               -> only the visible, non-hidden canvases
 *   lenis.on('scroll', ScrollTrigger.update) -> ScrollTrigger stays in sync
 *
 * The text engine attaches/detaches its own tick from the same ticker so it can
 * sleep completely when the pointer is idle (Fix 1).
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var lenis = null;

  function initLenis() {
    if (!global.Lenis) {
      console.warn('Lenis init skipped');
      return null;
    }
    try {
      return new global.Lenis({
        duration: 1.2,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothTouch: false
      });
    } catch (e) {
      console.warn('Lenis init skipped', e);
      return null;
    }
  }

  function startMasterLoop() {
    if (!global.gsap) return;

    // Never let GSAP "correct" for long frames - we want honest timings.
    global.gsap.ticker.lagSmoothing(0);

    var elapsed = 0;
    var lastTime = null;

    global.gsap.ticker.add(function (time) {
      var dt = lastTime === null ? 16.7 : Math.min(time - lastTime, 64);
      lastTime = time;
      elapsed += dt / 1000;

      // Lenis on the master clock (gsap.ticker hands us seconds).
      if (lenis) lenis.raf(time * 1000);

      // 3D scenes: only the ones that are visible + tab visible.
      if (global.Scenes) global.Scenes.update(dt, elapsed);
    });

    // Scroll-driven work runs once per frame from the Lenis scroll callback,
    // instead of writing on every native scroll event (Fix 6).
    if (lenis) {
      lenis.on('scroll', function () {
        if (global.UI) global.UI.onScrollFrame();
        if (global.ScrollTrigger) global.ScrollTrigger.update();
      });
    } else {
      // Fallback (no Lenis): one rAF-batched handler, still not per-event.
      var pending = false;
      global.addEventListener('scroll', function () {
        if (pending) return;
        pending = true;
        global.requestAnimationFrame(function () {
          pending = false;
          if (global.UI) global.UI.onScrollFrame();
          if (global.ScrollTrigger) global.ScrollTrigger.update();
        });
      }, { passive: true });
    }

    // Initial paint of the progress bar / nav state.
    if (global.UI) global.UI.onScrollFrame();
  }

  function init() {
    lenis = initLenis();

    // Give the text engine the master ticker so it can sleep when idle (Fix 1).
    if (global.TextEngine && global.gsap) {
      global.TextEngine.setLoop(global.gsap.ticker);
    }

    // Init order: UI (filters/modal/form/GSAP) -> 3D scenes -> text engine.
    if (global.UI) global.UI.init();
    if (global.Scenes) global.Scenes.init();
    if (global.TextEngine) global.TextEngine.init();

    startMasterLoop();
  }

  global.MainApp = { init: init, getLenis: function () { return lenis; } };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
