import { EventEmitter } from 'events';
import { theme } from '../../cli/ui/theme';

// Types from Claude Code SDK
type SDKMessage = any;
type SDKUserMessage = any;
type SDKAssistantMessage = any;
type Options = any;

export interface MetaCommand {
  command: string;
  args: string[];
  raw: string;
}

export class ClaudeSessionWrapper extends EventEmitter {
  private workingDirectory: string;
  private branchName: string;
  private abortController: AbortController;
  private messageQueue: SDKUserMessage[] = [];
  private isProcessing = false;
  private sessionActive = false;
  private claudeSDK: any = null;
  
  constructor(workingDirectory: string, branchName: string) {
    super();
    this.workingDirectory = workingDirectory;
    this.branchName = branchName;
    this.abortController = new AbortController();
  }
  
  async start(): Promise<void> {
    console.log(theme.dim('\nClaude GWT Session'));
    console.log(theme.muted(`Branch: ${theme.branch(this.branchName)}`));
    console.log(theme.muted(`Directory: ${this.workingDirectory}`));
    console.log(theme.muted('Type :help for GWT commands\n'));
    
    // Dynamically import Claude Code SDK
    try {
      this.claudeSDK = await import('@anthropic-ai/claude-code');
    } catch (error) {
      console.error(theme.error('Failed to load Claude Code SDK:'), error);
      throw error;
    }
    
    // Set up input handling
    this.setupInputHandling();
    
    // Show initial prompt
    this.showPrompt();
    
    // Start the Claude session
    this.sessionActive = true;
    this.startClaudeSession();
  }
  
  private async startClaudeSession(): Promise<void> {
    if (!this.claudeSDK) {
      console.error(theme.error('Claude SDK not loaded'));
      return;
    }
    
    const options: Options = {
      abortController: this.abortController,
      cwd: this.workingDirectory,
      // Add any other options we need
    };
    
    try {
      // Create an async generator for messages
      const messageGenerator = this.createMessageGenerator();
      
      // Start the query
      const response = this.claudeSDK.query({
        prompt: messageGenerator,
        abortController: this.abortController,
        options
      });
      
      // Process responses
      for await (const message of response) {
        if (!this.sessionActive) break;
        
        this.handleClaudeMessage(message);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(theme.muted('\nSession aborted'));
      } else {
        console.error(theme.error('\nSession error:'), error);
      }
    }
  }
  
  private async *createMessageGenerator(): AsyncGenerator<SDKUserMessage> {
    while (this.sessionActive) {
      // Wait for messages
      while (this.messageQueue.length === 0 && this.sessionActive) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!this.sessionActive) break;
      
      // Yield the next message
      const message = this.messageQueue.shift();
      if (message) {
        yield message;
      }
    }
  }
  
  private handleClaudeMessage(message: SDKMessage): void {
    switch (message.type) {
      case 'assistant':
        // Assistant message contains the actual content
        const assistantMessage = message as SDKAssistantMessage;
        if (assistantMessage.message.content) {
          for (const content of assistantMessage.message.content) {
            if (content.type === 'text') {
              process.stdout.write(content.text);
            } else if (content.type === 'tool_use') {
              console.log(theme.dim(`\n[Tool: ${content.name}]`));
            }
          }
        }
        break;
        
      case 'result':
        // End of response
        this.isProcessing = false;
        console.log(''); // New line after response
        this.showPrompt();
        break;
        
      case 'system':
        // System message (init, etc)
        if (message.subtype === 'init') {
          console.log(theme.dim(`Session initialized: ${message.session_id}`));
        }
        break;
        
      case 'user':
        // User messages are echoed back, we can ignore them
        break;
    }
  }
  
  showPrompt(): void {
    if (!this.isProcessing) {
      process.stdout.write('> ');
    }
  }
  
  private setupInputHandling(): void {
    // Remove all existing listeners first
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('keypress');
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let inputBuffer = '';
    
    process.stdin.on('data', (data) => {
      const key = data.toString();
      
      // Handle special keys
      if (key === '\u0003') { // Ctrl+C
        this.shutdown();
        return;
      }
      
      if (key === '\r' || key === '\n') { // Enter
        const input = inputBuffer.trim();
        inputBuffer = '';
        
        process.stdout.write('\n');
        
        // Check if it's a meta command
        if (input.startsWith(':')) {
          this.handleMetaCommand(input);
        } else if (input.trim()) {
          // Send to Claude
          this.sendMessage(input);
        } else {
          // Empty input, just show prompt again
          this.showPrompt();
        }
      } else if (key === '\u007F') { // Backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        // Normal character
        inputBuffer += key;
        process.stdout.write(key);
      }
    });
  }
  
  private sendMessage(text: string): void {
    this.isProcessing = true;
    
    // Add message to queue
    const message: SDKUserMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: text
      },
      parent_tool_use_id: null,
      session_id: 'session-' + this.branchName // We'll use branch name as session ID
    };
    
    this.messageQueue.push(message);
    
    // Emit for tracking/intercommunication
    this.emit('user-message', text);
  }
  
  private handleMetaCommand(input: string): void {
    const parts = input.slice(1).split(' ');
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    
    const metaCommand: MetaCommand = {
      command: command || '',
      args,
      raw: input,
    };
    
    // Emit the meta command for handling
    this.emit('meta-command', metaCommand);
    
    // Handle built-in commands
    switch (command) {
      case 'h':
      case 'help':
        this.showHelp();
        break;
        
      case 'l':
      case 'list':
        this.emit('list-sessions');
        break;
        
      case 's':
      case 'select':
        if (args.length > 0) {
          this.emit('select-session', args[0]);
        } else {
          // No args means select master
          this.emit('select-session', 'supervisor');
        }
        break;
        
      case 'b':
      case 'broadcast':
        if (args.length > 0) {
          const message = args.join(' ');
          this.emit('broadcast-message', message);
        } else {
          console.log(theme.error('Usage: :b|broadcast <message>'));
        }
        break;
        
      case 'exit':
      case 'quit':
        this.emit('request-exit');
        break;
        
      default:
        console.log(theme.error(`Unknown meta-command: :${command}`));
        console.log(theme.muted('Type :help for available commands'));
    }
    
    // Show prompt again unless exiting
    if (command !== 'exit' && command !== 'quit') {
      this.showPrompt();
    }
  }
  
  private showHelp(): void {
    console.log(theme.primary('\n=== Claude GWT Meta Commands ==='));
    console.log(theme.info('\nSession Management:'));
    console.log(theme.muted('  :l, :list              - List all sessions with numbers'));
    console.log(theme.muted('  :s, :select [#|name]   - Select a session (by number or name)'));
    console.log(theme.muted('  :s, :select            - Return to supervisor (index 0)'));
    console.log(theme.info('\nMessaging:'));
    console.log(theme.muted('  :b, :broadcast <msg>   - Send message to all child sessions'));
    console.log(theme.info('\nGeneral:'));
    console.log(theme.muted('  :h, :help              - Show this help'));
    console.log(theme.muted('  :exit, :quit           - Return to branch manager'));
    console.log(theme.dim('\nRegular text is sent to Claude in the current session.\n'));
  }
  
  async shutdown(): Promise<void> {
    this.sessionActive = false;
    
    // Abort the Claude session
    this.abortController.abort();
    
    // Clean up stdin
    process.stdin.removeAllListeners('data');
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}