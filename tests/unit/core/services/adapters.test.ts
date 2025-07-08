/* eslint-disable @typescript-eslint/unbound-method */
import { vi } from 'vitest';
import {
  GitServiceAdapter,
  TmuxServiceAdapter,
  CachingAdapter,
  RetryAdapter,
} from '../../../../src/core/services/adapters';
import type {
  IGitRepository,
  IWorktreeManager,
  ITmuxManager,
  ILogger,
  IErrorBoundary,
} from '../../../../src/core/services/interfaces';
import type { SessionConfig, SessionInfo } from '../../../../src/sessions/TmuxManager';
import type { GitWorktreeInfo } from '../../../../src/types';

describe('Service Adapters', () => {
  describe('GitServiceAdapter', () => {
    let mockGitRepo: vi.Mocked<IGitRepository>;
    let mockWorktreeManager: vi.Mocked<IWorktreeManager>;
    let mockErrorBoundary: vi.Mocked<IErrorBoundary>;
    let mockLogger: vi.Mocked<ILogger>;
    let adapter: GitServiceAdapter;

    beforeEach(() => {
      mockGitRepo = {
        getCurrentBranch: vi.fn(),
        getDefaultBranch: vi.fn(),
        initializeBareRepository: vi.fn(),
        convertToWorktreeSetup: vi.fn(),
        canConvertToWorktree: vi.fn(),
        fetch: vi.fn(),
      };

      mockWorktreeManager = {
        listWorktrees: vi.fn(),
        addWorktree: vi.fn(),
        removeWorktree: vi.fn(),
      };

      mockErrorBoundary = {
        handle: vi.fn(),
        handleSync: vi.fn(),
      };

      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
      };

      adapter = new GitServiceAdapter(
        mockGitRepo,
        mockWorktreeManager,
        mockErrorBoundary,
        mockLogger,
      );
    });

    describe('GitRepository methods', () => {
      it('should delegate getCurrentBranch with error boundary', async () => {
        const expectedBranch = 'main';
        mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
        mockGitRepo.getCurrentBranch.mockResolvedValue(expectedBranch);

        const result = await adapter.getCurrentBranch();

        expect(result).toBe(expectedBranch);
        expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
          expect.any(Function) as () => Promise<string>,
          'GitService.getCurrentBranch',
        );
      });

      it('should delegate initializeBareRepository with logging', async () => {
        const expected = { defaultBranch: 'main' };
        mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
        mockGitRepo.initializeBareRepository.mockResolvedValue(expected);

        const result = await adapter.initializeBareRepository('https://github.com/test/repo.git');

        expect(result).toEqual(expected);
        expect(mockLogger.info).toHaveBeenCalledWith('Initializing bare repository', {
          repoUrl: 'https://github.com/test/repo.git',
        });
      });

      it('should delegate fetch with logging', async () => {
        mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
        mockGitRepo.fetch.mockResolvedValue();

        await adapter.fetch();

        expect(mockLogger.info).toHaveBeenCalledWith('Fetching repository updates');
        expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
          expect.any(Function) as () => Promise<void>,
          'GitService.fetch',
        );
      });
    });

    describe('WorktreeManager methods', () => {
      it('should delegate listWorktrees with error boundary', async () => {
        const expectedWorktrees: GitWorktreeInfo[] = [
          { path: '/test/main', branch: 'main', isLocked: false, prunable: false, HEAD: 'abc123' },
        ];
        mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
        mockWorktreeManager.listWorktrees.mockResolvedValue(expectedWorktrees);

        const result = await adapter.listWorktrees();

        expect(result).toEqual(expectedWorktrees);
        expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
          expect.any(Function) as () => Promise<GitWorktreeInfo[]>,
          'GitService.listWorktrees',
        );
      });

      it('should delegate addWorktree with logging', async () => {
        const expectedPath = '/test/feature';
        mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
        mockWorktreeManager.addWorktree.mockResolvedValue(expectedPath);

        const result = await adapter.addWorktree('feature', 'main');

        expect(result).toBe(expectedPath);
        expect(mockLogger.info).toHaveBeenCalledWith('Adding worktree', {
          branchName: 'feature',
          baseBranch: 'main',
        });
      });

      it('should delegate removeWorktree with logging', async () => {
        mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
        mockWorktreeManager.removeWorktree.mockResolvedValue();

        await adapter.removeWorktree('feature');

        expect(mockLogger.info).toHaveBeenCalledWith('Removing worktree', {
          branchName: 'feature',
        });
      });
    });

    it('should delegate getDefaultBranch with error boundary', async () => {
      const expectedBranch = 'develop';
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockGitRepo.getDefaultBranch.mockResolvedValue(expectedBranch);

      const result = await adapter.getDefaultBranch();

      expect(result).toBe(expectedBranch);
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<string>,
        'GitService.getDefaultBranch',
      );
    });

    it('should delegate convertToWorktreeSetup with logging', async () => {
      const expected = { defaultBranch: 'main' };
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockGitRepo.convertToWorktreeSetup.mockResolvedValue(expected);

      const result = await adapter.convertToWorktreeSetup();

      expect(result).toEqual(expected);
      expect(mockLogger.info).toHaveBeenCalledWith('Converting repository to worktree setup');
    });

    it('should delegate canConvertToWorktree with error boundary', async () => {
      const expected = { canConvert: true };
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockGitRepo.canConvertToWorktree.mockResolvedValue(expected);

      const result = await adapter.canConvertToWorktree();

      expect(result).toEqual(expected);
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<{ canConvert: boolean; reason?: string }>,
        'GitService.canConvertToWorktree',
      );
    });

    it('should log local repo initialization', async () => {
      const expected = { defaultBranch: 'main' };
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockGitRepo.initializeBareRepository.mockResolvedValue(expected);

      await adapter.initializeBareRepository();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing bare repository', {
        repoUrl: 'local',
      });
    });
  });

  describe('TmuxServiceAdapter', () => {
    let mockTmuxManager: vi.Mocked<ITmuxManager>;
    let mockErrorBoundary: vi.Mocked<IErrorBoundary>;
    let mockLogger: vi.Mocked<ILogger>;
    let adapter: TmuxServiceAdapter;

    beforeEach(() => {
      mockTmuxManager = {
        isTmuxAvailable: vi.fn(),
        isInsideTmux: vi.fn(),
        getSessionInfo: vi.fn(),
        listSessions: vi.fn(),
        launchSession: vi.fn(),
        createDetachedSession: vi.fn(),
        attachToSession: vi.fn(),
        killSession: vi.fn(),
        shutdownAll: vi.fn(),
      };

      mockErrorBoundary = {
        handle: vi.fn(),
        handleSync: vi.fn(),
      };

      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
      };

      adapter = new TmuxServiceAdapter(mockTmuxManager, mockErrorBoundary, mockLogger);
    });

    it('should delegate isTmuxAvailable with error boundary', async () => {
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.isTmuxAvailable.mockResolvedValue(true);

      const result = await adapter.isTmuxAvailable();

      expect(result).toBe(true);
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<boolean>,
        'TmuxService.isTmuxAvailable',
      );
    });

    it('should delegate isInsideTmux with sync error boundary', () => {
      mockErrorBoundary.handleSync.mockImplementation((fn) => fn());
      mockTmuxManager.isInsideTmux.mockReturnValue(false);

      const result = adapter.isInsideTmux();

      expect(result).toBe(false);
      expect(mockErrorBoundary.handleSync).toHaveBeenCalledWith(
        expect.any(Function) as () => boolean,
        'TmuxService.isInsideTmux',
      );
    });

    it('should delegate launchSession with logging and error boundary', async () => {
      const config: SessionConfig = {
        sessionName: 'test-session',
        workingDirectory: '/test',
        branchName: 'main',
        role: 'supervisor',
      };

      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.launchSession.mockResolvedValue();

      await adapter.launchSession(config);

      expect(mockLogger.info).toHaveBeenCalledWith('Launching tmux session', {
        sessionName: 'test-session',
        role: 'supervisor',
        branchName: 'main',
      });
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<void>,
        'TmuxService.launchSession',
      );
    });

    it('should delegate listSessions', async () => {
      const expectedSessions: SessionInfo[] = [
        {
          name: 'test-session',
          windows: 1,
          created: '123456789',
          attached: true,
          hasClaudeRunning: true,
        },
      ];

      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.listSessions.mockResolvedValue(expectedSessions);

      const result = await adapter.listSessions();

      expect(result).toEqual(expectedSessions);
    });

    it('should delegate killSession with logging and error boundary', async () => {
      const sessionName = 'test-session';
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.killSession.mockResolvedValue();

      await adapter.killSession(sessionName);

      expect(mockLogger.info).toHaveBeenCalledWith('Killing tmux session', { sessionName });
      expect(mockTmuxManager.killSession).toHaveBeenCalledWith(sessionName);
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<void>,
        'TmuxService.killSession',
      );
    });

    it('should delegate shutdownAll with logging and error boundary', async () => {
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.shutdownAll.mockResolvedValue();

      await adapter.shutdownAll();

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down all tmux sessions');
      expect(mockTmuxManager.shutdownAll).toHaveBeenCalled();
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<void>,
        'TmuxService.shutdownAll',
      );
    });

    it('should delegate getSessionInfo with error boundary', async () => {
      const sessionInfo: SessionInfo = {
        name: 'test-session',
        windows: 2,
        created: '123456789',
        attached: false,
        hasClaudeRunning: false,
      };

      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.getSessionInfo.mockResolvedValue(sessionInfo);

      const result = await adapter.getSessionInfo('test-session');

      expect(result).toEqual(sessionInfo);
      expect(mockTmuxManager.getSessionInfo).toHaveBeenCalledWith('test-session');
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<SessionInfo | null>,
        'TmuxService.getSessionInfo',
      );
    });

    it('should delegate createDetachedSession with logging', async () => {
      const config: SessionConfig = {
        sessionName: 'detached-session',
        workingDirectory: '/test',
        branchName: 'develop',
        role: 'child',
      };

      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.createDetachedSession.mockResolvedValue();

      await adapter.createDetachedSession(config);

      expect(mockLogger.info).toHaveBeenCalledWith('Creating detached tmux session', {
        sessionName: 'detached-session',
        role: 'child',
        branchName: 'develop',
      });
      expect(mockTmuxManager.createDetachedSession).toHaveBeenCalledWith(config);
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<void>,
        'TmuxService.createDetachedSession',
      );
    });

    it('should delegate attachToSession with logging', async () => {
      const sessionName = 'attach-session';
      mockErrorBoundary.handle.mockImplementation(async (fn) => fn());
      mockTmuxManager.attachToSession.mockResolvedValue();

      await adapter.attachToSession(sessionName);

      expect(mockLogger.info).toHaveBeenCalledWith('Attaching to tmux session', { sessionName });
      expect(mockTmuxManager.attachToSession).toHaveBeenCalledWith(sessionName);
      expect(mockErrorBoundary.handle).toHaveBeenCalledWith(
        expect.any(Function) as () => Promise<void>,
        'TmuxService.attachToSession',
      );
    });
  });

  describe('CachingAdapter', () => {
    let mockService: { getData: vi.Mock; getDataWithArgs: vi.Mock };
    let cachingAdapter: CachingAdapter<typeof mockService>;

    beforeEach(() => {
      mockService = {
        getData: vi.fn(),
        getDataWithArgs: vi.fn(),
      };
      cachingAdapter = new CachingAdapter(mockService, 1000); // 1 second TTL
    });

    it('should cache method results', async () => {
      const expectedData = { id: 1, name: 'test' };
      mockService.getData.mockResolvedValue(expectedData);

      const cachedMethod = cachingAdapter.cached(mockService.getData);

      // First call should hit the service
      const result1 = await cachedMethod();
      expect(result1).toEqual(expectedData);
      expect(mockService.getData).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await cachedMethod();
      expect(result2).toEqual(expectedData);
      expect(mockService.getData).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should respect TTL and refresh cache', async () => {
      const expectedData = { id: 1, name: 'test' };
      mockService.getData.mockResolvedValue(expectedData);

      const cachingAdapterShortTTL = new CachingAdapter(mockService, 10); // 10ms TTL
      const cachedMethod = cachingAdapterShortTTL.cached(mockService.getData);

      // First call
      await cachedMethod();
      expect(mockService.getData).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second call should hit service again
      await cachedMethod();
      expect(mockService.getData).toHaveBeenCalledTimes(2);
    });

    it('should use custom cache key function', async () => {
      const expectedData = { result: 'test' };
      mockService.getDataWithArgs.mockResolvedValue(expectedData);

      const cachedMethod = cachingAdapter.cached(
        mockService.getDataWithArgs,
        (arg1: string, arg2: number) => `${arg1}-${arg2}`,
      );

      // Calls with different args should be cached separately
      await cachedMethod('test', 1);
      await cachedMethod('test', 2);
      await cachedMethod('test', 1); // This should use cache

      expect(mockService.getDataWithArgs).toHaveBeenCalledTimes(2);
      expect(mockService.getDataWithArgs).toHaveBeenCalledWith('test', 1);
      expect(mockService.getDataWithArgs).toHaveBeenCalledWith('test', 2);
    });

    it('should clear cache', async () => {
      const expectedData = { id: 1 };
      mockService.getData.mockResolvedValue(expectedData);

      const cachedMethod = cachingAdapter.cached(mockService.getData);

      // First call
      await cachedMethod();
      expect(mockService.getData).toHaveBeenCalledTimes(1);

      // Clear cache
      cachingAdapter.clearCache();

      // Next call should hit service again
      await cachedMethod();
      expect(mockService.getData).toHaveBeenCalledTimes(2);
    });

    it('should get underlying service', () => {
      const underlyingService = cachingAdapter.getService();
      expect(underlyingService).toBe(mockService);
    });
  });

  describe('RetryAdapter', () => {
    let mockService: { unreliableMethod: vi.Mock };
    let retryAdapter: RetryAdapter<typeof mockService>;

    beforeEach(() => {
      mockService = {
        unreliableMethod: vi.fn(),
      };
      retryAdapter = new RetryAdapter(mockService, 2, 10); // 2 retries, 10ms delay
    });

    it('should succeed on first try', async () => {
      const expectedResult = 'success';
      mockService.unreliableMethod.mockResolvedValue(expectedResult);

      const retryableMethod = retryAdapter.retryable(mockService.unreliableMethod);
      const result = await retryableMethod('arg1', 'arg2');

      expect(result).toBe(expectedResult);
      expect(mockService.unreliableMethod).toHaveBeenCalledTimes(1);
      expect(mockService.unreliableMethod).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should retry on failure and eventually succeed', async () => {
      const expectedResult = 'success';
      mockService.unreliableMethod
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue(expectedResult);

      const retryableMethod = retryAdapter.retryable(mockService.unreliableMethod);
      const result = await retryableMethod();

      expect(result).toBe(expectedResult);
      expect(mockService.unreliableMethod).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const error = new Error('Persistent failure');
      mockService.unreliableMethod.mockRejectedValue(error);

      const retryableMethod = retryAdapter.retryable(mockService.unreliableMethod);

      await expect(retryableMethod()).rejects.toThrow('Persistent failure');
      expect(mockService.unreliableMethod).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should respect shouldRetry function', async () => {
      const nonRetriableError = new Error('Non-retriable error');

      mockService.unreliableMethod.mockRejectedValue(nonRetriableError);

      const retryableMethod = retryAdapter.retryable(
        mockService.unreliableMethod,
        (error) => error instanceof Error && error.message.includes('Retriable'),
      );

      await expect(retryableMethod()).rejects.toThrow('Non-retriable error');
      expect(mockService.unreliableMethod).toHaveBeenCalledTimes(1); // No retries
    });

    it('should retry with exponential backoff', async () => {
      const startTime = Date.now();
      mockService.unreliableMethod.mockRejectedValue(new Error('Always fails'));

      const retryableMethod = retryAdapter.retryable(mockService.unreliableMethod);

      await expect(retryableMethod()).rejects.toThrow('Always fails');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 10ms + 20ms (exponential backoff)
      // Being lenient with timing in tests
      expect(duration).toBeGreaterThan(20);
    });

    it('should get underlying service', () => {
      const underlyingService = retryAdapter.getService();
      expect(underlyingService).toBe(mockService);
    });
  });

  describe('Adapter composition', () => {
    it('should compose caching and retry adapters', async () => {
      const mockService = { getData: vi.fn() };

      // Wrap with retry first, then caching
      const retryAdapter = new RetryAdapter(mockService, 2, 10);
      const cachingAdapter = new CachingAdapter(retryAdapter.getService(), 1000);

      const expectedData = 'success';
      mockService.getData
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(expectedData);

      const retryableMethod = retryAdapter.retryable(mockService.getData);
      const cachedRetryableMethod = cachingAdapter.cached(retryableMethod);

      // First call should retry and succeed
      const result1 = await cachedRetryableMethod();
      expect(result1).toBe(expectedData);
      expect(mockService.getData).toHaveBeenCalledTimes(2); // Failed once, succeeded on retry

      // Second call should use cache
      const result2 = await cachedRetryableMethod();
      expect(result2).toBe(expectedData);
      expect(mockService.getData).toHaveBeenCalledTimes(2); // No additional calls
    });
  });
});
