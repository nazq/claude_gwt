import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface Message {
  id: string;
  from: string;
  to: string[] | 'broadcast';
  type: 'task' | 'status' | 'result' | 'error';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class MessageBus extends EventEmitter {
  private basePath: string;
  private inboxPath: string;
  private outboxPath: string;
  private processedPath: string;
  private instanceId: string;
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(basePath: string, instanceId: string) {
    super();
    this.basePath = path.join(basePath, '.claude-gwt', 'messages');
    this.instanceId = instanceId;
    this.inboxPath = path.join(this.basePath, 'inbox');
    this.outboxPath = path.join(this.basePath, 'outbox');
    this.processedPath = path.join(this.basePath, 'processed');

    this.ensureDirectories();
  }

  /**
   * Ensure message directories exist
   */
  private ensureDirectories(): void {
    const dirs = [this.basePath, this.inboxPath, this.outboxPath, this.processedPath];
    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send a message
   */
  send(
    to: string[] | 'broadcast',
    type: Message['type'],
    content: string,
    metadata?: Record<string, unknown>,
  ): void {
    const message: Message = {
      id: this.generateMessageId(),
      from: this.instanceId,
      to,
      type,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };

    const filename = `${message.timestamp.replace(/[:.]/g, '-')}-${message.id}.json`;
    const filepath = path.join(this.outboxPath, filename);

    fs.writeFileSync(filepath, JSON.stringify(message, null, 2));
    this.emit('sent', message);
  }

  /**
   * Read messages from inbox
   */
  private readInbox(): Message[] {
    if (!fs.existsSync(this.inboxPath)) {
      return [];
    }

    const messages: Message[] = [];
    const files = fs
      .readdirSync(this.inboxPath)
      .filter((f) => f.endsWith('.json'))
      .sort(); // Process in chronological order

    for (const file of files) {
      try {
        const filepath = path.join(this.inboxPath, file);
        const content = fs.readFileSync(filepath, 'utf-8');
        const message = JSON.parse(content) as Message;

        // Check if message is for this instance
        if (
          message.to === 'broadcast' ||
          (Array.isArray(message.to) && message.to.includes(this.instanceId))
        ) {
          messages.push(message);

          // Move to processed
          const processedFile = path.join(this.processedPath, file);
          fs.renameSync(filepath, processedFile);
        }
      } catch (error) {
        console.error(`Error reading message ${file}:`, error);
      }
    }

    return messages;
  }

  /**
   * Start watching for messages
   */
  startWatching(intervalMs: number = 2000): void {
    if (this.watchInterval) {
      return;
    }

    this.watchInterval = setInterval(() => {
      const messages = this.readInbox();
      messages.forEach((message) => {
        this.emit('message', message);
        this.emit(message.type, message);
      });
    }, intervalMs);
  }

  /**
   * Stop watching for messages
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  /**
   * Broadcast a task to all child instances
   */
  broadcastTask(content: string, metadata?: Record<string, unknown>): void {
    this.send('broadcast', 'task', content, metadata);
  }

  /**
   * Send status update
   */
  sendStatus(content: string, metadata?: Record<string, unknown>): void {
    this.send(['supervisor'], 'status', content, metadata);
  }

  /**
   * Send result
   */
  sendResult(to: string[], content: string, metadata?: Record<string, unknown>): void {
    this.send(to, 'result', content, metadata);
  }

  /**
   * Clean up old processed messages (older than 24 hours)
   */
  cleanup(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    if (fs.existsSync(this.processedPath)) {
      const files = fs.readdirSync(this.processedPath);
      files.forEach((file) => {
        const filepath = path.join(this.processedPath, file);
        const stats = fs.statSync(filepath);
        if (stats.mtimeMs < oneDayAgo) {
          fs.unlinkSync(filepath);
        }
      });
    }
  }

  /**
   * Get all pending messages for this instance
   */
  getPendingMessages(): Message[] {
    return this.readInbox();
  }
}
