document.addEventListener("DOMContentLoaded", () => {
  // Register GSAP plugins
  gsap.registerPlugin(ScrollTrigger);

  // ==========================================================================
  // 0. Animated Gradient Orb Background (Premium atmospheric depth — Linear / Vercel tier)
  //    Soft, slow-drifting mint & beige luminosity blobs across ALL cream/white sections.
  //    Pure Canvas 2D — zero GPU overhead, buttery 60 FPS.
  // ==========================================================================
  const bgCanvas = document.createElement('canvas');
  bgCanvas.id = 'bg-canvas';
  document.body.prepend(bgCanvas);
  const bgCtx = bgCanvas.getContext('2d');

  let bgW = bgCanvas.width = window.innerWidth;
  let bgH = bgCanvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    bgW = bgCanvas.width = window.innerWidth;
    bgH = bgCanvas.height = window.innerHeight;
  });

  // Each orb: fractional position, radius (fraction of min-dimension),
  // RGBA color, peak alpha, drift speeds, and phase offset for variety
  const bgOrbs = [
    { x: 0.12, y: 0.22, r: 0.55, color: [226, 237, 230], alpha: 0.55, sx: 0.18, sy: 0.10, ph: 0 },
    { x: 0.88, y: 0.14, r: 0.48, color: [213, 206, 196], alpha: 0.45, sx: 0.13, sy: 0.09, ph: Math.PI },
    { x: 0.52, y: 0.62, r: 0.60, color: [226, 237, 230], alpha: 0.38, sx: 0.10, sy: 0.15, ph: Math.PI / 2 },
    { x: 0.18, y: 0.78, r: 0.42, color: [213, 206, 196], alpha: 0.42, sx: 0.09, sy: 0.12, ph: Math.PI * 1.5 },
    { x: 0.80, y: 0.52, r: 0.44, color: [247, 245, 238], alpha: 0.60, sx: 0.14, sy: 0.08, ph: Math.PI * 0.7 },
    { x: 0.38, y: 0.35, r: 0.38, color: [226, 237, 230], alpha: 0.30, sx: 0.16, sy: 0.11, ph: Math.PI * 1.2 },
  ];

  const bgStart = performance.now();

  // Mouse parallax — orbs subtly shift toward/away from cursor for 3D depth
  let rawMouseX = 0.5, rawMouseY = 0.5;
  let smoothMouseX = 0.5, smoothMouseY = 0.5;
  document.addEventListener('mousemove', (e) => {
    rawMouseX = e.clientX / window.innerWidth;
    rawMouseY = e.clientY / window.innerHeight;
  });

  function animateBg(now) {
    const t = (now - bgStart) / 1000; // seconds elapsed

    // Lerp mouse position for buttery smooth parallax (no jank)
    smoothMouseX += (rawMouseX - smoothMouseX) * 0.04;
    smoothMouseY += (rawMouseY - smoothMouseY) * 0.04;

    // Parallax offset: ±4% of screen from center
    const px = (smoothMouseX - 0.5) * 0.08;
    const py = (smoothMouseY - 0.5) * 0.08;

    bgCtx.clearRect(0, 0, bgW, bgH);

    bgOrbs.forEach((orb, i) => {
      // Smooth Lissajous drift path + mouse parallax (alternating depth layers)
      const depthDir = i % 2 === 0 ? 1 : -1; // alternating layers move in opposite dirs
      const cx = (orb.x + Math.sin(t * orb.sx + orb.ph) * 0.18 + px * depthDir * 0.6) * bgW;
      const cy = (orb.y + Math.cos(t * orb.sy + orb.ph) * 0.13 + py * depthDir * 0.6) * bgH;
      const radius = orb.r * Math.min(bgW, bgH);

      const grad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${orb.color[0]},${orb.color[1]},${orb.color[2]},${orb.alpha})`);
      grad.addColorStop(0.5, `rgba(${orb.color[0]},${orb.color[1]},${orb.color[2]},${orb.alpha * 0.3})`);
      grad.addColorStop(1, `rgba(${orb.color[0]},${orb.color[1]},${orb.color[2]},0)`);

      bgCtx.fillStyle = grad;
      bgCtx.beginPath();
      bgCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      bgCtx.fill();
    });

    requestAnimationFrame(animateBg);
  }
  requestAnimationFrame(animateBg);

  // ==========================================================================
  // 1. Lenis Smooth Scroll Engine
  // ==========================================================================
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth exponential out
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothWheel: true,
    infinite: false,
  });

  // Connect Lenis to requestAnimationFrame for high performance
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Sync GSAP ScrollTrigger with Lenis scroll positions
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // ==========================================================================
  // 2. Custom Weighted Cursor Physics
  // ==========================================================================
  const cursor = document.getElementById('customCursor');
  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;

  if (cursor) {
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Smooth lerp for cursor tracking
    function renderCursor() {
      cursorX += (mouseX - cursorX) * 0.15; // smooth weight
      cursorY += (mouseY - cursorY) * 0.15;
      cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
      requestAnimationFrame(renderCursor);
    }
    renderCursor();

    // Cursor hover state changes for interactive components
    const interactives = document.querySelectorAll('a, button, .bento-card, .step-content, .warning-btn, .audio-play-btn');
    interactives.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });
  }

  // ==========================================================================
  // 3. Magnetic Button Physics (Stripe/Linear Tier)
  // ==========================================================================
  const magneticBtns = document.querySelectorAll('.magnetic-btn');
  magneticBtns.forEach(btn => {
    const text = btn.querySelector('span');
    
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Dynamic physics pulls
      gsap.to(btn, { x: x * 0.35, y: y * 0.35, duration: 0.3, ease: "power2.out" });
      if (text) {
        gsap.to(text, { x: x * 0.15, y: y * 0.15, duration: 0.3, ease: "power2.out" });
      }
    });

    btn.addEventListener('mouseleave', () => {
      // Snaps back elegantly with high inertia
      gsap.to(btn, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" });
      if (text) {
        gsap.to(text, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" });
      }
    });
  });

  // ==========================================================================
  // 4. 3D Tilt Card Hover Calculations (Linear-tier Interaction)
  // ==========================================================================
  const tiltCards = document.querySelectorAll('.tilt-card');
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate perspective 3D rotates
      const rotateX = ((y - centerY) / centerY) * -6; // Max 6 deg tilt
      const rotateY = ((x - centerX) / centerX) * 6;
      
      gsap.to(card, {
        rotateX: rotateX,
        rotateY: rotateY,
        transformPerspective: 1000,
        duration: 0.4,
        ease: "power2.out"
      });
    });

    card.addEventListener('mouseleave', () => {
      // Elastic return to flat rest
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.8,
        ease: "elastic.out(1, 0.4)"
      });
    });
  });

  // ==========================================================================
  // 5. Interactive Grid Mouse Spotlight (CTA Section)
  // ==========================================================================
  const ctaSections = document.querySelectorAll('.cta-section');
  ctaSections.forEach(section => {
    section.addEventListener('mousemove', (e) => {
      const rect = section.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      section.style.setProperty('--mouse-x', `${x}%`);
      section.style.setProperty('--mouse-y', `${y}%`);
    });
  });

  // ==========================================================================
  // 6. GSAP ScrollTrigger Animations (WOW-Factor Timelines)
  // ==========================================================================
  
  // 6.1 Hero Device Mockup 3D Unfolding (Linear/Attio Tier)
  const heroImageContainer = document.querySelector(".hero-image-container");
  if (heroImageContainer) {
    gsap.timeline({
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
        invalidateOnRefresh: true
      }
    })
    .to(heroImageContainer, {
      transform: "perspective(1200px) rotateX(0deg) scale(1)",
      clipPath: "inset(0 0% 0 0% round 0px)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
      ease: "none"
    });
  }

  // 6.2 Value Prop Statement Word mask reveals
  const statementWords = gsap.utils.toArray('.statement-word');
  if (statementWords.length > 0) {
    gsap.to(statementWords, {
      opacity: 1,
      y: 0,
      stagger: 0.05,
      scrollTrigger: {
        trigger: ".statement",
        start: "top 75%",
        end: "center 30%",
        scrub: 1,
      }
    });
  }

  // 6.3 Bento Cards 3D Flip-In and Lift entry
  const bentoCards = gsap.utils.toArray('.bento-card');
  if (bentoCards.length > 0) {
    gsap.from(bentoCards, {
      transform: "perspective(1000px) rotateY(-15deg) translateY(120px) scale(0.95)",
      opacity: 0,
      duration: 1.4,
      stagger: 0.15,
      ease: "power4.out",
      scrollTrigger: {
        trigger: ".bento-grid",
        start: "top 80%",
        end: "bottom 20%",
        toggleActions: "play none none none"
      }
    });
  }

  // 6.4 Timeline step entries with vertical line draw-in
  const timelineSteps = gsap.utils.toArray('.step');
  if (timelineSteps.length > 0) {
    timelineSteps.forEach((step) => {
      const number = step.querySelector('.step-number');
      const content = step.querySelector('.step-content');
      
      gsap.timeline({
        scrollTrigger: {
          trigger: step,
          start: "top 80%",
          toggleActions: "play none none none"
        }
      })
      .from(step, {
        opacity: 0,
        x: -40,
        duration: 0.8,
        ease: "power3.out"
      })
      .from(number, {
        scale: 0,
        duration: 0.6,
        ease: "back.out(1.7)"
      }, "-=0.6")
      .from(content, {
        transform: "perspective(1000px) rotateX(10deg) translateY(40px)",
        duration: 0.8,
        ease: "power3.out"
      }, "-=0.4");
    });
  }

  // ==========================================================================
  // 7. Spline 3D Scene Graph Optimization & Cleanup (Zero-Lag Max Expand)
  // ==========================================================================
  const splineViewers = document.querySelectorAll('spline-viewer');
  splineViewers.forEach(viewer => {
    // Hide Spline Logo inside Shadow DOM
    const hideLogo = () => {
      if (viewer.shadowRoot) {
        const style = document.createElement('style');
        style.textContent = `#logo, .logo, a[href*="spline.design"] { display: none !important; pointer-events: none !important; opacity: 0 !important; visibility: hidden !important; }`;
        viewer.shadowRoot.appendChild(style);
      }
    };
    
    hideLogo();
    setTimeout(hideLogo, 500); // Fallback for delayed shadow DOM

    const cleanScene = () => {
      const app = viewer.app;
      if (app && app.scene) {
        // Optimized check: if already cleaned, do not run heavy traversal again
        if (viewer.isCleaned) return;

        let foundUseless = false;

        app.scene.traverse((obj) => {
          // ONLY hide explicitly created Text objects, to prevent accidentally hiding the main background meshes
          const isUselessWording = 
            (obj.geometry && obj.geometry.type === 'TextGeometry') ||
            (obj.geometry && obj.geometry.type === 'TextBufferGeometry');

          if (isUselessWording) {
            obj.visible = false;
            foundUseless = true;
          }
        });

        if (foundUseless) {
          viewer.isCleaned = true;
        }
      }
    };

    // Run cleanScene continuously on a 100ms interval for 5 seconds to catch objects
    // created dynamically during the Spline intro animation timeline.
    const startIntervalCleanup = () => {
      cleanScene();
      const interval = setInterval(cleanScene, 100);
      setTimeout(() => clearInterval(interval), 5000);
    };

    if (viewer.app) {
      startIntervalCleanup();
    } else {
      viewer.addEventListener('load', startIntervalCleanup);
    }
  });

});
