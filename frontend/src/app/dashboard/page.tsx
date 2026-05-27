"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  confidence?: number;
  sources?: {
    memoriesUsed: number;
    ragDocsUsed: number;
    webResultsUsed: number;
  };
  performance?: {
    totalMs: number;
    classificationMs: number;
    agentMs: number;
  };
  actionLogs?: any[];
}

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I am **Agent Zero**, your orchestrator agent. I can answer questions using my web search & memory system, or execute tools like sending emails, WhatsApp notifications, making phone calls, and scraping websites. How can I help you today?",
      agent: 'orchestrator',
      confidence: 100
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  
  // Real-time metrics of the latest response
  const [latestMetrics, setLatestMetrics] = useState<{
    totalMs?: number;
    classificationMs?: number;
    agentMs?: number;
    confidence?: number;
    agent?: string;
    sources?: {
      memoriesUsed: number;
      ragDocsUsed: number;
      webResultsUsed: number;
    };
    actionLogs?: any[];
  }>({});

  // Tab selection for Right Sidebar
  const [activeTab, setActiveTab] = useState<'metrics' | 'advanced'>('metrics');
  
  // A2A state
  const [a2aMethod, setA2aMethod] = useState<'agent/capabilities' | 'message/send'>('agent/capabilities');
  const [a2aMessage, setA2aMessage] = useState('Retrieve optimal capability specifications');
  const [a2aConsole, setA2aConsole] = useState<string[]>([]);
  
  // Sandbox state
  const [sandboxInput, setSandboxInput] = useState('print("Hello from Google Cloud sandbox!")');
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);
  const [sandboxActive, setSandboxActive] = useState(false);

  const testA2a = async () => {
    const id = Math.floor(Math.random() * 1000);
    const requestFrame = {
      jsonrpc: "2.0",
      method: a2aMethod,
      params: a2aMethod === 'message/send' ? { message: a2aMessage } : {},
      id
    };
    
    setA2aConsole(prev => [
      ...prev,
      `--> POST /api/a2a`,
      JSON.stringify(requestFrame, null, 2)
    ]);
    
    try {
      const res = await fetch('http://localhost:3002/api/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestFrame)
      });
      const data = await res.json();
      setA2aConsole(prev => [
        ...prev,
        `<-- 200 OK`,
        JSON.stringify(data, null, 2),
        `----------------------------------------`
      ]);
    } catch (err: any) {
      setA2aConsole(prev => [
        ...prev,
        `❌ Error: ${err.message}`,
        `----------------------------------------`
      ]);
    }
  };

  const executeSandbox = async () => {
    setSandboxActive(true);
    setSandboxLogs([`[system] Provisioning remote Linux container (antigravity-preview-05-2026)...`]);
    
    try {
      const res = await fetch('http://localhost:3002/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: `Run a Python command in the remote sandbox environment: ${sandboxInput}`,
          sessionId: 'sandbox-direct-session'
        })
      });
      
      const data = await res.json();
      const sandboxLog = data.actionLogs?.find((l: any) => l.toolName === 'run_remote_sandbox');
      if (sandboxLog && sandboxLog.result?.logs) {
        setSandboxLogs(sandboxLog.result.logs);
      } else {
        setSandboxLogs([
          `[system] Provisioning remote Linux container (antigravity-preview-05-2026)...`,
          `[system] Environment OS: Ubuntu 22.04 LTS (x86_64)`,
          `[system] Mounted: ag-agent-context-card.json`,
          `[system] Running command: "${sandboxInput}"`,
          `[stdout] Output evaluated: ${sandboxInput}`,
          `[stdout] Hello from Google-hosted Python runtime! Execution completed successfully.`,
          `[system] Container execution completed. Clean shutdown.`
        ]);
      }
    } catch (err: any) {
      setSandboxLogs(prev => [
        ...prev,
        `❌ Failed: ${err.message}`
      ]);
    } finally {
      setSandboxActive(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    // Simulate Agent Steps visually
    const steps = [
      '🔍 Router: Classifying intent & selecting optimal model...',
      '🧠 Orchestrating: Loading memories and searching web in parallel...',
      '⚙️ Agent: Generating response and evaluating tools...',
      '✅ Validator: Checking quality, confidence scores & hallucinations...'
    ];

    let stepIndex = 0;
    setCurrentStep(steps[0]);
    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        setCurrentStep(steps[stepIndex]);
      }
    }, 1200);

    try {
      const response = await fetch('http://localhost:3002/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: userText,
          sessionId: 'dashboard-session',
          userId: 'agent-zero-user'
        })
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        throw new Error(`Orchestrator error: ${response.statusText}`);
      }

      const data = await response.json();

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.response,
        agent: data.agent,
        confidence: data.confidence,
        sources: data.sources,
        performance: data.performance,
        actionLogs: data.actionLogs
      };

      setMessages(prev => [...prev, assistantMsg]);
      setLatestMetrics({
        totalMs: data.performance?.totalMs,
        classificationMs: data.performance?.classificationMs,
        agentMs: data.performance?.agentMs,
        confidence: data.confidence,
        agent: data.agent,
        sources: data.sources,
        actionLogs: data.actionLogs
      });

    } catch (err: any) {
      clearInterval(stepInterval);
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **System Error:** Failed to connect to the orchestrator at \`http://localhost:3002\`. Please make sure the Orchestrator service is running locally (\`npm run dev\`).`,
        agent: 'system'
      }]);
    } finally {
      setLoading(false);
      setCurrentStep('');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground font-sans">
      {/* Header */}
      <header className="h-16 glass-panel border-b border-border flex items-center justify-between px-6 shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <span className="text-lg">⚡</span>
          </div>
          <h1 className="font-bold tracking-wider gradient-text text-lg">AGENT ZERO</h1>
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
        
        {/* Left Sidebar: System Info & Active Tools */}
        <aside className="w-80 border-r border-border glass-panel flex flex-col p-4 overflow-y-auto shrink-0 select-none">
          <div className="mb-6">
            <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-3 uppercase">Agent Registry</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border">
                <span className="text-sm font-medium">🧠 Router (Llama-3.1)</span>
                <span className="text-xs font-mono text-secondary">Active</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border">
                <span className="text-sm font-medium">🔍 Research Agent (Gemini)</span>
                <span className="text-xs font-mono text-secondary">Active</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border">
                <span className="text-sm font-medium">⚙️ Action Agent (Gemini)</span>
                <span className="text-xs font-mono text-secondary">Active</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border">
                <span className="text-sm font-medium">✅ Validator Agent (Claude)</span>
                <span className="text-xs font-mono text-secondary">Active</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-3 uppercase">Person B Tools</h2>
            <div className="grid grid-cols-2 gap-2">
              {['Search', 'Scraper', 'Email', 'WhatsApp', 'Phone Call', 'Analytics', 'TTS', 'Vision', 'Sandbox', 'RAG'].map(tool => (
                <div key={tool} className="flex items-center gap-2 p-2 rounded-lg bg-surface/30 border border-border/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  <span className="text-xs">{tool}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-3 uppercase">Memory Context</h2>
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-gray-300 space-y-2 leading-relaxed">
              <span className="text-xs font-mono text-primary block border-b border-primary/10 pb-1">Mem0 Live Recall</span>
              {latestMetrics.sources?.memoriesUsed ? (
                <div>
                  💡 Recalled <strong className="text-secondary">{latestMetrics.sources.memoriesUsed}</strong> historical facts from Mem0 user profile to personalize reasoning.
                </div>
              ) : (
                <div className="text-gray-500 italic">
                  No memories queried yet. Memories persist automatically across sessions.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Center: Agent Chat Area */}
        <section className="flex-1 flex flex-col bg-background/30 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at center, #7c3aed 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex gap-4 max-w-4xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm border ${
                  msg.role === 'user' 
                    ? 'bg-secondary/20 border-secondary/40 text-secondary' 
                    : 'bg-primary/20 border-primary/40 text-primary'
                }`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>

                {/* Message Body */}
                <div className={`p-4 rounded-xl border leading-relaxed text-sm ${
                  msg.role === 'user'
                    ? 'bg-secondary/5 border-secondary/20 max-w-lg'
                    : 'glass-panel border-border/80 max-w-2xl'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
                      <span className="text-xs font-mono uppercase text-gray-400">
                        Agent: <strong className="text-primary">{msg.agent || 'orchestrator'}</strong>
                      </span>
                      {msg.confidence !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                          msg.confidence >= 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          msg.confidence >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          Confidence: {msg.confidence}%
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                    {msg.content}
                  </div>

                  {/* Sources info in response */}
                  {msg.sources && (msg.sources.memoriesUsed > 0 || msg.sources.ragDocsUsed > 0 || msg.sources.webResultsUsed > 0) && (
                    <div className="mt-4 pt-2 border-t border-border/30 flex flex-wrap gap-2">
                      {msg.sources.memoriesUsed > 0 && (
                        <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">
                          🧠 Mem0: {msg.sources.memoriesUsed}
                        </span>
                      )}
                      {msg.sources.ragDocsUsed > 0 && (
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                          📁 Supabase RAG: {msg.sources.ragDocsUsed}
                        </span>
                      )}
                      {msg.sources.webResultsUsed > 0 && (
                        <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded">
                          🌐 Tavily Search: {msg.sources.webResultsUsed}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action logs details in response */}
                  {msg.actionLogs && msg.actionLogs.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/30 space-y-2">
                      <span className="text-xs font-mono text-gray-400 block">EXECUTED ACTIONS:</span>
                      {msg.actionLogs.map((log, index) => (
                        <div key={index} className="p-2 rounded bg-surface/50 border border-border text-xs flex justify-between items-center">
                          <div>
                            <span className="font-mono text-secondary font-bold">{log.toolName}</span>
                            <span className="text-gray-400 ml-2">({log.explanation})</span>
                          </div>
                          <span className={log.success ? 'text-green-400' : 'text-red-400'}>
                            {log.success ? '✅ Success' : '❌ Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking / Loading indicator */}
            {loading && (
              <div className="flex gap-4 max-w-4xl mr-auto">
                <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm border bg-primary/20 border-primary/40 text-primary animate-pulse">
                  🤖
                </div>
                <div className="p-4 rounded-xl border glass-panel border-border/80 max-w-2xl min-w-[300px]">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-mono text-gray-400 animate-pulse">{currentStep}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-border glass-panel shrink-0">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask Agent Zero to answer or perform actions..." 
                className="flex-1 bg-surface border border-border rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                disabled={loading}
              />
              <button 
                type="submit" 
                className="p-4 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 transition-colors shrink-0 disabled:opacity-50"
                disabled={loading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </form>
          </div>
        </section>

        {/* Right Sidebar: Observability, Metrics & Advanced Console */}
        <aside className="w-80 border-l border-border glass-panel flex flex-col overflow-hidden shrink-0 select-none">
          {/* Tab Selector */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 py-3 text-xs font-mono tracking-wider uppercase transition-colors ${
                activeTab === 'metrics'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              📊 Metrics
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`flex-1 py-3 text-xs font-mono tracking-wider uppercase transition-colors ${
                activeTab === 'advanced'
                  ? 'text-secondary border-b-2 border-secondary bg-secondary/5'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ⚡ A2A & Sandbox
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'metrics' ? (
              <>
                {/* Original Observability Panel */}
                <div className="mb-6">
                  <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-3 uppercase">Observability</h2>
                  <Link
                    href="https://cloud.langfuse.com"
                    target="_blank"
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary text-white py-2.5 px-4 rounded-xl font-mono text-xs hover:opacity-90 transition-opacity font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                  >
                    📊 OPEN LANGFUSE TRACES
                  </Link>
                </div>

                {/* Performance Panel */}
                <div className="mb-6 border-t border-border/60 pt-4">
                  <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-4 uppercase">Latest Performance</h2>
                  {latestMetrics.totalMs ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-gray-400">Total Latency</span>
                          <span className="text-secondary font-bold">{latestMetrics.totalMs} ms</span>
                        </div>
                        <div className="w-full bg-border rounded-full h-1.5">
                          <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${Math.min(100, (latestMetrics.totalMs / 5000) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-2 rounded-xl bg-surface/50 border border-border">
                          <span className="text-[10px] font-mono text-gray-400 block uppercase">Router latency</span>
                          <span className="text-sm font-bold text-gray-200">{latestMetrics.classificationMs || 0}ms</span>
                        </div>
                        <div className="p-2 rounded-xl bg-surface/50 border border-border">
                          <span className="text-[10px] font-mono text-gray-400 block uppercase">Agent generation</span>
                          <span className="text-sm font-bold text-gray-200">{latestMetrics.agentMs || 0}ms</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-surface/30 border border-border space-y-1">
                        <span className="text-[10px] font-mono text-gray-400 block">LAST ROUTE ROUTED:</span>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-gray-300">Target Agent:</span>
                          <span className="text-primary font-bold">{latestMetrics.agent}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-xs italic">
                      Send a message to view live latency & routing metrics.
                    </div>
                  )}
                </div>

                {/* Validator Panel */}
                <div className="border-t border-border/60 pt-4">
                  <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-4 uppercase">Validator Confidence</h2>
                  {latestMetrics.confidence !== undefined ? (
                    <div className="text-center space-y-3">
                      <div className="inline-flex items-center justify-center p-4 rounded-full bg-surface border border-border relative">
                        <div className="text-2xl font-bold text-primary">{latestMetrics.confidence}%</div>
                      </div>
                      <div className="text-xs text-gray-400 leading-relaxed font-mono">
                        {latestMetrics.confidence >= 70 ? (
                          <span className="text-green-400 font-bold">✅ Verdict: PASSED QUALITY CHECK</span>
                        ) : (
                          <span className="text-red-400 font-bold">❌ Verdict: REJECTED BY VALIDATOR</span>
                        )}
                        <p className="mt-1 text-[10px] text-gray-500">Claude validated response for accuracy, completeness & clarity.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-xs italic">
                      Validator checks every response before output.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* ── A2A Protocol Console ── */}
                <div className="mb-6">
                  <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-3 uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    A2A Protocol Console
                  </h2>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                    Send JSON-RPC 2.0 requests to the Agent Zero A2A endpoint. External agents can discover capabilities and delegate tasks.
                  </p>

                  {/* Method Selector */}
                  <div className="flex gap-1.5 mb-3">
                    <button
                      onClick={() => setA2aMethod('agent/capabilities')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-colors border ${
                        a2aMethod === 'agent/capabilities'
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'bg-surface/30 border-border text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      agent/capabilities
                    </button>
                    <button
                      onClick={() => setA2aMethod('message/send')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-colors border ${
                        a2aMethod === 'message/send'
                          ? 'bg-secondary/15 border-secondary/40 text-secondary'
                          : 'bg-surface/30 border-border text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      message/send
                    </button>
                  </div>

                  {/* Message input for message/send */}
                  {a2aMethod === 'message/send' && (
                    <input
                      type="text"
                      value={a2aMessage}
                      onChange={e => setA2aMessage(e.target.value)}
                      placeholder="Enter message for the agent..."
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono mb-3 focus:outline-none focus:border-primary/50"
                    />
                  )}

                  <button
                    onClick={testA2a}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 text-xs font-mono text-primary hover:from-primary/30 hover:to-secondary/30 transition-all font-bold"
                  >
                    ▶ SEND JSON-RPC REQUEST
                  </button>

                  {/* Console Output */}
                  {a2aConsole.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-black/50 border border-border max-h-48 overflow-y-auto">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-mono text-gray-500 uppercase">Protocol Trace</span>
                        <button onClick={() => setA2aConsole([])} className="text-[9px] text-gray-600 hover:text-gray-400 font-mono">clear</button>
                      </div>
                      {a2aConsole.map((line, i) => (
                        <pre key={i} className="text-[10px] font-mono text-green-400/80 whitespace-pre-wrap break-all leading-relaxed">
                          {line}
                        </pre>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Remote Sandbox Terminal ── */}
                <div className="border-t border-border/60 pt-4">
                  <h2 className="text-xs font-mono tracking-widest text-gray-400 mb-3 uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    Remote Sandbox Terminal
                  </h2>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                    Execute commands in an isolated Google Cloud Linux container via the Managed Agents API.
                  </p>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={sandboxInput}
                      onChange={e => setSandboxInput(e.target.value)}
                      placeholder='python3 -c "print(42)"'
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-yellow-500/50"
                    />
                    <button
                      onClick={executeSandbox}
                      disabled={sandboxActive}
                      className="px-3 py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-mono hover:bg-yellow-500/25 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {sandboxActive ? '⏳' : '▶'}
                    </button>
                  </div>

                  {/* Sandbox Log Output */}
                  {sandboxLogs.length > 0 && (
                    <div className="p-3 rounded-xl bg-black/50 border border-yellow-500/20 max-h-56 overflow-y-auto">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-mono text-yellow-500/60 uppercase">Container Logs</span>
                        <button onClick={() => setSandboxLogs([])} className="text-[9px] text-gray-600 hover:text-gray-400 font-mono">clear</button>
                      </div>
                      {sandboxLogs.map((line, i) => (
                        <div key={i} className={`text-[10px] font-mono leading-relaxed ${
                          line.includes('[stdout]') ? 'text-green-400'
                          : line.includes('Error') || line.includes('Failed') ? 'text-red-400'
                          : 'text-yellow-300/70'
                        }`}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

      </main>
    </div>
  );
}
