import { EventEmitter } from 'events';
import type { ClaudeInstance } from './ClaudeInstance';
import type { MasterInstance } from './MasterInstance';
import { ClaudeInstanceError } from '../errors/CustomErrors';

export class InstanceRegistry extends EventEmitter {
  private instances: Map<string, ClaudeInstance> = new Map();
  private masterInstance: MasterInstance | null = null;
  
  register(instance: ClaudeInstance): void {
    if (this.instances.has(instance.id)) {
      throw new ClaudeInstanceError(
        `Instance ${instance.id} already registered`,
        instance.id
      );
    }
    
    this.instances.set(instance.id, instance);
    
    if (instance.type === 'master') {
      if (this.masterInstance) {
        throw new ClaudeInstanceError(
          'Master instance already exists',
          instance.id
        );
      }
      this.masterInstance = instance as MasterInstance;
    }
    
    this.emit('instanceRegistered', instance);
  }
  
  unregister(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }
    
    this.instances.delete(instanceId);
    
    if (instance === this.masterInstance) {
      this.masterInstance = null;
    }
    
    this.emit('instanceUnregistered', instance);
  }
  
  get(instanceId: string): ClaudeInstance | undefined {
    return this.instances.get(instanceId);
  }
  
  getByBranch(branch: string): ClaudeInstance | undefined {
    return Array.from(this.instances.values()).find(
      (instance) => instance.branch === branch
    );
  }
  
  getMaster(): MasterInstance | null {
    return this.masterInstance;
  }
  
  getChildren(): ClaudeInstance[] {
    return Array.from(this.instances.values()).filter(
      (instance) => instance.type === 'child'
    );
  }
  
  getAll(): ClaudeInstance[] {
    return Array.from(this.instances.values());
  }
  
  async stopAll(): Promise<void> {
    const stopPromises = this.getAll().map((instance) => instance.stop());
    await Promise.all(stopPromises);
  }
  
  clear(): void {
    this.instances.clear();
    this.masterInstance = null;
    this.emit('cleared');
  }
}