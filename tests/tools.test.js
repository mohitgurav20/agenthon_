/**
 * ============================================================
 * AGENT ZERO — E2E TOOLS TEST SUITE
 * ============================================================
 * Person B: Validates input/output schemas of all 12 tools.
 * Uses USE_MOCKS=true to avoid burning real API credits during CI.
 * ============================================================
 */

process.env.USE_MOCKS = 'true'; // Force mocks for tests
const tools = require('../tools');

describe('Agent Zero Tools Registry E2E Tests', () => {
  
  test('web_search tool returns mocked schema', async () => {
    const result = await tools.executeTool('web_search', { query: 'test query', maxResults: 1 });
    expect(result.success).toBe(true);
    expect(result.toolName).toBe('web_search');
    expect(result.result.mocked).toBe(true);
  });

  test('send_email tool validates payload', async () => {
    const result = await tools.executeTool('send_email', { 
      to: 'test@example.com', 
      subject: 'Test', 
      body: 'Hello' 
    });
    expect(result.success).toBe(true);
    expect(result.result.params_received.to).toBe('test@example.com');
  });

  test('skyvern_fill_form tool executes in mock mode', async () => {
    const result = await tools.executeTool('skyvern_fill_form', { 
      url: 'https://example.com', 
      prompt: 'Fill the login form' 
    });
    expect(result.success).toBe(true);
    expect(result.result.mocked).toBe(true);
  });

  test('rate limiter blocks execution when overloaded', async () => {
    // Deplete tokens manually by looping 55 times
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < 55; i++) {
      const res = await tools.executeTool('web_search', { query: `spam ${i}` });
      if (res.success) successCount++;
      else failCount++;
    }
    
    expect(successCount).toBeGreaterThanOrEqual(45); // Should be near 50, minus tokens used by previous tests
    expect(failCount).toBeGreaterThan(0); // The rest should fail
    
    // Test that the error message is correct
    const failRes = await tools.executeTool('web_search', { query: `spam fail` });
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('Rate limit exceeded');
  });

});
