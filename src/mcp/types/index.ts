/**
 * MCP Server Type Definitions for Claude GWT
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isSupervisor?: boolean;
  isActive?: boolean;
}

export interface SessionInfo {
  sessionName: string;
  projectName: string;
  branchName: string;
  isActive: boolean;
  isSupervisor: boolean;
  index?: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  branches: BranchInfo[];
  sessionCount: number;
}

export interface BranchInfo {
  name: string;
  worktreePath?: string;
  hasSession: boolean;
  isActive: boolean;
}

export interface MCPToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ListWorktreesArgs extends Record<string, unknown> {
  format?: 'simple' | 'detailed' | 'json';
}

export interface CreateWorktreeArgs extends Record<string, unknown> {
  branch: string;
  createBranch?: boolean;
  baseBranch?: string;
}

export interface SwitchWorktreeArgs extends Record<string, unknown> {
  target: string; // branch name or index
}

export interface ListSessionsArgs extends Record<string, unknown> {
  projectFilter?: string;
  activeOnly?: boolean;
}

export interface AttachSessionArgs extends Record<string, unknown> {
  index: string; // x.y format or simple index
}

export interface CreateSessionArgs extends Record<string, unknown> {
  branch?: string;
  supervisor?: boolean;
}

export interface KillSessionArgs extends Record<string, unknown> {
  sessionName?: string;
  index?: string;
}

export interface LaunchClaudeArgs extends Record<string, unknown> {
  supervisor?: boolean;
  branch?: string;
}

export interface SplitPaneArgs extends Record<string, unknown> {
  target?: string;
  horizontal?: boolean;
  percentage?: number;
}

export type MCPTool = Tool;

export interface MCPToolDefinition {
  tool: MCPTool;
  handler: (args: unknown) => Promise<MCPToolResponse>;
}
