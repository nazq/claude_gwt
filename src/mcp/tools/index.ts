/**
 * MCP Tool Registry for Claude GWT
 * Registers all available tools for the MCP server
 */

import { branchTools } from '../handlers/branch.js';
import { claudeTools } from '../handlers/claude.js';
import { sessionTools } from '../handlers/session.js';
import { worktreeTools } from '../handlers/worktree.js';
import type { MCPToolDefinition } from '../types/index.js';

export function registerTools(): MCPToolDefinition[] {
  const tools: MCPToolDefinition[] = [];

  // Register worktree management tools
  tools.push(...worktreeTools());

  // Register session management tools
  tools.push(...sessionTools());

  // Register branch operation tools
  tools.push(...branchTools());

  // Register Claude control tools
  tools.push(...claudeTools());

  return tools;
}
