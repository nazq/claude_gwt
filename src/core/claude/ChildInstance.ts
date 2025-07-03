import { spawn } from 'child_process';
import { ClaudeInstance } from './ClaudeInstance';
import type { Message } from '../../types';
import { ClaudeInstanceError } from '../errors/CustomErrors';
import { theme } from '../../cli/ui/theme';

export class ChildInstance extends ClaudeInstance {
  constructor(worktreePath: string, branch: string, parentId: string) {
    super({
      worktreePath,
      branch,
      type: 'child',
      status: 'idle',
      parentId,
    });
  }
  
  async start(): Promise<void> {
    if (this.process) {
      throw new ClaudeInstanceError('Child instance already running', this.id);
    }
    
    this.setStatus('active');
    
    try {
      this.process = spawn('claude', ['chat'], {
        cwd: this.worktreePath,
        env: {
          ...process.env,
          CLAUDE_GWT_ROLE: 'child',
          CLAUDE_GWT_ID: this.id,
          CLAUDE_GWT_BRANCH: this.branch,
          CLAUDE_GWT_PARENT_ID: this.config.parentId,
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
      
      // Send initial context to child
      await this.sendInitialContext();
      
    } catch (error) {
      this.setStatus('error');
      throw new ClaudeInstanceError(
        `Failed to start child instance: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      throw new ClaudeInstanceError('Child instance not running', this.id);
    }
    
    const messageStr = JSON.stringify(message) + '\n';
    this.process.stdin.write(messageStr);
  }
  
  private async sendInitialContext(): Promise<void> {
    const context = `
${theme.secondary('=== CLAUDE GWT CHILD INSTANCE ===')}

You are a child Claude instance working on a specific Git worktree.

${theme.bold('Your Role:')}
- Work on tasks specific to your branch
- Communicate with the master instance
- Report progress and results
- Request help or resources when needed

${theme.bold('Current Context:')}
- Branch: ${theme.branch(this.branch)}
- Path: ${this.worktreePath}
- Instance ID: ${this.id}
- Parent ID: ${this.config.parentId}

${theme.bold('Communication:')}
- All messages to master should be prefixed with [TO_MASTER]
- Messages from master will be prefixed with [FROM_MASTER]
- You can request coordination with other children through the master

${theme.bold('Focus Area:')}
Work independently on your branch's tasks while maintaining communication
with the master for coordination and status updates.
`;
    
    if (this.process && this.process.stdin) {
      this.process.stdin.write(context);
    }
  }
}