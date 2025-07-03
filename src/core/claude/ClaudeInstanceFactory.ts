import { MasterInstance } from './MasterInstance';
import { ChildInstance } from './ChildInstance';
import type { ClaudeInstance } from './ClaudeInstance';

export class ClaudeInstanceFactory {
  static createMaster(worktreePath: string, branch: string): MasterInstance {
    return new MasterInstance(worktreePath, branch);
  }
  
  static createChild(
    worktreePath: string,
    branch: string,
    parentId: string
  ): ChildInstance {
    return new ChildInstance(worktreePath, branch, parentId);
  }
  
  static create(
    type: 'master' | 'child',
    worktreePath: string,
    branch: string,
    parentId?: string
  ): ClaudeInstance {
    if (type === 'master') {
      return this.createMaster(worktreePath, branch);
    } else {
      if (!parentId) {
        throw new Error('Parent ID required for child instance');
      }
      return this.createChild(worktreePath, branch, parentId);
    }
  }
}