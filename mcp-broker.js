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
      // --- ENTERPRISE SECURITY SANDBOX ---
      // Block destructive, network, and privilege escalation commands
      const denylist = [
        /rm\s+-r/i,      // Recursive delete
        /del\s+\/s/i,    // Windows recursive delete
        /format/i,       // Disk format
        /sudo/i,         // Privilege escalation
        /curl/i,         // Network fetch (prevents reverse shells / RCE)
        /wget/i,         // Network fetch
        /nc\s+/i,        // Netcat
        /chmod\s+-R/i,   // Recursive permission change
        /chown/i         // Ownership change
      ];

      const isBlocked = denylist.some(pattern => pattern.test(command));
      
      if (isBlocked) {
        console.warn(`[MCP Security] Blocked dangerous command: ${command}`);
        return resolve({ 
          success: false, 
          error: 'Command blocked by MCP Security Sandbox (High-Risk Keyword Detected)' 
        });
      }

      console.log(`[MCP] Executing Sandbox Command: ${command}`);
      exec(command, { cwd: this.workspaceDir, timeout: 10000 }, (error, stdout, stderr) => {
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
