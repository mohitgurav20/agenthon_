'use client';

import React, { useState, useEffect } from 'react';

// --- Types ---
type AppStatus = 'Applied' | 'Recruiter Viewed' | 'Interview';

interface JobApp {
  id: string;
  company: string;
  role: string;
  status: AppStatus;
}

const INITIAL_JOBS: JobApp[] = [
  { id: '1', company: 'Google', role: 'Senior AI Engineer', status: 'Applied' },
  { id: '2', company: 'Stripe', role: 'Frontend Architect', status: 'Recruiter Viewed' },
  { id: '3', company: 'OpenAI', role: 'Research Engineer', status: 'Interview' },
];

export default function CareerCockpit() {
  const [jobs, setJobs] = useState<JobApp[]>(INITIAL_JOBS);
  const [score, setScore] = useState(0);

  // --- Animation Effect ---
  useEffect(() => {
    // Spin up the ATS score on mount
    const timer = setTimeout(() => setScore(95), 300);
    return () => clearTimeout(timer);
  }, []);

  // --- Kanban Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('jobId', id);
  };

  const handleDrop = (e: React.DragEvent, newStatus: AppStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('jobId');
    setJobs(jobs.map(job => (job.id === id ? { ...job, status: newStatus } : job)));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const columns: AppStatus[] = ['Applied', 'Recruiter Viewed', 'Interview'];

  // --- SVG Circle Math ---
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Section: ATS Score */}
      <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl p-6 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Resume ATS Match</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Our AI has scanned your profile against standard industry ATS rules. The vector embeddings match perfectly with high-tier tech roles.
          </p>
        </div>
        
        <div className="relative flex items-center justify-center">
          <svg className="w-24 h-24 transform -rotate-90">
            {/* Background Circle */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-800"
            />
            {/* Animated Progress Circle */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-primary transition-all duration-[1500ms] ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{score}%</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Kanban Board */}
      <div className="flex-1 flex flex-col min-h-0 bg-card/30 border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Live App Tracker</h3>
        
        <div className="flex-1 flex gap-4 overflow-x-auto pb-2">
          {columns.map(status => (
            <div
              key={status}
              onDrop={(e) => handleDrop(e, status)}
              onDragOver={handleDragOver}
              className="flex-1 min-w-[250px] bg-black/40 rounded-lg border border-border/50 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider">{status}</h4>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                  {jobs.filter(j => j.status === status).length}
                </span>
              </div>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                {jobs
                  .filter(job => job.status === status)
                  .map(job => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      className="bg-surface border border-border p-3 rounded-md cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors shadow-sm"
                    >
                      <div className="text-sm font-bold text-white truncate">{job.company}</div>
                      <div className="text-xs text-gray-400 truncate">{job.role}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
