'use client';

import React from 'react';

interface RagDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RagDrawer({ isOpen, onClose }: RagDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-96 bg-surface border-l border-border z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <span className="text-secondary">🔍</span>
            <h2 className="font-bold text-white tracking-wide">RAG Explorer</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="text-sm text-gray-400 mb-2">
            Viewing vector matches from Supabase pgvector database:
          </div>

          {/* Document 1 */}
          <div className="bg-black/30 border border-border/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-secondary">similarity: 0.92</span>
              <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded">job_desc_v1.txt</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              We are looking for a <span className="bg-secondary/30 text-white font-semibold px-1 rounded">Senior AI Engineer</span> with experience building 
              <span className="bg-primary/30 text-white font-semibold px-1 rounded ml-1">multi-agent systems</span>. 
              The ideal candidate will have strong skills in <span className="bg-secondary/30 text-white font-semibold px-1 rounded">Python</span>, 
              <span className="bg-secondary/30 text-white font-semibold px-1 rounded mx-1">TypeScript</span>, and 
              <span className="bg-primary/30 text-white font-semibold px-1 rounded">Vector Databases</span>.
            </p>
          </div>

          {/* Document 2 */}
          <div className="bg-black/30 border border-border/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-secondary">similarity: 0.87</span>
              <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded">resume_master.pdf</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Architected a scalable <span className="bg-primary/30 text-white font-semibold px-1 rounded">multi-agent system</span> 
              for autonomous job application. Developed primarily using <span className="bg-secondary/30 text-white font-semibold px-1 rounded">TypeScript</span> and 
              integrated with a <span className="bg-primary/30 text-white font-semibold px-1 rounded">Supabase pgvector</span> datastore.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
