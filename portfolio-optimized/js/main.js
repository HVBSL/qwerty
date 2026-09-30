document.addEventListener("DOMContentLoaded", () => {
    if(window.TextEngine) window.TextEngine.init();
    if(window.Scenes) window.Scenes.init();
    if(window.UI) window.UI.init();
    if(window.MainApp) window.MainApp.init();

    // Original GSAP scrub logic for sections
    if (window.gsap && window.ScrollTrigger && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
       gsap.utils.toArray('.curtain-section').forEach(section => {
          gsap.to(section.querySelector('.curtain-arch-path'), {
            attr: { d: "M0,40 Q720,40 1440,40 L1440,40 L0,40 Z" },
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top 90%",
              end: "top top",
              scrub: true
            }
          });
       });
    }
});
