const PROXIMITY_RADIUS = 120;
const MAX_TILT = 14;
const MAX_LIFT = -14;
const MIN_WEIGHT = 100;
const MAX_WEIGHT = 900;
const THEME_COLORS = ['#ff2fd0', '#7a3cff', '#29e0e0', '#fbbf24', '#ffffff'];

const TextEngine = {
  activeHeadlines: [],
  letters: [],
  targetX: 0,
  targetY: 0,
  isActive: false,

  init() {
    if (this.initialized) return;

    // We only want to run logic if user prefers motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    this.initialized = true;
    // Set up IntersectionObserver to only process visible headlines
    this.visibleHeadlines = new Set();
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.visibleHeadlines.add(entry.target);
        } else {
          this.visibleHeadlines.delete(entry.target);
        }
      });
    }, { rootMargin: '100px' });


    // Split text once fonts are loaded

    const runSplit = () => {
      this.splitHeadlines();
      this.splitFooter();
      this.measureLetters();
      if(window.ScrollTrigger) ScrollTrigger.refresh();
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(runSplit).catch(runSplit);
    } else {
      setTimeout(runSplit, 100);
    }


    window.addEventListener('resize', this.debounce(() => this.measureLetters(), 250));

    // Track pointer (passive, zero DOM reads)
    window.addEventListener('mousemove', (e) => this.onPointerMove(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', (e) => {
        if(e.touches.length > 0) this.onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', () => {
        this.targetX = -9999;
        this.targetY = -9999;
        if (!this.isActive) {
           this.isActive = true;
           if (window.MainApp) window.MainApp.wakeTextEngine();
        }
    });
    window.addEventListener('mouseleave', () => {
        this.targetX = -9999;
        this.targetY = -9999;
        if (!this.isActive) {
           this.isActive = true;
           if (window.MainApp) window.MainApp.wakeTextEngine();
        }
    });
  },

  onPointerMove(clientX, clientY) {
    this.targetX = clientX + window.scrollX;
    this.targetY = clientY + window.scrollY;

    if (!this.isActive) {
      this.isActive = true;
      if (window.MainApp) window.MainApp.wakeTextEngine();
    }
  },

  splitHeadlines() {
    document.querySelectorAll('.prox-headline').forEach(headline => {
      if (headline.hasAttribute('data-split')) return;
      headline.setAttribute('data-split', 'true');

      const text = headline.textContent.trim();
      headline.setAttribute('aria-label', text);
      headline.innerHTML = '';

      // Split into words, then letters
      const words = text.split(/(\s+)/); // keep spaces
      words.forEach(word => {
        const wordWrap = document.createElement('span');
        wordWrap.style.display = 'inline-block';
        wordWrap.style.whiteSpace = 'nowrap';
        wordWrap.setAttribute('aria-hidden', 'true');

        [...word].forEach((char, index) => {
          if (char === ' ') {
             const space = document.createTextNode(' ');
             wordWrap.appendChild(space);
             return;
          }

          const charWrap = document.createElement('span');
          charWrap.className = 'char';
          charWrap.style.display = 'inline-block';

          const glyph = document.createElement('span');
          glyph.className = 'glyph prox-letter';
          glyph.textContent = char;

          // Seeded randoms
          const seed = char.charCodeAt(0) + index;
          glyph.dataset.color = THEME_COLORS[seed % THEME_COLORS.length];
          glyph.dataset.angle = (seed % (MAX_TILT * 2)) - MAX_TILT;

          charWrap.appendChild(glyph);
          wordWrap.appendChild(charWrap);
          this.letters.push({ wrapper: charWrap, glyph: glyph, type: 'headline', parent: headline });
        });
        headline.appendChild(wordWrap);
      });

      this.activeHeadlines.push(headline);
      this.observer.observe(headline);
    });
  },

  splitFooter() {
     const wordmark = document.querySelector('footer h2');
     if (!wordmark || wordmark.hasAttribute('data-split')) return;
     wordmark.setAttribute('data-split', 'true');

     // Original wordmark is just text separated by nothing. Wait, the original HTML has literal text like "BALAJI.DEV".
     // But wait, the original html has:
     // <h2 class="...">
     //       BALAJI.DEV
     // </h2>
     const text = wordmark.textContent.trim().replace(/\s+/g, '');
     wordmark.setAttribute('aria-label', text);
     wordmark.innerHTML = '';

     // Apply justify-between class to wordmark itself if it doesn't have it, actually it was there.
     // The original HTML had the wordmark as plain text, and we want to preserve spacing.
     // In original: it was a single word "BALAJI.DEV", maybe there wasn't a justify-between on letters.
     // Wait, the original wordmark letters weren't split.
     // Wait, the previous review said: "causes the footer letters to clump together... defeats the original justify-between spacing".
     // Actually, let's just make the wordWrap have width 100% and justify-content space-between if it needs it.

     const wordWrap = document.createElement('span');
     wordWrap.style.display = 'flex';
     wordWrap.style.justifyContent = 'space-between';
     wordWrap.style.width = '100%';
     wordWrap.setAttribute('aria-hidden', 'true');

     [...text].forEach((char, index) => {
          const charWrap = document.createElement('span');
          charWrap.className = 'char';
          charWrap.style.display = 'inline-block';

          const glyph = document.createElement('span');
          glyph.className = 'glyph wordmark-char';
          glyph.textContent = char;

          glyph.dataset.color = (index % 2 === 0) ? '#29e0e0' : '#ff2fd0';

          if(char === '.') glyph.style.opacity = '0.4';

          charWrap.appendChild(glyph);
          wordWrap.appendChild(charWrap);
          this.letters.push({ wrapper: charWrap, glyph: glyph, type: 'footer', parent: wordmark });
     });

     wordmark.appendChild(wordWrap);
     this.activeHeadlines.push(wordmark);
     this.observer.observe(wordmark);
  },

  measureLetters() {
    // Measure and set fixed width on wrappers to prevent layout shifts
    this.letters.forEach(letter => {
       if (!this.visibleHeadlines.has(letter.parent)) return;
      // Temporarily set to max weight for widest bounding box
      letter.glyph.style.fontVariationSettings = `'wght' 900`;
      letter.glyph.style.fontWeight = '900';
    });

    // Force layout flush once
    document.body.offsetHeight;

    this.letters.forEach(letter => {
      const rect = letter.glyph.getBoundingClientRect();
      letter.wrapper.style.width = `${rect.width}px`;

      // Store document coordinates
      letter.cx = rect.left + window.scrollX + rect.width / 2;
      letter.cy = rect.top + window.scrollY + rect.height / 2;
    });
  },

  tick() {
    if (!this.isActive) return false;

    let needsUpdate = false;
    const EPSILON = 0.01;

    // We could optimize by checking if the headline is in viewport here
    // For simplicity, we process all measured letters

    this.letters.forEach(letter => {
       const dx = letter.cx - this.targetX;
       const dy = letter.cy - this.targetY;
       const dist = Math.sqrt(dx*dx + dy*dy);

       let targetStrength = 0;
       if (dist < PROXIMITY_RADIUS) {
           targetStrength = 1 - (dist / PROXIMITY_RADIUS);
       }

       // Initialize current strength if not present
       if(letter.currentStrength === undefined) letter.currentStrength = 0;

       // Lerp
       letter.currentStrength += (targetStrength - letter.currentStrength) * 0.15;

       if (Math.abs(letter.currentStrength - targetStrength) > EPSILON || targetStrength > 0) {
           needsUpdate = true;

           if(letter.type === 'headline') {
               const weight = Math.round(MAX_WEIGHT - (MAX_WEIGHT - MIN_WEIGHT) * letter.currentStrength);
               const y = MAX_LIFT * letter.currentStrength;
               const rot = parseFloat(letter.glyph.dataset.angle) * letter.currentStrength;
               const color = letter.currentStrength > 0.3 ? letter.glyph.dataset.color : '#ffffff';

               letter.glyph.style.fontVariationSettings = `'wght' ${weight}`;
               letter.glyph.style.fontWeight = weight;
               letter.glyph.style.transform = `translateY(${y}px) rotate(${rot}deg)`;
               letter.glyph.style.color = color;
           } else if (letter.type === 'footer') {
               const weight = Math.round(900 - (900 - 100) * letter.currentStrength);
               const scale = 1 + (0.05 * letter.currentStrength);
               const y = -8 * letter.currentStrength;

               letter.glyph.style.fontVariationSettings = `'wght' ${weight}`;
               letter.glyph.style.fontWeight = weight;
               letter.glyph.style.transform = `translateY(${y}px) scale(${scale})`;

               if (letter.currentStrength > 0.1) {
                   letter.glyph.style.color = 'transparent';
                   letter.glyph.style.webkitTextStroke = `1.5px ${letter.glyph.dataset.color}`;
                   letter.glyph.style.textShadow = `0 0 25px ${letter.glyph.dataset.color}80`;
               } else {
                   letter.glyph.style.color = '#333333'; // base color for footer
                   letter.glyph.style.webkitTextStroke = '1px transparent';
                   letter.glyph.style.textShadow = 'none';
               }
           }
       } else if (letter.currentStrength > 0 && targetStrength === 0) {
           // Reset exact
           letter.currentStrength = 0;
           if(letter.type === 'headline') {
               letter.glyph.style.fontVariationSettings = `'wght' 900`;
               letter.glyph.style.fontWeight = 900;
               letter.glyph.style.transform = 'translateY(0px) rotate(0deg)';
               letter.glyph.style.color = '#ffffff';
           } else if (letter.type === 'footer') {
               letter.glyph.style.fontVariationSettings = `'wght' 900`;
               letter.glyph.style.fontWeight = 900;
               letter.glyph.style.transform = 'translateY(0px) scale(1)';
               letter.glyph.style.color = '#333333';
               letter.glyph.style.webkitTextStroke = '1px transparent';
               letter.glyph.style.textShadow = 'none';
           }
       }
    });

    if (!needsUpdate) {
        this.isActive = false;
    }

    return this.isActive;
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

window.TextEngine = TextEngine;
