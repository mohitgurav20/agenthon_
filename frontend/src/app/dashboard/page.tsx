import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 glass-panel border-b border-border flex items-center justify-between px-6 shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <span className="text-lg">⚡</span>
          </div>
          <h1 className="font-bold tracking-wider gradient-text">AGENT ZERO</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-green-400">System Online</span>
          </div>
          <Link href="/login" className="text-sm font-mono text-gray-400 hover:text-white transition-colors">
            Logout
          </Link>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden relative z-0">
        
        {/* Left Sidebar: Memory & Tools */}
        <aside className="w-80 border-r border-border glass-panel flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-4">ACTIVE TOOLS (PERSON B)</h2>
            <div className="space-y-2">
              {['Web Search', 'Browser Agent', 'Database Analytics', 'Voice Synthesis'].map(tool => (
                <div key={tool} className="flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-border">
                  <span className="text-sm">{tool}</span>
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto">
            <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-4">LIVE MEMORY (PERSON C)</h2>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-gray-300">
              <span className="text-xs font-mono text-primary block mb-1">just now</span>
              Waiting for Mem0 / Supabase Realtime connection...
            </div>
          </div>
        </aside>

        {/* Center: CopilotKit / Agent Chat Area */}
        <section className="flex-1 flex flex-col bg-background/50 relative">
          <div className="absolute inset-0 pointer-events-none opacity-5" style={{
            backgroundImage: 'radial-gradient(circle at center, #7c3aed 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
          
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(124,58,237,0.15)]">
              <span className="text-2xl">🤖</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Orchestrator Agent Ready</h2>
            <p className="text-sm text-gray-400 max-w-md">
              (Person A integration point)<br/>
              Drop the CopilotKit <code>&lt;CopilotPopup /&gt;</code> or custom chat interface here. Tools are registered and waiting.
            </p>
          </div>

          {/* Input Area (Mock) */}
          <div className="p-6 border-t border-border glass-panel">
            <div className="max-w-3xl mx-auto relative">
              <input 
                type="text" 
                placeholder="Initialize agent command..." 
                className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                disabled
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors" disabled>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
