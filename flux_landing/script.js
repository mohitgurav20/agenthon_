
// ==========================================================================
// FLUX — Landing Page Animation Engine
// Each module is self-contained with try/catch so nothing kills everything else
// ==========================================================================

// ==========================================================================
// MODULE 0: Animated Gradient Orb Background
// Pure Canvas 2D — runs immediately, no dependencies, no failures
// ==========================================================================
(function initOrbCanvas() {
  try {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.id = 'bg-canvas';
    bgCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.prepend(bgCanvas);
    const ctx = bgCanvas.getContext('2d');

    let W = bgCanvas.width = window.innerWidth;
    let H = bgCanvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      W = bgCanvas.width = window.innerWidth;
      H = bgCanvas.height = window.innerHeight;
    });

    const orbs = [
      { x: 0.15, y: 0.20, r: 0.55, c: [226, 237, 230], a: 0.55, sx: 0.18, sy: 0.10, ph: 0 },
      { x: 0.85, y: 0.15, r: 0.48, c: [213, 206, 196], a: 0.45, sx: 0.13, sy: 0.09, ph: Math.PI },
      { x: 0.50, y: 0.65, r: 0.60, c: [226, 237, 230], a: 0.38, sx: 0.10, sy: 0.15, ph: Math.PI / 2 },
      { x: 0.20, y: 0.80, r: 0.42, c: [213, 206, 196], a: 0.42, sx: 0.09, sy: 0.12, ph: Math.PI * 1.5 },
      { x: 0.78, y: 0.50, r: 0.44, c: [247, 245, 238], a: 0.60, sx: 0.14, sy: 0.08, ph: Math.PI * 0.7 },
      { x: 0.40, y: 0.35, r: 0.38, c: [226, 237, 230], a: 0.32, sx: 0.16, sy: 0.11, ph: Math.PI * 1.2 },
    ];

    const start = performance.now();
    let rawMX = 0.5, rawMY = 0.5, sMX = 0.5, sMY = 0.5;

    document.addEventListener('mousemove', (e) => {
      rawMX = e.clientX / window.innerWidth;
      rawMY = e.clientY / window.innerHeight;
    });

    function draw(now) {
      const t = (now - start) / 1000;
      sMX += (rawMX - sMX) * 0.04;
      sMY += (rawMY - sMY) * 0.04;
      const px = (sMX - 0.5) * 0.08;
      const py = (sMY - 0.5) * 0.08;

      ctx.clearRect(0, 0, W, H);
      orbs.forEach((o, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        const cx = (o.x + Math.sin(t * o.sx + o.ph) * 0.18 + px * dir * 0.6) * W;
        const cy = (o.y + Math.cos(t * o.sy + o.ph) * 0.13 + py * dir * 0.6) * H;
        const r  = o.r * Math.min(W, H);
        const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0,   `rgba(${o.c},${o.a})`);
        g.addColorStop(0.5, `rgba(${o.c},${o.a * 0.3})`);
        g.addColorStop(1,   `rgba(${o.c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  } catch(e) { console.warn('[FLUX] Orb canvas failed:', e); }
})();

// ==========================================================================
// Wait for DOM — then initialize the rest
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // MODULE 1: Custom Cursor
  // =========================================================================
  try {
    const cursor = document.getElementById('customCursor');
    if (cursor) {
      let mX = 0, mY = 0, cX = 0, cY = 0;
      document.addEventListener('mousemove', e => { mX = e.clientX; mY = e.clientY; });
      (function trackCursor() {
        cX += (mX - cX) * 0.15;
        cY += (mY - cY) * 0.15;
        cursor.style.transform = `translate(${cX}px, ${cY}px)`;
        requestAnimationFrame(trackCursor);
      })();
      document.querySelectorAll('a, button, .bento-card, .step-content, .audio-play-btn').forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
      });
    }
  } catch(e) { console.warn('[FLUX] Cursor failed:', e); }

  // =========================================================================
  // MODULE 2: Magnetic Buttons — physics pull on hover
  // =========================================================================
  try {
    document.querySelectorAll('.magnetic-btn').forEach(btn => {
      const span = btn.querySelector('span');
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.35}px, ${y * 0.35}px)`;
        if (span) span.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        btn.style.transform = 'translate(0,0)';
        if (span) { span.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'; span.style.transform = 'translate(0,0)'; }
        setTimeout(() => { btn.style.transition = ''; if (span) span.style.transition = ''; }, 800);
      });
    });
  } catch(e) { console.warn('[FLUX] Magnetic buttons failed:', e); }

  // =========================================================================
  // MODULE 3: 3D Tilt Cards
  // =========================================================================
  try {
    document.querySelectorAll('.tilt-card').forEach(card => {
      card.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const rX = ((y - r.height / 2) / r.height) * -8;
        const rY = ((x - r.width  / 2) / r.width)  *  8;
        card.style.transform = `perspective(1000px) rotateX(${rX}deg) rotateY(${rY}deg) scale(1.02)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      });
    });
  } catch(e) { console.warn('[FLUX] Tilt cards failed:', e); }

  // =========================================================================
  // MODULE 4: GSAP ScrollTrigger Animations
  // =========================================================================
  try {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);

      // 4.1 Hero dashboard reveal
      const heroImg = document.querySelector('.hero-image-container');
      if (heroImg) {
        gsap.timeline({
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        }).to(heroImg, {
          clipPath: 'inset(0 0% 0 0% round 0px)',
          ease: 'none'
        });
      }

      // 4.2 Statement words mask-reveal on scroll
      const words = gsap.utils.toArray('.statement-word');
      if (words.length) {
        gsap.set(words, { opacity: 0.15 });
        gsap.to(words, {
          opacity: 1,
          stagger: 0.05,
          scrollTrigger: { trigger: '.statement', start: 'top 75%', end: 'center 30%', scrub: 1 }
        });
      }

      // 4.3 Bento cards staggered lift-in
      const cards = gsap.utils.toArray('.bento-card');
      if (cards.length) {
        gsap.from(cards, {
          y: 100, opacity: 0, rotateY: -10, scale: 0.96,
          duration: 1.2, stagger: 0.12, ease: 'power4.out',
          scrollTrigger: { trigger: '.bento-grid', start: 'top 80%', toggleActions: 'play none none none' }
        });
      }

      // 4.4 Timeline step slide-in (How It Works page)
      gsap.utils.toArray('.step').forEach(step => {
        gsap.timeline({
          scrollTrigger: { trigger: step, start: 'top 82%', toggleActions: 'play none none none' }
        })
        .from(step, { opacity: 0, x: -50, duration: 0.7, ease: 'power3.out' })
        .from(step.querySelector('.step-number'), { scale: 0, duration: 0.5, ease: 'back.out(2)' }, '-=0.5')
        .from(step.querySelector('.step-content'), { y: 40, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4');
      });

      // 4.5 Section headers fade-up
      gsap.utils.toArray('.section-header, .page-header h1, .page-header p').forEach(el => {
        gsap.from(el, {
          y: 50, opacity: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
        });
      });

      // 4.6 Bento icon entrance bounce
      gsap.utils.toArray('.bento-icon').forEach((icon, i) => {
        gsap.from(icon, {
          scale: 0, rotation: -15, duration: 0.6, ease: 'back.out(2)',
          delay: i * 0.08,
          scrollTrigger: { trigger: icon, start: 'top 85%', toggleActions: 'play none none none' }
        });
      });

      // 4.7 Tag pills pop-in
      gsap.utils.toArray('.tag').forEach((tag, i) => {
        gsap.from(tag, {
          scale: 0, opacity: 0, duration: 0.4, ease: 'back.out(2)',
          delay: i * 0.04,
          scrollTrigger: { trigger: tag, start: 'top 90%', toggleActions: 'play none none none' }
        });
      });

    } else {
      console.warn('[FLUX] GSAP not loaded — scroll animations skipped. Will use CSS fallback.');
      // CSS fallback: just make everything visible
      document.querySelectorAll('.bento-card, .step, .statement-word').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }
  } catch(e) {
    console.warn('[FLUX] GSAP animations failed:', e);
    document.querySelectorAll('.bento-card, .step, .statement-word').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  // =========================================================================
  // MODULE 5: Navbar scroll shrink
  // =========================================================================
  try {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          navbar.style.padding = '1rem 4vw';
          navbar.style.background = 'rgba(247, 245, 238, 0.95)';
        } else {
          navbar.style.padding = '1.5rem 4vw';
          navbar.style.background = 'rgba(247, 245, 238, 0.8)';
        }
      }, { passive: true });
    }
  } catch(e) { console.warn('[FLUX] Navbar scroll failed:', e); }

  // =========================================================================
  // MODULE 6: Spline 3D scene — hide logo watermark
  // =========================================================================
  try {
    document.querySelectorAll('spline-viewer').forEach(viewer => {
      const hideLogo = () => {
        if (viewer.shadowRoot) {
          let style = viewer.shadowRoot.querySelector('#flux-hide');
          if (!style) {
            style = document.createElement('style');
            style.id = 'flux-hide';
            style.textContent = `#logo, .logo, a[href*="spline.design"] { display:none!important; opacity:0!important; pointer-events:none!important; }`;
            viewer.shadowRoot.appendChild(style);
          }
        }
      };
      hideLogo();
      viewer.addEventListener('load', hideLogo);
      setTimeout(hideLogo, 800);
    });
  } catch(e) { console.warn('[FLUX] Spline cleanup failed:', e); }

  // =========================================================================
  // MODULE 7: Animate terminal lines sequentially (typing effect)
  // =========================================================================
  try {
    document.querySelectorAll('.terminal-line').forEach((line, i) => {
      line.style.opacity = '0';
      setTimeout(() => {
        line.style.transition = 'opacity 0.4s ease';
        line.style.opacity = '1';
      }, 200 + i * 600);
    });
  } catch(e) { console.warn('[FLUX] Terminal animation failed:', e); }

  // =========================================================================
  // MODULE 8: Wave bars pulsing (audio widget)
  // =========================================================================
  try {
    document.querySelectorAll('.wave-bar').forEach((bar, i) => {
      const heights = [30, 50, 75, 90, 60, 40, 70, 85, 45, 25];
      bar.style.height = heights[i % heights.length] + '%';
      bar.style.animation = `bounce-wave ${0.8 + Math.random() * 0.8}s ${i * 0.08}s infinite ease-in-out alternate`;
    });
  } catch(e) { console.warn('[FLUX] Wave bars failed:', e); }

});
