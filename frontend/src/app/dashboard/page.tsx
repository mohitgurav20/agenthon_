'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { CopilotChat } from '@copilotkit/react-ui';
import { createClient } from '@/utils/supabase/client';
import CareerCockpit from '@/components/CareerCockpit';
import RagDrawer from '@/components/RagDrawer';

type AgentOutputEvent = Record<string, unknown> & {
  timestamp?: string | number;
  localTimestamp?: number;
  output?: string;
  input?: string;
};

export default function DashboardPage() {
  const [liveEvents, setLiveEvents] = useState<AgentOutputEvent[]>([]);
  const [chatMode, setChatMode] = useState<'copilot' | 'cockpit'>('copilot');
  const [ragOpen, setRagOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to realtime changes on agent_outputs table
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_outputs',
        },
        (payload) => {
          setLiveEvents((prev) => [
            { ...(payload.new as Record<string, unknown>), localTimestamp: Date.now() }, 
            ...prev
          ].slice(0, 10)); // Keep last 10
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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
          <button 
            onClick={() => setRagOpen(true)}
            className="px-3 py-1 text-xs font-mono rounded bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 transition-colors"
          >
            🔍 RAG Explorer
          </button>
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
        <aside className="w-80 border-r border-border glass-panel flex flex-col z-10">
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
            {liveEvents.length === 0 ? (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-gray-300">
                <span className="text-xs font-mono text-primary block mb-1">waiting</span>
                Listening to Supabase Realtime on &apos;agent_outputs&apos;...
              </div>
            ) : (
              <div className="space-y-3">
                {liveEvents.map((ev, i) => (
                  <div key={i} className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm text-gray-200">
                    <span className="text-xs font-mono text-primary block mb-1">
                      {new Date(ev.timestamp || ev.localTimestamp || 0).toLocaleTimeString()}
                    </span>
                    {ev.output || ev.input || "New event received"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center: CopilotKit / Agent Chat Area */}
        <section className="flex-1 flex flex-col bg-background/50 relative">
          <div className="absolute inset-0 pointer-events-none opacity-5 z-0" style={{
            backgroundImage: 'radial-gradient(circle at center, #7c3aed 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
          
          <div className="flex-1 overflow-hidden flex flex-col z-10 p-6">
            
            {/* Mode Toggle */}
            <div className="flex justify-center mb-6">
              <div className="bg-black/40 border border-border rounded-full p-1 flex gap-1">
                <button 
                  onClick={() => setChatMode('copilot')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${chatMode === 'copilot' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Agent Chat
                </button>
                <button 
                  onClick={() => setChatMode('cockpit')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${chatMode === 'cockpit' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Career Cockpit
                </button>
              </div>
            </div>

            <div className="bg-surface/90 backdrop-blur-md border border-border rounded-2xl overflow-hidden h-full shadow-[0_0_30px_rgba(124,58,237,0.15)] flex flex-col">
              {chatMode === 'copilot' ? (
                <div className="flex-1 relative copilot-custom-wrapper">
                  <CopilotChat
                    instructions="You are Agent Zero, an advanced Orchestrator Agent. Provide concise, professional responses. You have access to Supabase memory, Tavily search, and browser automation tools."
                    labels={{
                      title: "Orchestrator Agent",
                      initial: "Initializing sequence complete. All systems online. Awaiting command...",
                    }}
                  />
                </div>
              ) : (
                <CareerCockpit />
              )}
            </div>
          </div>
        </section>

      </main>

      <RagDrawer isOpen={ragOpen} onClose={() => setRagOpen(false)} />
    </div>
  );
}
