/**
 * ============================================================
 * AGENT ZERO — TRIGGER.DEV BACKGROUND JOBS
 * ============================================================
 * Person B (Tools & Integration) ownership.
 * This is the skeleton for long-running agent tasks.
 * Person A (Orchestrator) will trigger these from their logic
 * instead of making the user wait for a loading spinner.
 * ============================================================
 */

import { logger, task, wait } from "@trigger.dev/sdk/v3";
// Import the tools registry we built in Day 2
// const tools = require('../tools');

export const longRunningAgentTask = task({
  id: "long-running-agent-task",
  // Set max duration (e.g., 5 minutes for deep research)
  maxDuration: 300, 
  run: async (payload: { userId: string, taskType: string, params: any }, { ctx }) => {
    logger.info("Starting background agent task", { payload });

    try {
      // Example integration point for Person A's logic:
      // 1. Orchestrator triggers this job.
      // 2. This job executes heavy tools (e.g., web scraping 10 pages).
      
      logger.info(`Executing tool: ${payload.taskType}`);
      
      // Simulate heavy work for the skeleton
      await wait.for({ seconds: 2 });
      
      // const result = await tools.executeTool(payload.taskType, payload.params);
      const mockResult = { success: true, message: "Heavy task completed" };

      // Example integration point for Person C's logic:
      // 3. Save result to Supabase agent_outputs table here
      
      logger.info("Task completed successfully, saving to DB");

      return mockResult;
    } catch (error: any) {
      logger.error("Agent task failed", { error: error.message });
      throw error;
    }
  },
});
