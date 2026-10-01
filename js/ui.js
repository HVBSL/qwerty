/*
 * ui.js
 * -----------------------------------------------------------------------------
 * Everything that is not a 3D scene or the letter engine:
 * project data, filters, the project modal, the quote form, the accordion,
 * the sticky nav, the scroll progress bar, the marquee, the live clock and the
 * GSAP scroll animations.
 *
 * Fix 6 - the original window scroll handler wrote on EVERY scroll event: it set
 * the progress bar's `width` (forcing layout), toggled the nav class every time,
 * and rewrote the marquee's `animation-duration`, which made the running CSS
 * animation visibly jump. Here:
 *   - the progress bar uses `transform: scaleX()` with transform-origin: left
 *   - the sticky nav class is only toggled when the 320px threshold is crossed
 *   - the marquee keeps ONE constant CSS animation and is sped up through the
 *     Web Animations API via `playbackRate`, easing back to normal after 300ms
 *
 * Every function used by an inline HTML handler is exposed on `window`.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var reducedMotion = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /* ------------------------------------------------------------------ */
  /* Projects data (unchanged)                                          */
  /* ------------------------------------------------------------------ */

  var projectsData = {
    1: {
      title: "Student Community Platform",
      tag: "WordPress Platform",
      problem: "Students lacked a focused digital space for peer learning.",
      solution: "Built and maintained a WordPress community platform with structured content flows.",
      result: "Improved student engagement and scalable participation.",
      stack: ["WordPress", "PHP", "CSS", "Hosting"],
      link: "https://github.com",
      quoteService: "WordPress"
    },
    2: {
      title: "Online Code Editor",
      tag: "Web Application",
      problem: "Needed a browser-first environment for quick coding and syntax checks.",
      solution: "React + Node.js app with CodeMirror for multi-language editing.",
      result: "Faster test cycles with no local setup.",
      stack: ["React", "Node.js", "CodeMirror", "JavaScript"],
      link: "https://github.com",
      quoteService: "Web app"
    },
    3: {
      title: "AI Inventory System",
      tag: "Backend & AI",
      problem: "Manual inventory search slowed internal operations.",
      solution: "Flask inventory app with AI-assisted querying and reporting.",
      result: "Less lookup effort and faster queries.",
      stack: ["Python", "Flask", "SQL", "AI Assistant"],
      link: "https://github.com",
      quoteService: "Backend API"
    },
    4: {
      title: "Drowsiness Detection System",
      tag: "Computer Vision & ML",
      problem: "Driver fatigue detection needed real-time analysis.",
      solution: "Python + OpenCV pipeline classifying drowsiness signals.",
      result: "Low-latency detection pipeline for real-time ML use.",
      stack: ["Python", "OpenCV", "ML"],
      link: "https://github.com",
      quoteService: "Something else"
    }
  };

  var ACTIVE_FILTER_CLASS =
    'filter-btn px-4 py-1.5 rounded-full bg-white text-black font-bold uppercase tracking-wider';
  var IDLE_FILTER_CLASS =
    'filter-btn px-4 py-1.5 rounded-full border border-[#333] text-muted-grey hover:text-white uppercase tracking-wider';
  var ACTIVE_CHIP_CLASS =
    'service-chip px-3 py-1.5 rounded-md bg-white text-black font-bold border border-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105';
  var IDLE_CHIP_CLASS =
    'service-chip px-3 py-1.5 rounded-md border border-[#26262a] bg-black text-muted-grey hover:text-white hover:border-[#444] transition-all';

  var activeModalProjectId = null;
  var selectedServices = new Set();

  function byId(id) { return doc.getElementById(id); }

  /* ------------------------------------------------------------------ */
  /* Filters                                                            */
  /* ------------------------------------------------------------------ */

  function setFilter(category) {
    byId('activeTechTagContainer').classList.add('hidden');
    byId('noProjectsMessage').classList.add('hidden');
    byId('projectsGrid').classList.remove('hidden');

    doc.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.className = btn.dataset.category === category ? ACTIVE_FILTER_CLASS : IDLE_FILTER_CLASS;
    });

    doc.querySelectorAll('.project-card').forEach(function (card) {
      var cats = card.dataset.category.split(',');
      if (category === 'All' || cats.indexOf(category) !== -1) card.classList.remove('hidden');
      else card.classList.add('hidden');
    });
  }

  function handleTechSelect(techName) {
    byId('activeTechLabel').innerText = techName;
    var tag = byId('activeTechTagContainer');
    tag.classList.remove('hidden');
    tag.classList.add('flex');

    doc.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.className = IDLE_FILTER_CLASS;
    });

    var matchCount = 0;
    doc.querySelectorAll('.project-card').forEach(function (card) {
      var techs = card.dataset.tech.toLowerCase().split(',');
      if (techs.some(function (t) { return t.indexOf(techName.toLowerCase()) !== -1; })) {
        card.classList.remove('hidden');
        matchCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    if (matchCount === 0) {
      byId('noProjectsMessage').classList.remove('hidden');
      byId('projectsGrid').classList.add('hidden');
    } else {
      byId('noProjectsMessage').classList.add('hidden');
      byId('projectsGrid').classList.remove('hidden');
    }
  }
function clearTechFilter() {
    byId('activeTechTagContainer').classList.add('hidden');
    setFilter('All');
  }

  /* ------------------------------------------------------------------ */
  /* Project modal                                                      */
  /* ------------------------------------------------------------------ */

  function openProjectModal(id) {
    var data = projectsData[id];
    if (!data) return;
    activeModalProjectId = id;

    byId('modalTag').innerText = data.tag;
    byId('modalTitle').innerText = data.title;
    byId('modalProblem').innerText = data.problem;
    byId('modalSolution').innerText = data.solution;
    byId('modalResult').innerText = data.result;
    byId('modalExternalLink').href = data.link;

    var chipsBox = byId('modalStackChips');
    chipsBox.innerHTML = '';
    data.stack.forEach(function (tech) {
      var span = doc.createElement('span');
      span.className = 'px-2.5 py-1 rounded bg-[#16161a] text-white border border-[#2a2a30] text-[10px]';
      span.innerText = tech;
      chipsBox.appendChild(span);
    });

    byId('projectModal').classList.remove('hidden');
    doc.body.classList.add('overflow-hidden');
  }

  function closeProjectModal() {
    byId('projectModal').classList.add('hidden');
    doc.body.classList.remove('overflow-hidden');
    activeModalProjectId = null;
  }

  function quoteFromModal() {
    if (activeModalProjectId && projectsData[activeModalProjectId]) {
      selectServiceChip(projectsData[activeModalProjectId].quoteService);
    }
    closeProjectModal();
    scrollToContact();
  }

  /* ------------------------------------------------------------------ */
  /* Navigation helpers                                                 */
  /* ------------------------------------------------------------------ */

  function scrollToContact() {
    var el = byId('contact');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () {
        var input = byId('clientName');
        if (input) input.focus();
      }, 500);
    }
  }

  function preselectAndQuote(svc) {
    selectServiceChip(svc);
    scrollToContact();
  }

  function filterAndScrollWork(cat) {
    setFilter(cat);
    var el = byId('work');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ */
  /* Quote form + service chips                                         */
  /* ------------------------------------------------------------------ */

  function toggleServiceChip(val) {
    if (selectedServices.has(val)) selectedServices.delete(val);
    else selectedServices.add(val);
    updateChipsUI();
    global.triggerCubeBounce();
  }

  function selectServiceChip(val) {
    selectedServices.add(val);
    updateChipsUI();
    global.triggerCubeBounce();
  }

  function updateChipsUI() {
    doc.querySelectorAll('.service-chip').forEach(function (btn) {
      btn.className = selectedServices.has(btn.dataset.value) ? ACTIVE_CHIP_CLASS : IDLE_CHIP_CLASS;
    });
    byId('selectedServicesInput').value = Array.from(selectedServices).join(', ');
  }

  function handleQuoteSubmit(e) {
    e.preventDefault();
    var hasError = false;

    var nameVal = byId('clientName').value.trim();
    var emailVal = byId('clientEmail').value.trim();
    var messageVal = byId('projectMessage').value.trim();

    var nameErr = byId('nameError');
    var emailErr = byId('emailError');
    var msgErr = byId('messageError');

    if (!nameVal) { nameErr.classList.remove('hidden'); hasError = true; } else nameErr.classList.add('hidden');
    if (!emailVal || emailVal.indexOf('@') === -1) { emailErr.classList.remove('hidden'); hasError = true; } else emailErr.classList.add('hidden');
    if (!messageVal) { msgErr.classList.remove('hidden'); hasError = true; } else msgErr.classList.add('hidden');

    if (hasError) return;

    global.triggerCubeSubmitSuccess();
    byId('quoteForm').classList.add('hidden');
    byId('formSuccessState').classList.remove('hidden');
  }

  function resetQuoteForm() {
    byId('quoteForm').reset();
    selectedServices.clear();
    updateChipsUI();
    byId('quoteForm').classList.remove('hidden');
    byId('formSuccessState').classList.add('hidden');
    global.resetCubeSuccess();
  }

  /* ------------------------------------------------------------------ */
  /* Scroll handling (Fix 6)                                           */
  /* ------------------------------------------------------------------ */

  var navVisible = false;          // sticky-nav state, toggled on threshold cross
  var lastScrollY = 0;
  var marqueeTrack = null;
  var marqueeAnim = null;
  var marqueeTimer = null;
  var marqueeRate = 1;
  var marqueeTargetRate = 1;
  var marqueeRaf = null;

  /**
   * Ease the marquee playbackRate towards `rate` on its own rAF chain.
   *
   * The easing MUST be driven until it converges. Applying a single 35% step
   * per call stalled the rate at 1.7 (never reaching 3) and then undershot to
   * ~0.755 on the way back to 1, so the ribbon visibly lurched instead of
   * easing. `animation-duration` is never touched, so the running animation
   * never jumps or restarts.
   */
  function easeMarqueeRate() {
    marqueeRaf = null;
    var delta = marqueeTargetRate - marqueeRate;
    if (Math.abs(delta) < 0.01) {
      marqueeRate = marqueeTargetRate;
      applyMarqueeRate();
      return;                       // converged: stop scheduling frames
    }
    marqueeRate += delta * 0.35;
    applyMarqueeRate();
    marqueeRaf = global.requestAnimationFrame(easeMarqueeRate);
  }

  function applyMarqueeRate() {
    if (!marqueeAnim) return;
    try { marqueeAnim.playbackRate = marqueeRate; } catch (err) { /* noop */ }
  }

  function setMarqueeRate(rate) {
    if (!marqueeTrack) return;
    if (!marqueeAnim && marqueeTrack.getAnimations) {
      var anims = marqueeTrack.getAnimations();
      marqueeAnim = anims.length ? anims[0] : null;
    }
    if (!marqueeAnim) return;
    marqueeTargetRate = rate;
    // One easing chain at a time; a new target just retargets the running one.
    if (marqueeRaf === null) marqueeRaf = global.requestAnimationFrame(easeMarqueeRate);
  }

  function marqueeSpeedUp() {
    if (reducedMotion) return;          // no speed-up under reduced motion
    setMarqueeRate(3);
    clearTimeout(marqueeTimer);
    marqueeTimer = setTimeout(function () { setMarqueeRate(1); }, 300);
  }

  /**
   * Called from the Lenis scroll callback (or a batched rAF handler) instead of
   * directly from a scroll event, so it runs at most once per frame.
   */
  function onScrollFrame() {
    var winScroll = global.scrollY || global.pageYOffset || 0;

    // Progress bar: transform only - no layout, composited by the GPU.
    var progress = byId('scrollProgress');
    if (progress) {
      var height = doc.documentElement.scrollHeight - global.innerHeight;
      var scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      progress.style.transform = 'scaleX(' + (scrolled / 100) + ')';
    }

    // Sticky nav: only touch the class when the 320px threshold is crossed.
    var shouldShow = winScroll > 320;
    if (shouldShow !== navVisible) {
      navVisible = shouldShow;
      var nav = byId('stickyNav');
      if (nav) nav.classList.toggle('-translate-y-full', !shouldShow);
    }

    // Marquee: speed up while scrolling fast (no animation-duration changes).
    var diff = Math.abs(winScroll - lastScrollY);
    if (diff > 10) marqueeSpeedUp();
    lastScrollY = winScroll;
  }

  /* ------------------------------------------------------------------ */
  /* Live Asia/Kolkata clock                                            */
  /* ------------------------------------------------------------------ */

  var clockFormatter = null;
  var clockTimer = null;
  var lastClockText = '';

  function formatClock(now) {
    if (!clockFormatter) {
      clockFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    return 'IST ' + clockFormatter.format(now).toLowerCase();
  }

  function updateLiveClock() {
    try {
      var text = formatClock(new Date());
      var el = byId('liveClock');
      // Only touch the DOM when the rendered text actually changed.
      if (el && text !== lastClockText) {
        el.innerText = text;
        lastClockText = text;
      }
    } catch (e) { /* noop */ }
  }

  /** Schedule the next update exactly on the next minute boundary. */
  function scheduleClock() {
    updateLiveClock();
    var now = new Date();
    var msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    clockTimer = setTimeout(scheduleClock, msToNextMinute + 10);
  }

  /* ------------------------------------------------------------------ */
  /* Accordion hover interaction (unchanged)                            */
  /* ------------------------------------------------------------------ */

  function initAccordion() {
    var accordionItems = doc.querySelectorAll('.accordion-item');
    accordionItems.forEach(function (item) {
      item.addEventListener('mouseenter', function () {
        accordionItems.forEach(function (i) { i.classList.remove('is-expanded'); });
        item.classList.add('is-expanded');
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* GSAP scroll animations                                            */
  /* ------------------------------------------------------------------ */

  function initCurtainTransitions() {
    if (!global.gsap || !global.ScrollTrigger) return;
    global.gsap.registerPlugin(global.ScrollTrigger);

    // Reduced motion: keep the arch and the content fully visible/static.
    if (reducedMotion) return;

    // Arch curve flatting scrub
    doc.querySelectorAll('.curtain-section').forEach(function (section) {
      var archPath = section.querySelector('.curtain-arch-path');
      if (archPath) {
        global.gsap.to(archPath, {
          attr: { d: "M0,40 Q720,40 1440,40 L1440,40 L0,40 Z" },
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top 20%",
            scrub: true
          }
        });
      }
    });

    // Staggered service cards scroll entrance rotation
    global.gsap.from("#service-card-1", {
      rotation: -4, opacity: 0.6, y: 60, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: "#services", start: "top 75%" }
    });
    global.gsap.from("#service-card-2", {
      rotation: 0, opacity: 0.6, y: 90, duration: 1.1, ease: "power3.out",
      scrollTrigger: { trigger: "#services", start: "top 75%" }
    });
    global.gsap.from("#service-card-3", {
      rotation: 4, opacity: 0.6, y: 120, duration: 1.2, ease: "power3.out",
      scrollTrigger: { trigger: "#services", start: "top 75%" }
    });

    // Stats Count Up
    global.ScrollTrigger.create({
      trigger: "#trust",
      start: "top 75%",
      once: true,
      onEnter: function () {
        doc.querySelectorAll('.stat-num').forEach(function (el) {
          var target = parseInt(el.dataset.val, 10);
          global.gsap.to(el, {
            innerText: target, duration: 1.5,
            snap: { innerText: 1 }, ease: "power2.out"
          });
        });
      }
    });
  }
/* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    marqueeTrack = doc.querySelector('.marquee-track');
    if (marqueeTrack && marqueeTrack.getAnimations) {
      var anims = marqueeTrack.getAnimations();
      marqueeAnim = anims.length ? anims[0] : null;
    }

    initAccordion();
    initCurtainTransitions();
    scheduleClock();

    var modal = byId('projectModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeProjectModal();
      });
    }
  }

  var api = {
    init: init,
    onScrollFrame: onScrollFrame,
    updateLiveClock: updateLiveClock,
    projectsData: projectsData
  };

  // Expose every function referenced by an inline HTML handler.
  var handlers = {
    setFilter: setFilter,
    handleTechSelect: handleTechSelect,
    clearTechFilter: clearTechFilter,
    openProjectModal: openProjectModal,
    closeProjectModal: closeProjectModal,
    quoteFromModal: quoteFromModal,
    scrollToContact: scrollToContact,
    preselectAndQuote: preselectAndQuote,
    filterAndScrollWork: filterAndScrollWork,
    toggleServiceChip: toggleServiceChip,
    selectServiceChip: selectServiceChip,
    handleQuoteSubmit: handleQuoteSubmit,
    resetQuoteForm: resetQuoteForm
  };
  Object.keys(handlers).forEach(function (k) { global[k] = handlers[k]; });

  global.UI = api;
})(window);
