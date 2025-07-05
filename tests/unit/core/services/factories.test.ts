/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import {
  GitServiceFactory,
  TmuxServiceFactory,
  ApplicationContextFactory,
  SessionConfigFactory,
  FactoryRegistry,
  gitServiceFactory,
  tmuxServiceFactory,
  applicationContextFactory,
  sessionConfigFactory,
  factoryRegistry,
} from '../../../../src/core/services/factories';

import type { CLIOptions } from '../../../../src/types';

// Mock the actual implementations
jest.mock('../../../../src/core/git/GitRepository');
jest.mock('../../../../src/core/git/WorktreeManager');
jest.mock('../../../../src/core/git/GitDetector');

describe('Service Factories', () => {
  describe('GitServiceFactory', () => {
    let factory: GitServiceFactory;

    beforeEach(() => {
      factory = new GitServiceFactory();
    });

    it('should create GitRepository service', () => {
      const service = factory.create('repository', '/test/path');
      expect(service).toBeDefined();
      // The mock will be used, so we can't test the exact type
    });

    it('should create WorktreeManager service', () => {
      const service = factory.create('worktree', '/test/path');
      expect(service).toBeDefined();
    });

    it('should create GitDetector service', () => {
      const service = factory.create('detector', '/test/path');
      expect(service).toBeDefined();
    });

    it('should throw error for unknown service type', () => {
      expect(() => {
        // @ts-expect-error - intentionally testing invalid type
        factory.create('unknown', '/test/path');
      }).toThrow('Unknown Git service type: unknown');
    });
  });

  describe('TmuxServiceFactory', () => {
    let factory: TmuxServiceFactory;

    beforeEach(() => {
      factory = new TmuxServiceFactory();
    });

    it('should create TmuxManager service', () => {
      const service = factory.create();
      expect(service).toBeDefined();
      // TmuxManager is a static class, so we get the class itself
    });
  });

  describe('ApplicationContextFactory', () => {
    let factory: ApplicationContextFactory;

    beforeEach(() => {
      factory = new ApplicationContextFactory();
    });

    it('should create application context with all options', () => {
      const options: CLIOptions = {
        repo: 'https://github.com/test/repo.git',
        quiet: true,
        interactive: false,
      };

      const context = factory.create('/test/path', options);

      expect(context).toEqual({
        basePath: '/test/path',
        options,
      });
    });

    it('should create application context with minimal options', () => {
      const options: CLIOptions = {};

      const context = factory.create('/minimal/path', options);

      expect(context).toEqual({
        basePath: '/minimal/path',
        options: {},
      });
    });
  });

  describe('SessionConfigFactory', () => {
    let factory: SessionConfigFactory;

    beforeEach(() => {
      factory = new SessionConfigFactory();
    });

    it('should create session config with all parameters', () => {
      const mockGitRepo = { getCurrentBranch: jest.fn() } as any;

      const config = factory.create(
        'test-repo',
        'feature-branch',
        '/work/dir',
        'supervisor',
        mockGitRepo,
      );

      expect(config).toEqual({
        sessionName: 'cgwt-test-repo-feature-branch',
        workingDirectory: '/work/dir',
        branchName: 'feature-branch',
        role: 'supervisor',
        gitRepo: mockGitRepo,
      });
    });

    it('should create session config with default role', () => {
      const config = factory.create('test-repo', 'main', '/work/dir');

      expect(config).toEqual({
        sessionName: 'cgwt-test-repo-main',
        workingDirectory: '/work/dir',
        branchName: 'main',
        role: 'child',
        gitRepo: undefined,
      });
    });

    it('should sanitize repository and branch names', () => {
      const config = factory.create('test@repo#name', 'feature/branch-name', '/work/dir');

      expect(config.sessionName).toBe('cgwt-test-repo-name-feature-branch-name');
    });

    it('should handle special characters in names', () => {
      const config = factory.create('my.repo@2.0', 'fix/bug#123', '/work/dir');

      expect(config.sessionName).toBe('cgwt-my-repo-2-0-fix-bug-123');
    });

    it('should handle edge cases in name sanitization', () => {
      const config = factory.create('--repo--', '--branch--', '/work/dir');

      expect(config.sessionName).toBe('cgwt-repo-branch');
    });
  });

  describe('FactoryRegistry', () => {
    let registry: FactoryRegistry;

    beforeEach(() => {
      registry = new FactoryRegistry();
    });

    it('should register and retrieve factories', () => {
      const mockFactory = { create: jest.fn() };

      registry.register('test', mockFactory);

      const retrieved = registry.get('test');
      expect(retrieved).toBe(mockFactory);
    });

    it('should create services using registered factories', () => {
      const mockFactory = {
        create: jest.fn().mockReturnValue({ name: 'test-service' }),
      };

      registry.register('test', mockFactory);

      const service = registry.create('test', 'arg1', 'arg2');

      expect(service).toEqual({ name: 'test-service' });
      expect(mockFactory.create).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should check if factory is registered', () => {
      expect(registry.has('nonexistent')).toBe(false);

      registry.register('exists', { create: jest.fn() });
      expect(registry.has('exists')).toBe(true);
    });

    it('should throw error for unregistered factory', () => {
      expect(() => registry.get('nonexistent')).toThrow("Factory 'nonexistent' not registered");
    });

    it('should throw error when creating with unregistered factory', () => {
      expect(() => registry.create('nonexistent')).toThrow("Factory 'nonexistent' not registered");
    });

    it('should get list of registered factory names', () => {
      registry.register('factory1', { create: jest.fn() });
      registry.register('factory2', { create: jest.fn() });

      const names = registry.getRegisteredFactories();
      expect(names).toContain('factory1');
      expect(names).toContain('factory2');
      expect(names).toHaveLength(2);
    });

    it('should support method chaining for registration', () => {
      const factory1 = { create: jest.fn() };
      const factory2 = { create: jest.fn() };

      const result = registry.register('factory1', factory1).register('factory2', factory2);

      expect(result).toBe(registry);
      expect(registry.has('factory1')).toBe(true);
      expect(registry.has('factory2')).toBe(true);
    });
  });

  describe('Default factory instances', () => {
    it('should provide default GitServiceFactory instance', () => {
      expect(gitServiceFactory).toBeInstanceOf(GitServiceFactory);
    });

    it('should provide default TmuxServiceFactory instance', () => {
      expect(tmuxServiceFactory).toBeInstanceOf(TmuxServiceFactory);
    });

    it('should provide default ApplicationContextFactory instance', () => {
      expect(applicationContextFactory).toBeInstanceOf(ApplicationContextFactory);
    });

    it('should provide default SessionConfigFactory instance', () => {
      expect(sessionConfigFactory).toBeInstanceOf(SessionConfigFactory);
    });

    it('should provide default FactoryRegistry with registered factories', () => {
      expect(factoryRegistry).toBeInstanceOf(FactoryRegistry);
      expect(factoryRegistry.has('git')).toBe(true);
      expect(factoryRegistry.has('tmux')).toBe(true);
      expect(factoryRegistry.has('appContext')).toBe(true);
      expect(factoryRegistry.has('sessionConfig')).toBe(true);
    });

    it('should create services through default registry', () => {
      // Test git service creation
      const gitService = factoryRegistry.create('git', 'repository', '/test/path');
      expect(gitService).toBeDefined();

      // Test tmux service creation
      const tmuxService = factoryRegistry.create('tmux');
      expect(tmuxService).toBeDefined();

      // Test app context creation
      const appContext = factoryRegistry.create('appContext', '/test/path', {});
      expect(appContext).toEqual({
        basePath: '/test/path',
        options: {},
      });

      // Test session config creation
      const sessionConfig = factoryRegistry.create(
        'sessionConfig',
        'test-repo',
        'main',
        '/work/dir',
      );
      expect((sessionConfig as { sessionName: string }).sessionName).toBe('cgwt-test-repo-main');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty strings in session config', () => {
      const config = sessionConfigFactory.create('', '', '/work/dir');
      expect(config.sessionName).toBe('cgwt--');
    });

    it('should handle undefined gitRepo in session config', () => {
      const config = sessionConfigFactory.create('repo', 'branch', '/dir', 'child', undefined);
      expect(config.gitRepo).toBeUndefined();
    });

    it('should handle complex repository names', () => {
      const config = sessionConfigFactory.create(
        'organization/repository-name',
        'feature/JIRA-123-implement-feature',
        '/work/dir',
      );

      expect(config.sessionName).toBe(
        'cgwt-organization-repository-name-feature-JIRA-123-implement-feature',
      );
    });
  });
});
