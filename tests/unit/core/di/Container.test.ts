import { Container, SERVICES } from '../../../../src/core/di/Container';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('service registration', () => {
    it('should register and resolve a simple service', () => {
      const service = { name: 'test' };
      container.singleton('test', () => service);

      const resolved = container.resolve('test');
      expect(resolved).toBe(service);
    });

    it('should register transient services', () => {
      let counter = 0;
      container.transient('counter', () => ({ value: ++counter }));

      const first = container.resolve<{ value: number }>('counter');
      const second = container.resolve<{ value: number }>('counter');

      expect(first.value).toBe(1);
      expect(second.value).toBe(2);
      expect(first).not.toBe(second);
    });

    it('should register singleton services', () => {
      let counter = 0;
      container.singleton('counter', () => ({ value: ++counter }));

      const first = container.resolve<{ value: number }>('counter');
      const second = container.resolve<{ value: number }>('counter');

      expect(first.value).toBe(1);
      expect(second.value).toBe(1);
      expect(first).toBe(second);
    });

    it('should register class constructors', () => {
      class TestService {
        constructor(public name: string = 'default') {}
      }

      // Register as singleton first
      container.singleton('TestService', () => new TestService('constructed'));

      const instance = container.resolve<TestService>('TestService');
      expect(instance).toBeInstanceOf(TestService);
      expect(instance.name).toBe('constructed');
    });
  });

  describe('dependency injection', () => {
    it('should inject dependencies', () => {
      const dependency = { name: 'dependency' };
      container.singleton('dep', () => dependency);
      container.singleton('service', (...args: unknown[]) => ({ dependency: args[0] }), ['dep']);

      const service = container.resolve<{ dependency: unknown }>('service');
      expect(service.dependency).toBe(dependency);
    });

    it('should inject nested dependencies', () => {
      container.singleton('level1', () => ({ name: 'level1' }));
      container.singleton('level2', (...args: unknown[]) => ({ level1: args[0] }), ['level1']);
      container.singleton('level3', (...args: unknown[]) => ({ level2: args[0] }), ['level2']);

      const service = container.resolve('level3');
      expect(service).toEqual({
        level2: {
          level1: { name: 'level1' },
        },
      });
    });

    it('should detect circular dependencies', () => {
      container.singleton('a', (...args: unknown[]) => ({ b: args[0] }), ['b']);
      container.singleton('b', (...args: unknown[]) => ({ a: args[0] }), ['a']);

      expect(() => container.resolve('a')).toThrow('Circular dependency detected');
    });
  });

  describe('error handling', () => {
    it('should throw error for unregistered service', () => {
      expect(() => container.resolve('nonexistent')).toThrow('Service not registered: nonexistent');
    });

    it('should handle factory errors', () => {
      container.singleton('failing', () => {
        throw new Error('Factory failed');
      });

      expect(() => container.resolve('failing')).toThrow('Factory failed');
    });
  });

  describe('container management', () => {
    it('should check if service is registered', () => {
      expect(container.has('test')).toBe(false);

      container.singleton('test', () => ({}));
      expect(container.has('test')).toBe(true);
    });

    it('should clear all registrations', () => {
      container.singleton('test', () => ({}));
      expect(container.has('test')).toBe(true);

      container.clear();
      expect(container.has('test')).toBe(false);
    });

    it('should create child containers', () => {
      container.singleton('parent', () => ({ type: 'parent' }));

      const child = container.createChild();
      expect(child.has('parent')).toBe(true);

      const resolved = child.resolve<{ type: string }>('parent');
      expect(resolved.type).toBe('parent');

      // Child can add its own services
      child.singleton('child', () => ({ type: 'child' }));
      expect(child.has('child')).toBe(true);
      expect(container.has('child')).toBe(false);
    });

    it('should get registered service identifiers', () => {
      container.singleton('service1', () => ({}));
      container.singleton('service2', () => ({}));

      const services = container.getRegisteredServices();
      expect(services).toContain('service1');
      expect(services).toContain('service2');
      expect(services).toHaveLength(2);
    });
  });

  describe('service symbols', () => {
    it('should provide predefined service symbols', () => {
      expect(typeof SERVICES.GitRepository).toBe('symbol');
      expect(typeof SERVICES.TmuxManager).toBe('symbol');
      expect(typeof SERVICES.Logger).toBe('symbol');
    });

    it('should use symbols as service identifiers', () => {
      const service = { name: 'git-repo' };
      container.singleton(SERVICES.GitRepository, () => service);

      const resolved = container.resolve(SERVICES.GitRepository);
      expect(resolved).toBe(service);
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple service types', () => {
      // Register various service types
      container.singleton('config', () => ({ debug: true }));
      container.transient(
        'logger',
        (...args: unknown[]) => ({
          debug: (args[0] as { debug: boolean }).debug,
          id: Math.random(),
        }),
        ['config'],
      );

      container.singleton(
        'database',
        (...args: unknown[]) => ({
          config: args[0],
          logger: args[1],
          type: 'database',
        }),
        ['config', 'logger'],
      );

      const db1 = container.resolve<{
        config: { debug: boolean };
        logger: { debug: boolean; id: number };
        type: string;
      }>('database');
      const db2 = container.resolve<{
        config: { debug: boolean };
        logger: { debug: boolean; id: number };
        type: string;
      }>('database');

      // Singleton service should be same instance
      expect(db1).toBe(db2);

      // Logger should be same since service is singleton
      expect(db1.logger).toBe(db2.logger);

      // Config should be same (singleton)
      expect(db1.config).toBe(db2.config);
    });

    it('should handle optional dependencies gracefully', () => {
      container.singleton('service', () => ({ name: 'test' }), []);

      const service = container.resolve<{ name: string }>('service');
      expect(service.name).toBe('test');
    });
  });
});
