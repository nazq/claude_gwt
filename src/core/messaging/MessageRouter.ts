import type { ClaudeInstance } from '../claude/ClaudeInstance';
import { InstanceRegistry } from '../claude/InstanceRegistry';
import { MessageBus } from './MessageBus';
import type { Message } from '../../types';
import { MessageRoutingError } from '../errors/CustomErrors';
import { theme } from '../../cli/ui/theme';

export class MessageRouter {
  constructor(
    private messageBus: MessageBus,
    private registry: InstanceRegistry
  ) {
    this.setupRouting();
  }
  
  private setupRouting(): void {
    // Listen for instance registration
    this.registry.on('instanceRegistered', (instance: ClaudeInstance) => {
      this.setupInstanceRouting(instance);
    });
    
    // Listen for instance unregistration
    this.registry.on('instanceUnregistered', (instance: ClaudeInstance) => {
      this.messageBus.unsubscribeAll(instance.id);
    });
  }
  
  private setupInstanceRouting(instance: ClaudeInstance): void {
    // Subscribe to direct messages
    this.messageBus.on(`message:${instance.id}`, (message: Message) => {
      this.deliverMessage(instance, message);
    });
    
    // Subscribe to broadcast messages
    this.messageBus.subscribe(instance.id, `broadcast:${instance.type}`);
    this.messageBus.subscribe(instance.id, 'broadcast:all');
    
    // Handle messages from the instance
    instance.on('message', (message: Message) => {
      this.routeMessage(instance, message);
    });
    
    // Handle raw output from the instance
    instance.on('output', (output: string) => {
      this.handleInstanceOutput(instance, output);
    });
  }
  
  private async deliverMessage(instance: ClaudeInstance, message: Message): Promise<void> {
    try {
      await instance.sendMessage(message);
    } catch (error) {
      throw new MessageRoutingError(
        `Failed to deliver message to ${instance.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message.id
      );
    }
  }
  
  private routeMessage(source: ClaudeInstance, message: Message): void {
    // Handle child-to-master routing
    if (source.type === 'child' && message.to === 'master') {
      const master = this.registry.getMaster();
      if (master) {
        this.messageBus.publish({
          ...message,
          from: source.id,
          to: master.id,
        });
      }
      return;
    }
    
    // Handle master-to-child routing
    if (source.type === 'master') {
      if (message.to === 'broadcast') {
        // Broadcast to all children
        this.messageBus.publish({
          ...message,
          from: source.id,
          to: 'broadcast',
        });
      } else {
        // Route to specific child
        const target = this.registry.get(message.to) || 
                      this.registry.getByBranch(message.to);
        
        if (target) {
          this.messageBus.publish({
            ...message,
            from: source.id,
            to: target.id,
          });
        }
      }
      return;
    }
    
    // Default: publish the message as-is
    this.messageBus.publish(message);
  }
  
  private handleInstanceOutput(instance: ClaudeInstance, output: string): void {
    // Parse special commands from output
    if (output.startsWith('@')) {
      this.handleCommand(instance, output);
      return;
    }
    
    // Format and display output
    const prefix = instance.type === 'master' 
      ? theme.primary('[MASTER]')
      : theme.secondary(`[${instance.branch}]`);
    
    console.log(`${prefix} ${output}`);
  }
  
  private handleCommand(instance: ClaudeInstance, command: string): void {
    const [cmd, ...args] = command.slice(1).split(' ');
    
    switch (cmd) {
      case 'list':
        this.handleListCommand(instance);
        break;
      case 'status':
        this.handleStatusCommand(instance);
        break;
      case 'send':
        this.handleSendCommand(instance, args);
        break;
      case 'broadcast':
        this.handleBroadcastCommand(instance, args);
        break;
      default:
        console.log(theme.warning(`Unknown command: ${cmd}`));
    }
  }
  
  private handleListCommand(_instance: ClaudeInstance): void {
    const children = this.registry.getChildren();
    const response = children.map(child => 
      `${child.status === 'active' ? theme.statusActive : theme.statusIdle} ${theme.branch(child.branch)} (${child.id})`
    ).join('\n');
    
    console.log(theme.info('\nChild Instances:'));
    console.log(response || theme.muted('No child instances'));
  }
  
  private handleStatusCommand(_instance: ClaudeInstance): void {
    const all = this.registry.getAll();
    const response = all.map(inst => {
      const statusIcon = inst.status === 'active' ? theme.statusActive : 
                        inst.status === 'processing' ? theme.statusProcessing :
                        inst.status === 'error' ? theme.statusError : theme.statusIdle;
      return `${statusIcon} ${inst.type === 'master' ? 'MASTER' : inst.branch} - ${inst.status}`;
    }).join('\n');
    
    console.log(theme.info('\nInstance Status:'));
    console.log(response);
  }
  
  private handleSendCommand(instance: ClaudeInstance, args: string[]): void {
    if (args.length < 2) {
      console.log(theme.error('Usage: @send <target> <message>'));
      return;
    }
    
    const [target, ...messageParts] = args;
    const messageContent = messageParts.join(' ');
    
    if (target) {
      this.messageBus.publish({
        from: instance.id,
        to: target,
        type: 'command',
        payload: messageContent,
      });
    }
  }
  
  private handleBroadcastCommand(instance: ClaudeInstance, args: string[]): void {
    if (args.length < 1) {
      console.log(theme.error('Usage: @broadcast <message>'));
      return;
    }
    
    const messageContent = args.join(' ');
    
    this.messageBus.publish({
      from: instance.id,
      to: 'broadcast',
      type: 'command',
      payload: messageContent,
    });
  }
}