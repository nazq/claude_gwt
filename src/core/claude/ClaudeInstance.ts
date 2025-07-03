import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ClaudeInstanceConfig, Message } from '../../types';
import { ClaudeInstanceError } from '../errors/CustomErrors';

export abstract class ClaudeInstance extends EventEmitter {
  protected config: ClaudeInstanceConfig;
  protected process: ChildProcess | null = null;
  protected messageBuffer: string = '';
  
  constructor(config: Omit<ClaudeInstanceConfig, 'id'>) {
    super();
    this.config = {
      ...config,
      id: uuidv4(),
    };
  }
  
  get id(): string {
    return this.config.id;
  }
  
  get type(): 'master' | 'child' {
    return this.config.type;
  }
  
  get status(): ClaudeInstanceConfig['status'] {
    return this.config.status;
  }
  
  get worktreePath(): string {
    return this.config.worktreePath;
  }
  
  get branch(): string {
    return this.config.branch;
  }
  
  protected setStatus(status: ClaudeInstanceConfig['status']): void {
    this.config.status = status;
    this.emit('statusChange', status);
  }
  
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(message: Message): Promise<void>;
  
  protected handleProcessData(data: Buffer): void {
    this.messageBuffer += data.toString();
    const lines = this.messageBuffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    this.messageBuffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as Message;
          this.emit('message', message);
        } catch {
          // Not JSON, treat as raw output
          this.emit('output', line);
        }
      }
    }
  }
  
  protected handleProcessError(error: Error): void {
    this.setStatus('error');
    this.emit('error', new ClaudeInstanceError(
      `Process error: ${error.message}`,
      this.config.id
    ));
  }
  
  protected handleProcessExit(code: number | null): void {
    this.setStatus('idle');
    this.emit('exit', code);
    this.process = null;
  }
}