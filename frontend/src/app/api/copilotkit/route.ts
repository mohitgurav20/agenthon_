import { NextRequest, NextResponse } from 'next/server';

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// CopilotKit calls GET /api/copilotkit first for runtime discovery
export const GET = async () => {
  return NextResponse.json({
    status: 'ok',
    runtime: 'custom',
    version: '1.0.0',
    capabilities: ['chat'],
  });
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    // Extract last user message from CopilotKit message format
    const messages: Array<{ role: string; content: string }> = body?.messages || [];
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const userMessage = lastUserMsg?.content || '';

    // Forward to our unified orchestrator
    const orchRes = await fetch(`${ORCHESTRATOR_URL}/api/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        userId: 'agent-zero-user',
        sessionId: body?.threadId || 'copilotkit-session',
      }),
    });

    const orchData = await orchRes.json();
    const replyText =
      orchData?.response || orchData?.message || orchData?.result || 'Processing...';

    // Return OpenAI-compatible SSE stream that CopilotKit expects
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunk = `data: ${JSON.stringify({
          id: 'chatcmpl-agzero',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { role: 'assistant', content: replyText }, finish_reason: null }],
        })}\n\n`;
        controller.enqueue(encoder.encode(chunk));

        const done = `data: ${JSON.stringify({
          id: 'chatcmpl-agzero',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        })}\n\n`;
        controller.enqueue(encoder.encode(done));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[CopilotKit Route] Error:', err);
    return NextResponse.json({ error: 'Orchestrator unreachable' }, { status: 502 });
  }
};
