import { EventEmitter } from 'events';
import { ClaudeSessionWrapper } from './ClaudeSessionWrapper';
import { theme } from '../../cli/ui/theme';

export interface SessionInfo {
  branch: string;
  path: string;
  wrapper: ClaudeSessionWrapper;
  isActive: boolean;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionInfo> = new Map();
  
  async createSession(branch: string, path: string): Promise<ClaudeSessionWrapper> {
    // Check if session already exists
    if (this.sessions.has(branch)) {
      console.log(theme.warning(`Session for ${branch} already exists`));
      return this.sessions.get(branch)!.wrapper;
    }
    
    // Create new session wrapper
    const wrapper = new ClaudeSessionWrapper(path, branch);
    
    // Store session info
    this.sessions.set(branch, {
      branch,
      path,
      wrapper,
      isActive: true
    });
    
    // Set up event forwarding
    this.setupSessionEvents(branch, wrapper);
    
    return wrapper;
  }
  
  private setupSessionEvents(branch: string, wrapper: ClaudeSessionWrapper): void {
    // Forward events with session context
    wrapper.on('user-message', (message: string) => {
      this.emit('session-message', { branch, message });
    });
    
    wrapper.on('meta-command', (command: any) => {
      this.emit('session-meta-command', { branch, command });
    });
    
    wrapper.on('request-exit', async () => {
      await this.closeSession(branch);
    });
  }
  
  async switchSession(targetBranch: string): Promise<boolean> {
    const session = this.sessions.get(targetBranch);
    if (!session) {
      return false;
    }
    
    return true;
  }
  
  async broadcastMessage(message: string, fromBranch?: string): Promise<void> {
    const sender = fromBranch || 'supervisor';
    
    // Send to all active sessions except sender
    for (const [branch, session] of this.sessions) {
      if (branch !== sender && session.isActive) {
        // TODO: Implement actual message injection into Claude session
        console.log(theme.dim(`[${branch}] Received broadcast from ${sender}: ${message}`));
      }
    }
  }
  
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }
  
  async closeSession(branch: string): Promise<void> {
    const session = this.sessions.get(branch);
    if (session) {
      await session.wrapper.shutdown();
      session.isActive = false;
      this.sessions.delete(branch);
    }
  }
  
  async closeAllSessions(): Promise<void> {
    for (const [branch] of this.sessions) {
      await this.closeSession(branch);
    }
  }
}