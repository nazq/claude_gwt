import { EventEmitter } from 'events';
import { WorktreeManager } from './git/WorktreeManager';
import { ClaudeInstanceFactory } from './claude/ClaudeInstanceFactory';
import { InstanceRegistry } from './claude/InstanceRegistry';
import { MessageBus } from './messaging/MessageBus';
import { MessageRouter } from './messaging/MessageRouter';
import type { MasterInstance } from './claude/MasterInstance';
import type { ChildInstance } from './claude/ChildInstance';
import { theme } from '../cli/ui/theme';

export class ClaudeOrchestrator extends EventEmitter {
  private registry: InstanceRegistry;
  private messageBus: MessageBus;
  private readonly messageRouter: MessageRouter;
  private worktreeManager: WorktreeManager;
  
  constructor(private basePath: string) {
    super();
    this.registry = new InstanceRegistry();
    this.messageBus = new MessageBus();
    this.messageRouter = new MessageRouter(this.messageBus, this.registry);
    this.worktreeManager = new WorktreeManager(basePath);
  }
  
  async initialize(): Promise<void> {
    // Get current worktree info
    const worktrees = await this.worktreeManager.listWorktrees();
    const currentWorktree = worktrees.find(wt => wt.path === this.basePath);
    
    if (!currentWorktree) {
      throw new Error('Not in a git worktree');
    }
    
    // Create and start master instance
    const master = ClaudeInstanceFactory.createMaster(
      this.basePath,
      currentWorktree.branch || 'main'
    );
    
    this.registry.register(master);
    await master.start();
    
    console.log(theme.success(`\n${theme.icons.robot} Master Claude instance started`));
    console.log(theme.info(`Branch: ${theme.branch(master.branch)}`));
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  async createChildForWorktree(branch: string): Promise<ChildInstance> {
    const master = this.registry.getMaster();
    if (!master) {
      throw new Error('No master instance found');
    }
    
    // Check if worktree exists
    const worktrees = await this.worktreeManager.listWorktrees();
    let worktree = worktrees.find(wt => wt.branch === branch);
    
    // Create worktree if it doesn't exist
    if (!worktree) {
      console.log(theme.info(`Creating worktree for branch ${theme.branch(branch)}...`));
      const worktreePath = await this.worktreeManager.addWorktree(branch);
      worktree = {
        path: worktreePath,
        branch,
        isLocked: false,
        prunable: false,
        HEAD: '',
      };
    }
    
    // Check if child already exists
    const existing = this.registry.getByBranch(branch);
    if (existing && existing.type === 'child') {
      return existing as ChildInstance;
    }
    
    // Create and start child instance
    const child = ClaudeInstanceFactory.createChild(
      worktree.path,
      branch,
      master.id
    );
    
    this.registry.register(child);
    await child.start();
    
    // Register with master
    master.registerChild(child.id, worktree.path);
    
    console.log(theme.success(`\n${theme.icons.robot} Child Claude instance started`));
    console.log(theme.info(`Branch: ${theme.branch(branch)}`));
    console.log(theme.dim(`Path: ${worktree.path}`));
    
    return child;
  }
  
  async removeChildForWorktree(branch: string, removeWorktree = false): Promise<void> {
    const child = this.registry.getByBranch(branch);
    if (!child || child.type !== 'child') {
      throw new Error(`No child instance found for branch ${branch}`);
    }
    
    // Stop and unregister child
    await child.stop();
    this.registry.unregister(child.id);
    
    // Unregister from master
    const master = this.registry.getMaster();
    if (master) {
      master.unregisterChild(child.id);
    }
    
    // Remove worktree if requested
    if (removeWorktree) {
      await this.worktreeManager.removeWorktree(branch);
      console.log(theme.warning(`Removed worktree for branch ${theme.branch(branch)}`));
    }
    
    console.log(theme.info(`Child instance for ${theme.branch(branch)} stopped`));
  }
  
  async listInstances(): Promise<{ master: MasterInstance | null; children: ChildInstance[] }> {
    return {
      master: this.registry.getMaster(),
      children: this.registry.getChildren() as ChildInstance[],
    };
  }
  
  async shutdown(): Promise<void> {
    console.log(theme.warning('\nShutting down Claude instances...'));
    
    // Stop all instances
    await this.registry.stopAll();
    
    // Clear registries and buses
    this.registry.clear();
    this.messageBus.clear();
    
    console.log(theme.success('All instances stopped'));
  }
  
  private setupEventHandlers(): void {
    // Handle instance status changes
    this.registry.on('instanceRegistered', (instance) => {
      instance.on('statusChange', (status: string) => {
        this.emit('instanceStatusChange', { instance, status });
      });
    });
    
    // Handle errors
    this.messageBus.on('error', (error) => {
      console.error(theme.error('Message bus error:'), error);
    });
    
    // Handle process exits
    process.on('SIGINT', async () => {
      console.log(theme.warning('\n\nReceived interrupt signal'));
      await this.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }
  
  getMessageBus(): MessageBus {
    return this.messageBus;
  }
  
  getRegistry(): InstanceRegistry {
    return this.registry;
  }
  
  getMessageRouter(): MessageRouter {
    return this.messageRouter;
  }
}