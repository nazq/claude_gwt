import { spawn } from 'child_process';
import { ClaudeInstance } from './ClaudeInstance';
import type { Message } from '../../types';
import { ClaudeInstanceError } from '../errors/CustomErrors';
import { theme } from '../../cli/ui/theme';

export class MasterInstance extends ClaudeInstance {
  private childInstances: Map<string, string> = new Map(); // childId -> worktreePath
  
  constructor(worktreePath: string, branch: string) {
    super({
      worktreePath,
      branch,
      type: 'master',
      status: 'idle',
    });
  }
  
  async start(): Promise<void> {
    if (this.process) {
      throw new ClaudeInstanceError('Master instance already running', this.id);
    }
    
    this.setStatus('active');
    
    try {
      this.process = spawn('claude', ['chat'], {
        cwd: this.worktreePath,
        env: {
          ...process.env,
          CLAUDE_GWT_ROLE: 'master',
          CLAUDE_GWT_ID: this.id,
          CLAUDE_GWT_BRANCH: this.branch,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      if (!this.process.stdout || !this.process.stderr || !this.process.stdin) {
        throw new Error('Failed to create process streams');
      }
      
      this.process.stdout.on('data', (data) => this.handleProcessData(data));
      this.process.stderr.on('data', (data) => this.handleProcessData(data));
      this.process.on('error', (error) => this.handleProcessError(error));
      this.process.on('exit', (code) => this.handleProcessExit(code));
      
      // Send initial context to master
      await this.sendInitialContext();
      
    } catch (error) {
      this.setStatus('error');
      throw new ClaudeInstanceError(
        `Failed to start master instance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.id
      );
    }
  }
  
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }
    
    return new Promise((resolve) => {
      this.process!.once('exit', () => {
        this.process = null;
        this.setStatus('idle');
        resolve();
      });
      
      this.process!.kill('SIGTERM');
      
      // Force kill after timeout
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }
  
  async sendMessage(message: Message): Promise<void> {
    if (!this.process || !this.process.stdin) {
      throw new ClaudeInstanceError('Master instance not running', this.id);
    }
    
    const messageStr = JSON.stringify(message) + '\n';
    this.process.stdin.write(messageStr);
  }
  
  registerChild(childId: string, worktreePath: string): void {
    this.childInstances.set(childId, worktreePath);
    this.emit('childRegistered', { childId, worktreePath });
  }
  
  unregisterChild(childId: string): void {
    this.childInstances.delete(childId);
    this.emit('childUnregistered', childId);
  }
  
  getChildren(): Map<string, string> {
    return new Map(this.childInstances);
  }
  
  private async sendInitialContext(): Promise<void> {
    const context = `
${theme.primary('=== CLAUDE GWT MASTER INSTANCE ===')}

You are the master Claude instance managing a Git worktree project.

${theme.bold('Your Role:')}
- Coordinate work across multiple Git worktrees
- Manage child Claude instances in different branches
- Route tasks to appropriate child instances
- Aggregate responses from children
- Maintain project-wide context

${theme.bold('Current Context:')}
- Branch: ${theme.branch(this.branch)}
- Path: ${this.worktreePath}
- Instance ID: ${this.id}

${theme.bold('Available Commands:')}
- @list - List all child instances
- @create <branch> - Create new worktree and child instance
- @send <childId|branch> <message> - Send message to specific child
- @broadcast <message> - Send message to all children
- @status - Show status of all instances

${theme.bold('Communication Protocol:')}
Messages from children will be prefixed with [CHILD:branch] for identification.
You can respond directly or route messages between children as needed.
`;
    
    if (this.process && this.process.stdin) {
      this.process.stdin.write(context);
    }
  }
}