'use client';

import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';

export default function LoginPage() {
  const supabase = createClient();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [linkedinUsername, setLinkedinUsername] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [oauthError, setOauthError] = useState('');

  const handleOAuthLogin = async (provider: 'google' | 'github' | 'linkedin_oidc') => {
    setOauthError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: `${window.location.origin}/dashboard` }
      });
      if (error) {
        setOauthError(`${provider} OAuth is not configured in Supabase yet. Please use "Demo Mode" below instead!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('provider') || msg.includes('client_id') || msg.includes('invalid')) {
        setOauthError(`OAuth not configured for ${provider}. Please use Demo Mode below.`);
      } else {
        window.location.href = '/dashboard';
      }
    }
  };

  const handleDemoImport = async () => {
    if (!githubUsername) return;
    setIsImporting(true);
    setImportStatus('🔍 Connecting to GitHub API...');
    try {
      // Brief delay so user sees the first status
      setTimeout(() => setImportStatus('📦 Deep-scraping repos, READMEs, and activity...'), 800);
      setTimeout(() => setImportStatus('🤖 AI is analyzing and organizing career data...'), 2500);

      const res = await fetch('/api/demo/import-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUsername, linkedinUsername })
      });

      if (res.ok) {
        const data = await res.json();
        const count = data.milestones?.length || 0;
        setImportStatus(`✅ AI organized ${count} career facts! Loading dashboard...`);

        // Store so dashboard picks up instantly without waiting for Mem0 re-fetch
        if (data.milestones && data.milestones.length > 0) {
          sessionStorage.setItem('importedMilestones', JSON.stringify(data.milestones));
          sessionStorage.setItem('importedUsername', data.username || githubUsername);
        }
        setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
      } else {
        const errText = await res.text();
        console.error('Import API error:', errText);
        setImportStatus(`⚠️ Error: ${res.status}. Check that the backend is running.`);
      }
    } catch (err) {
      console.error(err);
      setImportStatus('⚠️ Network error - make sure the orchestrator backend is running!');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(124,58,237,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/20 rounded-full blur-[120px] z-0 pointer-events-none" />

      <div className="glass-panel rounded-2xl p-8 max-w-md w-full z-10 relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">FLUX</h1>
          <p className="text-sm text-gray-400 font-mono tracking-wide">SYSTEM ACCESS PORTAL</p>
        </div>

        {showDemoModal ? (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-center text-lg">🚀 Demo Mode</h3>
            <p className="text-xs text-gray-400 text-center">Enter any public GitHub username. We will instantly scrape their real repos, projects, and languages into the AI's memory.</p>
            <input
              type="text"
              placeholder="GitHub Username (e.g., torvalds)"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              className="w-full bg-black/50 border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
              autoFocus
            />
            <input
              type="text"
              placeholder="LinkedIn Username/URL (Optional)"
              value={linkedinUsername}
              onChange={(e) => setLinkedinUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDemoImport()}
              className="w-full bg-black/50 border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary mt-2"
            />
            {importStatus && (
              <div className="text-xs text-center text-primary font-mono py-2 bg-primary/10 rounded-lg px-3">
                {importStatus}
              </div>
            )}
            <button
              onClick={handleDemoImport}
              disabled={isImporting || !githubUsername}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-bold hover:bg-primary transition-colors disabled:opacity-50 text-sm"
            >
              {isImporting ? '⏳ Importing & Building Profile...' : '📄 Import & Generate Resume'}
            </button>
            <button onClick={() => setShowDemoModal(false)} className="w-full text-xs text-gray-500 hover:text-white py-2">
              ← Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {oauthError && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-400 text-center">
                ⚠️ {oauthError}
              </div>
            )}

            <button
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center justify-center gap-3 bg-[#24292e] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#24292e]/80 transition-colors"
            >
              <span>🐙</span> Continue with GitHub
            </button>
            <button
              onClick={() => handleOAuthLogin('linkedin_oidc')}
              className="w-full flex items-center justify-center gap-3 bg-[#0a66c2] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#0a66c2]/80 transition-colors"
            >
              <span>💼</span> Continue with LinkedIn
            </button>
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 px-4 rounded-xl font-medium hover:bg-gray-100 transition-colors"
            >
              <span>🔴</span> Continue with Google
            </button>

            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
              <div className="relative flex justify-center"><span className="px-2 bg-[#0f172a] text-xs text-gray-500">OR FOR DEMO</span></div>
            </div>

            <button
              onClick={() => setShowDemoModal(true)}
              className="w-full border-2 border-primary/70 text-primary py-4 rounded-xl font-bold hover:bg-primary/10 hover:border-primary transition-all text-sm flex items-center justify-center gap-2"
            >
              🚀 Demo Mode: Import Any GitHub Profile
            </button>
            <p className="text-xs text-gray-600 text-center font-mono">No password needed · Works instantly</p>
          </div>
        )}
      </div>
    </div>
  );
}
