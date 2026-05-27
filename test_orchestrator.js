/**
 * ============================================================
 * AGENT ZERO — ORCHESTRATOR SMOKE TEST
 * ============================================================
 * Quick test to verify the orchestrator pipeline works end-to-end.
 * Run: node test_orchestrator.js
 *
 * Requires:
 *   - Person C's Memory API on port 3001 (or will gracefully degrade)
 *   - Person B's Tools API on port 3000 (or will gracefully degrade)
 *   - GEMINI_API_KEY and GROQ_API_KEY in .env
 * ============================================================
 */

require('dotenv').config();
const { processInput } = require('./orchestrator/index');

const testCases = [
  {
    name: 'Research Query',
    input: 'What are the latest trends in agentic AI for 2026?',
    expectedAgent: 'research'
  },
  {
    name: 'Action Request',
    input: 'Send an email to test@example.com with subject "Hello from Agent Zero" and body "This is a test"',
    expectedAgent: 'action'
  },
  {
    name: 'Memory Query',
    input: 'What did I tell you about my preferences earlier?',
    expectedAgent: 'research'  // memory queries route through research
  }
];

async function runTests() {
  console.log('\n⚡ AGENT ZERO — Orchestrator Test Suite\n');
  console.log('='.repeat(60));

  for (const test of testCases) {
    console.log(`\n🧪 Test: ${test.name}`);
    console.log(`   Input: "${test.input}"`);
    console.log('-'.repeat(60));

    try {
      const result = await processInput({
        userInput: test.input,
        sessionId: `test-${Date.now()}`,
        userId: 'test-user'
      });

      const agentMatch = result.agent === test.expectedAgent ? '✅' : '⚠️';
      console.log(`   ${agentMatch} Agent: ${result.agent} (expected: ${test.expectedAgent})`);
      console.log(`   📊 Confidence: ${result.confidence}/100`);
      console.log(`   ⏱️  Total time: ${result.performance.totalMs}ms`);
      console.log(`   📝 Response preview: ${result.response.substring(0, 120)}...`);

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Tests complete.\n');
}

runTests().catch(console.error);
