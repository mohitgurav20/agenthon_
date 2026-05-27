import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { NextRequest } from 'next/server';

export const POST = async (req: NextRequest) => {
  // Using OpenAI adapter here as a placeholder. We will configure it to point to 
  // our preferred model provider or pass it directly. For hackathon we can use OpenAI 
  // or Langchain adapters.
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: new CopilotRuntime(),
    serviceAdapter: new OpenAIAdapter({ model: 'gpt-4o' }),
    endpoint: '/api/copilotkit',
  });

  return handleRequest(req);
};
