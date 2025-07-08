import { describe, it, expect, vi } from 'vitest';
import { ServiceFactory } from '../../../../src/core/services/factories.js';

// Create a concrete implementation for testing
class TestServiceFactory extends ServiceFactory<string> {
  create(): string {
    const dep1 = this.getDependency<string>('dep1');
    const dep2 = this.getDependency<number>('dep2');
    return `${dep1}-${dep2}`;
  }
}

describe('ServiceFactory Abstract Class', () => {
  describe('addDependency', () => {
    it('should add dependencies and return this for chaining', () => {
      const factory = new TestServiceFactory();

      const result = factory.addDependency('dep1', 'value1').addDependency('dep2', 42);

      expect(result).toBe(factory); // Verify chaining works
    });

    it('should store multiple dependencies', () => {
      const factory = new TestServiceFactory();
      const mockService1 = { name: 'service1' };
      const mockService2 = { name: 'service2' };

      factory.addDependency('service1', mockService1).addDependency('service2', mockService2);

      // Use create to verify dependencies are accessible
      factory.addDependency('dep1', 'test').addDependency('dep2', 123);
      const result = factory.create();
      expect(result).toBe('test-123');
    });
  });

  describe('getDependency', () => {
    it('should retrieve stored dependencies with correct type', () => {
      const factory = new TestServiceFactory();
      const mockService = { type: 'mock', value: 42 };

      factory.addDependency('mockService', mockService);
      factory.addDependency('dep1', 'hello');
      factory.addDependency('dep2', 100);

      const result = factory.create();
      expect(result).toBe('hello-100');
    });

    it('should throw error when dependency is not found', () => {
      const factory = new TestServiceFactory();

      // Don't add required dependencies
      expect(() => factory.create()).toThrow("Dependency 'dep1' not found");
    });

    it('should throw error with correct dependency name', () => {
      const factory = new TestServiceFactory();
      factory.addDependency('dep1', 'value1');
      // Missing dep2

      expect(() => factory.create()).toThrow("Dependency 'dep2' not found");
    });
  });

  describe('complex dependency scenarios', () => {
    it('should handle falsy dependencies', () => {
      const factory = new TestServiceFactory();

      // The implementation uses !dependency check, so falsy values are considered "not found"
      factory
        .addDependency('zeroDep', 0)
        .addDependency('falseDep', false)
        .addDependency('emptyStringDep', '');

      // All falsy values will throw
      expect(() => {
        // @ts-expect-error Testing protected method
        factory.getDependency('zeroDep');
      }).toThrow("Dependency 'zeroDep' not found");

      // But objects and truthy values work fine
      factory.addDependency('dep1', 'test').addDependency('dep2', 1); // Use 1 instead of 0

      const result = factory.create();
      expect(result).toBe('test-1');
    });

    it('should overwrite existing dependencies', () => {
      const factory = new TestServiceFactory();

      factory
        .addDependency('dep1', 'first')
        .addDependency('dep2', 1)
        .addDependency('dep1', 'second'); // Overwrite dep1

      const result = factory.create();
      expect(result).toBe('second-1');
    });
  });
});
