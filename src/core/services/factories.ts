/**
 * Factory patterns for creating complex objects
 */

import type {
  IGitRepository,
  IWorktreeManager,
  IGitDetector,
  ITmuxManager,
  IApplicationContext,
  IServiceFactory,
} from './interfaces';
import { GitRepository } from '../git/GitRepository';
import { WorktreeManager } from '../git/WorktreeManager';
import { GitDetector } from '../git/GitDetector';
import { TmuxManager } from '../../sessions/TmuxManager';
import type { CLIOptions } from '../../types';

/**
 * Factory for creating Git-related services
 */
export class GitServiceFactory
  implements IServiceFactory<IGitRepository | IWorktreeManager | IGitDetector>
{
  create(
    type: 'repository' | 'worktree' | 'detector',
    basePath: string,
  ): IGitRepository | IWorktreeManager | IGitDetector {
    switch (type) {
      case 'repository':
        return new GitRepository(basePath);
      case 'worktree':
        return new WorktreeManager(basePath);
      case 'detector':
        return new GitDetector(basePath);
      default:
        throw new Error(`Unknown Git service type: ${String(type)}`);
    }
  }
}

/**
 * Factory for creating Tmux-related services
 */
export class TmuxServiceFactory implements IServiceFactory<ITmuxManager> {
  create(): ITmuxManager {
    // TmuxManager is static, so we return the class itself
    return TmuxManager;
  }
}

/**
 * Factory for creating application contexts
 */
export class ApplicationContextFactory implements IServiceFactory<IApplicationContext> {
  create(basePath: string, options: CLIOptions): IApplicationContext {
    return {
      basePath,
      options,
    };
  }
}

/**
 * Session configuration factory
 */
export interface SessionConfigOptions {
  sessionName: string;
  workingDirectory: string;
  branchName: string;
  role: 'supervisor' | 'child';
  gitRepo?: IGitRepository;
}

export class SessionConfigFactory implements IServiceFactory<SessionConfigOptions> {
  create(
    repoName: string,
    branchName: string,
    workingDirectory: string,
    role: 'supervisor' | 'child' = 'child',
    gitRepo?: IGitRepository,
  ): SessionConfigOptions {
    // Generate session name using the same logic as TmuxManager
    const sessionName = this.generateSessionName(repoName, branchName);

    return {
      sessionName,
      workingDirectory,
      branchName,
      role,
      gitRepo,
    };
  }

  private generateSessionName(repoName: string, branch: string): string {
    const SESSION_PREFIX = 'cgwt';
    const sanitizedRepo = repoName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
    const sanitizedBranch = branch
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
    return `${SESSION_PREFIX}-${sanitizedRepo}-${sanitizedBranch}`;
  }
}

/**
 * Abstract factory for creating different types of services
 */
export abstract class ServiceFactory<T> implements IServiceFactory<T> {
  protected dependencies: Map<string, unknown> = new Map();

  /**
   * Add a dependency to the factory
   */
  addDependency(name: string, service: unknown): this {
    this.dependencies.set(name, service);
    return this;
  }

  /**
   * Get a dependency
   */
  protected getDependency<TDep>(name: string): TDep {
    const dependency = this.dependencies.get(name);
    if (!dependency) {
      throw new Error(`Dependency '${name}' not found`);
    }
    return dependency as TDep;
  }

  /**
   * Abstract method to create the service
   */
  abstract create(...args: unknown[]): T;
}

/**
 * Registry for managing multiple factories
 */
export class FactoryRegistry {
  private factories = new Map<string, IServiceFactory<unknown>>();

  /**
   * Register a factory
   */
  register<T>(name: string, factory: IServiceFactory<T>): this {
    this.factories.set(name, factory);
    return this;
  }

  /**
   * Get a factory by name
   */
  get<T>(name: string): IServiceFactory<T> {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Factory '${name}' not registered`);
    }
    return factory as IServiceFactory<T>;
  }

  /**
   * Create a service using a registered factory
   */
  create<T>(factoryName: string, ...args: unknown[]): T {
    const factory = this.get<T>(factoryName);
    return factory.create(...args);
  }

  /**
   * Check if a factory is registered
   */
  has(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * Get all registered factory names
   */
  getRegisteredFactories(): string[] {
    return Array.from(this.factories.keys());
  }
}

// Default factory instances
export const gitServiceFactory = new GitServiceFactory();
export const tmuxServiceFactory = new TmuxServiceFactory();
export const applicationContextFactory = new ApplicationContextFactory();
export const sessionConfigFactory = new SessionConfigFactory();

// Default factory registry
export const factoryRegistry = new FactoryRegistry()
  .register('git', gitServiceFactory)
  .register('tmux', tmuxServiceFactory)
  .register('appContext', applicationContextFactory)
  .register('sessionConfig', sessionConfigFactory);
