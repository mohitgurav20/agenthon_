import { NextResponse } from 'next/server';

// CopilotKit client fetches /api/copilotkit/info for runtime discovery
export const GET = async () => {
  return NextResponse.json({
    version: '1.0.0',
    mode: 'sse',
    agents: {
      default: {
        name: 'default',
        className: 'BuiltInAgent',
        description: 'Default Agent'
      }
    },
    audioFileTranscriptionEnabled: false,
    endpoints: { chat: '/api/copilotkit' },
  });
};

export const POST = async () => {
  return NextResponse.json({
    version: '1.0.0',
    mode: 'sse',
    agents: {
      default: {
        name: 'default',
        className: 'BuiltInAgent',
        description: 'Default Agent'
      }
    },
    audioFileTranscriptionEnabled: false,
    endpoints: { chat: '/api/copilotkit' },
  });
};
