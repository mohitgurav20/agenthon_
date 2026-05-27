/**
 * ============================================================
 * AGENT ZERO — MCP BROKER (Model Context Protocol)
 * ============================================================
 * Exposes local OS capabilities to the Agent.
 * This includes reading files, writing files, and executing
 * basic commands dynamically during the hackathon.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class MCPBroker {
  constructor() {
    this.workspaceDir = path.resolve(process.cwd());
  }

  // Ensure path is within the workspace for basic safety (hackathon level)
  _resolveAndVerifyPath(targetPath) {
    const resolvedPath = path.resolve(this.workspaceDir, targetPath);
    if (!resolvedPath.startsWith(this.workspaceDir)) {
      throw new Error(`MCP Security Violation: Path ${resolvedPath} is outside the allowed workspace ${this.workspaceDir}`);
    }
    return resolvedPath;
  }

  /**
   * Read a file from the workspace
   */
  async readFile(filePath) {
    try {
      const safePath = this._resolveAndVerifyPath(filePath);
      const content = await fs.promises.readFile(safePath, 'utf8');
      return { success: true, path: safePath, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Write to a file in the workspace
   */
  async writeFile(filePath, content) {
    try {
      const safePath = this._resolveAndVerifyPath(filePath);
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
      await fs.promises.writeFile(safePath, content, 'utf8');
      return { success: true, path: safePath, message: 'File written successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a shell command
   */
  async executeCommand(command) {
    return new Promise((resolve) => {
      // Basic safeguard against highly destructive commands for demo purposes
      if (command.includes('rm -rf /') || command.includes('format')) {
        return resolve({ success: false, error: 'Command blocked by MCP Security' });
      }

      exec(command, { cwd: this.workspaceDir }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, exitCode: error.code, stdout, stderr });
        } else {
          resolve({ success: true, exitCode: 0, stdout, stderr });
        }
      });
    });
  }
}

// Export a singleton instance
const mcpBroker = new MCPBroker();

module.exports = mcpBroker;
