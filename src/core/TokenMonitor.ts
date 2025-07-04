import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { TokenTracker } from './TokenTracker';
import { Logger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface TokenInfo {
  input: number;
  output: number;
  model?: string;
}

export class TokenMonitor extends EventEmitter {
  private process: ChildProcess | null = null;
  private tracker: TokenTracker;
  private buffer: string = '';
  private currentConversation: string = '';
  private logFile: string;

  constructor(projectName: string, branch: string) {
    super();
    this.tracker = TokenTracker.getInstance();

    // Start tracking session
    this.tracker.startSession(projectName, branch);

    // Create log file for debugging
    const logDir = path.join(os.homedir(), '.claude-gwt', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFile = path.join(logDir, `token-monitor-${Date.now()}.log`);
  }

  /**
   * Start monitoring Claude process
   */
  startMonitoring(command: string, args: string[], cwd: string): ChildProcess {
    Logger.info('Starting token monitor', { command, args, cwd });

    this.process = spawn(command, args, {
      cwd,
      env: { ...process.env },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    // Monitor stdout
    if (this.process.stdout) {
      this.process.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        this.buffer += text;

        // Write to original stdout
        process.stdout.write(data);

        // Parse for token information
        this.parseTokenInfo(text);

        // Log for debugging
        fs.appendFileSync(this.logFile, `[STDOUT] ${text}`);
      });
    }

    // Monitor stderr
    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        const text = data.toString();

        // Write to original stderr
        process.stderr.write(data);

        // Log for debugging
        fs.appendFileSync(this.logFile, `[STDERR] ${text}`);
      });
    }

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      Logger.info('Claude process exited', { code, signal });
      this.emit('exit', code, signal);

      // End token tracking session
      this.tracker.endSession();
    });

    // Handle errors
    this.process.on('error', (error) => {
      Logger.error('Claude process error', error);
      this.emit('error', error);
    });

    return this.process;
  }

  /**
   * Parse Claude's output for token information
   */
  private parseTokenInfo(text: string): void {
    // Look for patterns that indicate token usage
    // These patterns are examples - you'd need to adjust based on actual Claude output

    // Pattern 1: Direct token count display
    // Example: "Tokens: 1,234 input / 567 output"
    const tokenPattern = /Tokens:\s*([0-9,]+)\s*input\s*\/\s*([0-9,]+)\s*output/i;
    const tokenMatch = text.match(tokenPattern);
    if (tokenMatch?.[1] && tokenMatch[2]) {
      const inputTokens = parseInt(tokenMatch[1].replace(/,/g, ''));
      const outputTokens = parseInt(tokenMatch[2].replace(/,/g, ''));
      this.trackTokens({ input: inputTokens, output: outputTokens });
    }

    // Pattern 2: Usage summary
    // Example: "Usage: 1234 tokens (input: 890, output: 344)"
    const usagePattern =
      /Usage:\s*[0-9,]+\s*tokens\s*\(input:\s*([0-9,]+),\s*output:\s*([0-9,]+)\)/i;
    const usageMatch = text.match(usagePattern);
    if (usageMatch?.[1] && usageMatch[2]) {
      const inputTokens = parseInt(usageMatch[1].replace(/,/g, ''));
      const outputTokens = parseInt(usageMatch[2].replace(/,/g, ''));
      this.trackTokens({ input: inputTokens, output: outputTokens });
    }

    // Pattern 3: Cost display (can infer tokens from cost)
    // Example: "Cost: $0.0123 (820 tokens)"
    const costPattern = /Cost:\s*\$([0-9.]+)\s*\(([0-9,]+)\s*tokens\)/i;
    const costMatch = text.match(costPattern);
    if (costMatch?.[2]) {
      const totalTokens = parseInt(costMatch[2].replace(/,/g, ''));
      // Estimate input/output split (typically more output than input)
      const inputTokens = Math.floor(totalTokens * 0.3);
      const outputTokens = totalTokens - inputTokens;
      this.trackTokens({ input: inputTokens, output: outputTokens });
    }

    // Pattern 4: Conversation ID
    // Example: "Conversation: abc123def456"
    const conversationPattern = /Conversation:\s*([a-zA-Z0-9]+)/i;
    const conversationMatch = text.match(conversationPattern);
    if (conversationMatch?.[1]) {
      this.currentConversation = conversationMatch[1];
    }

    // Pattern 5: Model information
    // Example: "Model: claude-3-sonnet"
    const modelPattern = /Model:\s*(claude-[a-zA-Z0-9.-]+)/i;
    const modelMatch = text.match(modelPattern);
    if (modelMatch) {
      this.emit('model', modelMatch[1]);
    }
  }

  /**
   * Track tokens with the TokenTracker
   */
  private trackTokens(info: TokenInfo): void {
    Logger.info('Tracking tokens', info);

    this.tracker.trackUsage(
      info.input,
      info.output,
      info.model ?? 'claude-3-sonnet',
      this.currentConversation || undefined,
    );

    this.emit('tokens', info);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * Create a wrapper script for Claude that includes token monitoring
   */
  static createWrapper(): string {
    const wrapperPath = path.join(os.homedir(), '.claude-gwt', 'bin', 'claude-wrapper');
    const wrapperDir = path.dirname(wrapperPath);

    if (!fs.existsSync(wrapperDir)) {
      fs.mkdirSync(wrapperDir, { recursive: true });
    }

    const wrapperContent = `#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get session info from environment or parse from tmux
const sessionName = process.env.TMUX_SESSION || '';
const parts = sessionName.split('-');
const projectName = parts[1] || 'unknown';
const branch = parts[parts.length - 1] || 'unknown';

// Log file for token tracking
const logDir = path.join(os.homedir(), '.claude-gwt', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, \`claude-\${Date.now()}.log\`);

// Start the real Claude process
const claude = spawn('claude', process.argv.slice(2), {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env }
});

let buffer = '';
let lastTokenReport = Date.now();

// Monitor stdout
claude.stdout.on('data', (data) => {
  const text = data.toString();
  buffer += text;
  process.stdout.write(data);
  
  // Log output
  fs.appendFileSync(logFile, \`[OUT] \${text}\`);
  
  // Check for token patterns every few seconds
  if (Date.now() - lastTokenReport > 5000) {
    checkForTokens(buffer);
    lastTokenReport = Date.now();
  }
});

// Monitor stderr
claude.stderr.on('data', (data) => {
  process.stderr.write(data);
  fs.appendFileSync(logFile, \`[ERR] \${data.toString()}\`);
});

// Pass through exit code
claude.on('exit', (code) => {
  process.exit(code || 0);
});

function checkForTokens(text) {
  // Look for token patterns in accumulated buffer
  const patterns = [
    /Tokens:\\s*([0-9,]+)\\s*input\\s*\\/\\s*([0-9,]+)\\s*output/gi,
    /Usage:\\s*[0-9,]+\\s*tokens\\s*\\(input:\\s*([0-9,]+),\\s*output:\\s*([0-9,]+)\\)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const input = parseInt(match[1].replace(/,/g, ''));
      const output = parseInt(match[2].replace(/,/g, ''));
      
      // Write to token file
      const tokenFile = path.join(os.homedir(), '.claude-gwt', 'usage', 'realtime-tokens.jsonl');
      const tokenData = {
        timestamp: new Date().toISOString(),
        projectName,
        branch,
        input,
        output,
        sessionName
      };
      fs.appendFileSync(tokenFile, JSON.stringify(tokenData) + '\\n');
    }
  }
}
`;

    fs.writeFileSync(wrapperPath, wrapperContent);
    fs.chmodSync(wrapperPath, '755');

    Logger.info('Created Claude wrapper script', { path: wrapperPath });
    return wrapperPath;
  }
}
