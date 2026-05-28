import { NextResponse } from 'next/server';

// CopilotKit client fetches /api/copilotkit/info for runtime discovery
export const GET = async () => {
  return NextResponse.json({
    runtime: 'custom',
    version: '1.0.0',
    agents: [
      {
        name: 'default',
        description: 'ResumeVault AI Career Agent',
      },
    ],
    actions: [],
    copilotReadable: [],
  });
};

export const POST = async () => {
  return NextResponse.json({
    runtime: 'custom',
    version: '1.0.0',
    agents: [
      {
        name: 'default',
        description: 'ResumeVault AI Career Agent',
      },
    ],
    actions: [],
    copilotReadable: [],
  });
};
