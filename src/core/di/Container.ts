/**
 * Simple dependency injection container
 */

export type Constructor<T = Record<string, never>> = new (...args: unknown[]) => T;
export type Factory<T = unknown> = (...args: unknown[]) => T;
export type ServiceIdentifier<T = unknown> = string | symbol | Constructor<T>;

export interface ServiceDescriptor<T = unknown> {
  identifier: ServiceIdentifier<T>;
  factory: Factory<T>;
  singleton?: boolean;
  dependencies?: ServiceIdentifier[];
}

export class Container {
  private services = new Map<ServiceIdentifier, ServiceDescriptor>();
  private singletons = new Map<ServiceIdentifier, unknown>();
  private resolving = new Set<ServiceIdentifier>();

  /**
   * Register a service with the container
   */
  register<T>(descriptor: ServiceDescriptor<T>): this {
    this.services.set(descriptor.identifier, descriptor);
    return this;
  }

  /**
   * Register a singleton service
   */
  singleton<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
    dependencies: ServiceIdentifier[] = [],
  ): this {
    return this.register({
      identifier,
      factory,
      dependencies,
      singleton: true,
    });
  }

  /**
   * Register a transient service
   */
  transient<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
    dependencies: ServiceIdentifier[] = [],
  ): this {
    return this.register({
      identifier,
      factory,
      dependencies,
      singleton: false,
    });
  }

  /**
   * Register a class as a service
   */
  registerClass<T>(
    ctor: Constructor<T>,
    dependencies: ServiceIdentifier[] = [],
    singleton: boolean = false,
  ): this {
    const factory = (...deps: unknown[]): T => new ctor(...deps);
    return this.register({
      identifier: ctor,
      factory,
      dependencies,
      singleton,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    // Check for circular dependencies
    if (this.resolving.has(identifier)) {
      throw new Error(`Circular dependency detected for service: ${String(identifier)}`);
    }

    // Check singleton cache
    if (this.singletons.has(identifier)) {
      return this.singletons.get(identifier) as T;
    }

    const descriptor = this.services.get(identifier);
    if (!descriptor) {
      throw new Error(`Service not registered: ${String(identifier)}`);
    }

    // Mark as resolving to detect circular dependencies
    this.resolving.add(identifier);

    try {
      // Resolve dependencies
      const dependencies = descriptor.dependencies?.map((dep) => this.resolve(dep)) ?? [];

      // Create instance
      const instance = descriptor.factory(...dependencies);

      // Cache if singleton
      if (descriptor.singleton) {
        this.singletons.set(identifier, instance);
      }

      return instance as T;
    } finally {
      this.resolving.delete(identifier);
    }
  }

  /**
   * Check if a service is registered
   */
  has(identifier: ServiceIdentifier): boolean {
    return this.services.has(identifier);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
    this.singletons.clear();
    this.resolving.clear();
  }

  /**
   * Create a child container that inherits services from this container
   */
  createChild(): Container {
    const child = new Container();
    // Copy service registrations
    for (const [identifier, descriptor] of this.services) {
      child.services.set(identifier, descriptor);
    }
    return child;
  }

  /**
   * Get all registered service identifiers
   */
  getRegisteredServices(): ServiceIdentifier[] {
    return Array.from(this.services.keys());
  }
}

// Default container instance
export const container = new Container();

// Service identifier symbols
export const SERVICES = {
  GitRepository: Symbol('GitRepository'),
  WorktreeManager: Symbol('WorktreeManager'),
  TmuxManager: Symbol('TmuxManager'),
  TmuxDriver: Symbol('TmuxDriver'),
  TmuxEnhancer: Symbol('TmuxEnhancer'),
  Logger: Symbol('Logger'),
  ConfigManager: Symbol('ConfigManager'),
  GitDetector: Symbol('GitDetector'),
} as const;
