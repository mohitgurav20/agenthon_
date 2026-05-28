import Spline from '@splinetool/react-spline/next';

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', backgroundColor: '#0b0c0e', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', transform: 'translate(-50%, -50%) scale(3.8)', transformOrigin: 'center center', zIndex: 1 }}>
        <Spline
          scene="https://prod.spline.design/nOUBHkeBuytkOast/scene.splinecode" 
        />
      </div>
      
      {/* Brand Navigation Header Overlay */}
      <div style={{ position: 'absolute', top: '2.5rem', left: '4vw', right: '4vw', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <div style={{ width: '24px', height: '24px', position: 'relative' }}>
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <path d="M8 26V6H24" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M8 15H20" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round"/>
              <circle cx="8" cy="6" r="3.5" fill="#e2ede6"/>
            </svg>
          </div>
          <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.04em' }}>FLUX</span>
        </a>
        <a href="/login" style={{ color: '#74777b', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', transition: 'color 0.3s' }}>
          Sign In
        </a>
      </div>
      
      {/* Centered CTA Overlay */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, textAlign: 'center', width: '90%', maxWidth: '600px', pointerEvents: 'none' }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', color: '#ffffff', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '1.5rem', lineHeight: 1.1 }}>Ready to automate?</h1>
        <p style={{ fontSize: 'clamp(1rem, 1.8vw, 1.25rem)', color: '#74777b', marginBottom: '2.5rem' }}>Deploy your own Agent Zero and take back your time.</p>
        <div style={{ pointerEvents: 'auto' }}>
          <a href="/login" style={{ display: 'inline-block', padding: '1rem 2.5rem', backgroundColor: '#f7f5ee', color: '#2c2f33', borderRadius: '99px', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem', border: '1px solid rgba(44,47,51,0.1)', boxShadow: '0 10px 30px rgba(255,255,255,0.1)' }}>
            Launch FLUX
          </a>
        </div>
      </div>
    </main>
  );
}
