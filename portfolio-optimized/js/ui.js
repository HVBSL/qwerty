const UI = {
    isNavSticky: false,
    marqueeAnim: null,
    scrollTimeout: null,

    init() {
        this.initClock();
        this.initMarquee();
        this.initStatCounters();

        // Expose handlers globally for HTML inline handlers
        window.scrollToContact = this.scrollToContact;
        window.openProjectModal = this.openProjectModal;
        window.closeProjectModal = this.closeProjectModal;
        window.setFilter = this.setFilter;
        window.handleTechSelect = this.handleTechSelect;
        window.clearTechFilter = this.clearTechFilter;
        window.preselectAndQuote = this.preselectAndQuote;
        window.filterAndScrollWork = this.filterAndScrollWork;
        window.toggleServiceChip = this.toggleServiceChip;
        window.selectServiceChip = this.selectServiceChip;
        window.handleQuoteSubmit = this.handleQuoteSubmit;
        window.resetQuoteForm = this.resetQuoteForm;
        window.quoteFromModal = this.quoteFromModal;
        window.cycleSpherePalette = () => { if(window.Scenes) window.Scenes.hero.paletteIndex = (window.Scenes.hero.paletteIndex + 1) % window.Scenes.hero.palettes.length; };

        // Handle Escape for Modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeProjectModal();
        });

        // Modal background click
        const overlay = document.getElementById('projectModalOverlay');
        if(overlay) {
            overlay.addEventListener('click', (e) => {
               if(e.target === overlay) this.closeProjectModal();
            });
        }
    },

    onScroll(e) {
        // Progress Bar
        const progress = document.getElementById('scrollProgress');
        if (progress) {
            // Using e.progress which is 0 to 1
            progress.style.transform = `scaleX(${e.progress})`;
            progress.style.transformOrigin = 'left';
            progress.style.width = '100%'; // ensure width is set so scale works
        }

        // Sticky Nav
        const nav = document.getElementById('stickyNav');
        if (nav) {
            const shouldBeSticky = window.scrollY > 320;
            if (shouldBeSticky !== this.isNavSticky) {
                this.isNavSticky = shouldBeSticky;
                if (shouldBeSticky) {
                    nav.classList.remove('-translate-y-full');
                } else {
                    nav.classList.add('-translate-y-full');
                }
            }
        }

        // Marquee Speed
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (this.marqueeAnim && !prefersReducedMotion) {
            // e.velocity is pixels per frame approx
            const absVel = Math.abs(e.velocity);
            let targetRate = 1;
            if (absVel > 2) {
               targetRate = Math.min(1 + (absVel * 0.1), 4);
            }

            // smooth out
            this.marqueeAnim.playbackRate += (targetRate - this.marqueeAnim.playbackRate) * 0.1;

            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                const stepDown = setInterval(() => {
                    if (this.marqueeAnim.playbackRate <= 1.05) {
                        this.marqueeAnim.playbackRate = 1;
                        clearInterval(stepDown);
                    } else {
                        this.marqueeAnim.playbackRate += (1 - this.marqueeAnim.playbackRate) * 0.1;
                    }
                }, 16);
            }, 300);
        }
    },

    initMarquee() {
        const track = document.getElementById('marqueeTrack');
        if (track) {
            // Using Web Animations API for playbackRate control
            const animations = track.getAnimations();
            if (animations.length > 0) {
                this.marqueeAnim = animations[0];
            } else {
                // Fallback if CSS animation isn't picked up yet
                setTimeout(() => {
                    const anims = track.getAnimations();
                    if(anims.length > 0) this.marqueeAnim = anims[0];
                }, 100);
            }
        }
    },

    initClock() {
        const clockEl = document.getElementById('liveClock');
        if (!clockEl) return;

        const update = () => {
            const now = new Date();
            const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true };
            const timeStr = 'IST ' + now.toLocaleTimeString('en-US', options).toLowerCase();

            if (clockEl.innerText !== timeStr) {
                clockEl.innerText = timeStr;
            }

            // Schedule next minute
            const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
            setTimeout(update, msToNextMinute);
        };
        update();
    },

    initStatCounters() {
        if (!window.gsap || !window.ScrollTrigger) return;
        const nums = document.querySelectorAll('.stat-num');
        nums.forEach(num => {
            const target = parseFloat(num.getAttribute('data-val'));
            gsap.to(num, {
                scrollTrigger: {
                    trigger: num,
                    start: "top 85%",
                    once: true
                },
                innerText: target,
                duration: 2,
                snap: { innerText: 1 },
                ease: "power2.out"
            });
        });
    },

    // --- UI Handlers ---
    scrollToContact() {
        const contact = document.getElementById('contact');
        if(contact && window.MainApp && window.MainApp.lenis) {
            window.MainApp.lenis.scrollTo(contact, { offset: -50 });
        } else if (contact) {
            contact.scrollIntoView({behavior: 'smooth'});
        }
    },

    openProjectModal(id) {
       document.getElementById('projectModalOverlay').classList.remove('hidden', 'opacity-0');
       document.body.style.overflow = 'hidden';
       if (window.MainApp && window.MainApp.lenis) window.MainApp.lenis.stop();
    },

    closeProjectModal() {
       document.getElementById('projectModalOverlay').classList.add('hidden', 'opacity-0');
       document.body.style.overflow = '';
       if (window.MainApp && window.MainApp.lenis) window.MainApp.lenis.start();
    },

    setFilter(cat) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if(btn.dataset.category === cat) {
                btn.className = "filter-btn px-4 py-1.5 rounded-full bg-white text-black font-bold uppercase tracking-wider";
            } else {
                btn.className = "filter-btn px-4 py-1.5 rounded-full border border-[#333] text-muted-grey hover:text-white uppercase tracking-wider";
            }
        });

        const msg = document.getElementById('noProjectsMessage');
        const grid = document.getElementById('projectsGrid');
        let visibleCount = 0;

        document.querySelectorAll('.project-card').forEach(card => {
            if(cat === 'All' || card.dataset.category === cat || card.dataset.tech.includes(cat)) {
                card.style.display = 'flex';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (msg && grid) {
            if(visibleCount === 0) {
                msg.classList.remove('hidden');
                grid.classList.add('hidden');
            } else {
                msg.classList.add('hidden');
                grid.classList.remove('hidden');
            }
        }
    },

    handleTechSelect(tech) {
        const tag = document.getElementById('orbitActiveTag');
        if(tag) tag.innerText = "Active: " + tech;

        const catMap = {
            'React': 'Web', 'Node.js': 'Backend', 'ASP.NET Core': 'Backend',
            'MSSQL': 'Backend', 'WordPress': 'WordPress', 'PHP': 'WordPress'
        };

        const cat = catMap[tech] || 'All';
        this.setFilter(cat);

        const container = document.getElementById('activeTechTagContainer');
        const label = document.getElementById('activeTechLabel');
        if(container && label) {
            container.classList.remove('hidden');
            container.classList.add('flex');
            label.innerText = tech;
        }
    },

    clearTechFilter() {
       const tag = document.getElementById('orbitActiveTag');
       if(tag) tag.innerText = "Drag orbit · Click node";

       const container = document.getElementById('activeTechTagContainer');
       if(container) {
           container.classList.add('hidden');
           container.classList.remove('flex');
       }
       this.setFilter('All');
    },

    preselectAndQuote(service) {
        this.scrollToContact();
        const chips = document.querySelectorAll('#serviceChips button');
        chips.forEach(c => {
           if (c.innerText.trim().toUpperCase() === service.toUpperCase() || c.innerText.includes(service)) {
               this.selectServiceChip(c);
           }
        });
    },

    filterAndScrollWork(category) {
        const workSection = document.getElementById('work');
        if (workSection && window.MainApp && window.MainApp.lenis) {
            window.MainApp.lenis.scrollTo(workSection, { offset: -50 });
        } else if (workSection) {
            workSection.scrollIntoView({behavior: 'smooth'});
        }
        this.setFilter(category);
    },

    toggleServiceChip(btn) {
        if(btn.dataset.active === 'true') {
            btn.dataset.active = 'false';
            btn.className = "px-4 py-2 rounded border border-[#333] text-muted-grey hover:text-white transition-colors text-left";
        } else {
            this.selectServiceChip(btn);
        }
    },

    selectServiceChip(btn) {
        btn.dataset.active = 'true';
        btn.className = "px-4 py-2 rounded border border-accent-cyan bg-accent-cyan/10 text-accent-cyan transition-colors text-left shadow-[0_0_15px_rgba(41,224,224,0.15)]";
        if(window.triggerCubeBounce) window.triggerCubeBounce();
    },

    handleQuoteSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        const defaultState = document.getElementById('formDefaultState');
        const successState = document.getElementById('formSuccessState');

        if (btn) btn.disabled = true;
        if(window.triggerCubeSubmitSuccess) window.triggerCubeSubmitSuccess();

        setTimeout(() => {
            if(defaultState) defaultState.classList.add('hidden');
            if(successState) successState.classList.remove('hidden');
        }, 1500);
    },

    resetQuoteForm() {
        const defaultState = document.getElementById('formDefaultState');
        const successState = document.getElementById('formSuccessState');
        const btn = document.getElementById('submitBtn');
        const form = document.getElementById('quoteForm');

        if(defaultState) defaultState.classList.remove('hidden');
        if(successState) successState.classList.add('hidden');
        if(btn) btn.disabled = false;
        if(form) form.reset();

        document.querySelectorAll('#serviceChips button').forEach(b => {
            b.dataset.active = 'false';
            b.className = "px-4 py-2 rounded border border-[#333] text-muted-grey hover:text-white transition-colors text-left";
        });

        const overlay = document.getElementById('cubeCheckOverlay');
        if(overlay) overlay.classList.add('opacity-0');
    },

    quoteFromModal() {
        this.closeProjectModal();
        setTimeout(() => this.scrollToContact(), 300);
    }
};

window.UI = UI;
