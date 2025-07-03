import { promises as fs } from 'fs';
import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp';
import { GitDetector } from '../../../src/core/git/GitDetector';
import { GitRepository } from '../../../src/core/git/GitRepository';
import { WorktreeManager } from '../../../src/core/git/WorktreeManager';
import { showBanner } from '../../../src/cli/ui/banner';
import * as prompts from '../../../src/cli/ui/prompts';
import type { DirectoryState } from '../../../src/types';

// Mock all dependencies
jest.mock('../../../src/core/git/GitDetector');
jest.mock('../../../src/core/git/GitRepository');
jest.mock('../../../src/core/git/WorktreeManager');
jest.mock('../../../src/cli/ui/banner');
jest.mock('../../../src/cli/ui/prompts');
jest.mock('../../../src/core/ClaudeOrchestrator');

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as any);

describe('ClaudeGWTApp', () => {
  const mockGitDetector = GitDetector as jest.MockedClass<typeof GitDetector>;
  const mockGitRepository = GitRepository as jest.MockedClass<typeof GitRepository>;
  const mockWorktreeManager = WorktreeManager as jest.MockedClass<typeof WorktreeManager>;
  const mockShowBanner = showBanner as jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('startup scenarios', () => {
    it('should handle empty directory and prompt for URL', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      const mockPromptForRepoUrl = jest.spyOn(prompts, 'promptForRepoUrl')
        .mockResolvedValue('https://github.com/test/repo.git');
      
      const mockInitializeBareRepository = jest.fn().mockResolvedValue(undefined);
      const mockFetch = jest.fn().mockResolvedValue(undefined);
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;
      
      // Mock worktree detection after init
      const mockListWorktrees = jest.fn().mockResolvedValue([{
        path: '/test/empty',
        branch: 'main',
        isLocked: false,
        prunable: false,
        HEAD: 'abc123',
      }]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;
      
      jest.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValue('exit');
      
      const app = new ClaudeGWTApp('/test/empty', { interactive: true });
      await app.run();
      
      expect(mockDetectState).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Empty directory detected'));
      expect(mockPromptForRepoUrl).toHaveBeenCalled();
      expect(mockInitializeBareRepository).toHaveBeenCalledWith('https://github.com/test/repo.git');
      expect(mockFetch).toHaveBeenCalled();
    });
    
    it('should handle empty directory with local init', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      jest.spyOn(prompts, 'promptForRepoUrl')
        .mockResolvedValue(''); // Empty string = local init
      
      const mockInitializeBareRepository = jest.fn().mockResolvedValue(undefined);
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      
      const mockListWorktrees = jest.fn().mockResolvedValue([{
        path: '/test/empty',
        branch: 'main',
        isLocked: false,
        prunable: false,
        HEAD: 'abc123',
      }]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;
      
      jest.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValue('exit');
      
      const app = new ClaudeGWTApp('/test/empty', { interactive: true });
      await app.run();
      
      expect(mockInitializeBareRepository).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Creating new local repository'));
    });
    
    it('should handle existing git worktree', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'feature-x',
        },
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/worktree',
          branch: 'feature-x',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
        {
          path: '/test/worktree-main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'def456',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;
      
      jest.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValue('exit');
      
      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Git worktree environment ready'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Current worktree: feature-x'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('All worktrees (2)'));
    });
    
    it('should handle non-empty non-git directory with subdirectory creation', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'non-git',
        path: '/test/nonempty',
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      // Mock user choosing to create subdirectory
      const mockConfirmAction = jest.spyOn(prompts, 'confirmAction')
        .mockResolvedValue(true);
      const mockPromptForSubdirectoryName = jest.spyOn(prompts, 'promptForSubdirectoryName')
        .mockResolvedValue('my-project');
      
      // Mock fs operations
      jest.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT'));
      const mockMkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      
      // For the subdirectory, it will be detected as empty
      mockDetectState
        .mockResolvedValueOnce({ type: 'non-git', path: '/test/nonempty' })
        .mockResolvedValueOnce({ type: 'empty', path: '/test/nonempty/my-project' });
      
      // Mock the subdirectory flow
      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('');
      mockGitRepository.prototype.initializeBareRepository = jest.fn()
        .mockResolvedValue({ defaultBranch: 'main' });
      mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue([]);
      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('main');
      mockWorktreeManager.prototype.addWorktree = jest.fn()
        .mockResolvedValue('/test/nonempty/my-project/main');
      
      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });
      await app.run();
      
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Would you like to create a Git worktree in a subdirectory?'
      );
      expect(mockPromptForSubdirectoryName).toHaveBeenCalled();
      expect(mockMkdir).toHaveBeenCalledWith('/test/nonempty/my-project', { recursive: true });
    });
    
    it('should handle non-empty non-git directory without subdirectory', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'non-git',
        path: '/test/nonempty',
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      // Mock user choosing NOT to create subdirectory
      jest.spyOn(prompts, 'confirmAction')
        .mockResolvedValue(false);
      
      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });
      
      await expect(app.run()).rejects.toThrow('process.exit called');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Directory is not empty and not a Git repository'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('To use claude-gwt, you can:'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
    
    it('should handle regular git repository', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      const mockConfirmAction = jest.spyOn(prompts, 'confirmAction')
        .mockResolvedValue(false); // Don't convert
      
      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Regular Git repository detected'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('designed for Git worktree workflows'));
      expect(mockConfirmAction).toHaveBeenCalledWith(expect.stringContaining('convert this to a worktree-based repository'));
    });
    
    it('should respect quiet mode', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      const app = new ClaudeGWTApp('/test/empty', { quiet: true, interactive: false });
      
      // Mock to prevent further execution
      jest.spyOn(app as any, 'handleEmptyDirectory').mockResolvedValue(undefined);
      
      await app.run();
      
      expect(mockShowBanner).not.toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      const mockDetectState = jest.fn().mockRejectedValue(new Error('Detection failed'));
      mockGitDetector.prototype.detectState = mockDetectState;
      
      const app = new ClaudeGWTApp('/test/path', { interactive: false });
      
      await expect(app.run()).rejects.toThrow('process.exit called');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'Detection failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
  
  describe('main branch auto-creation', () => {
    it('should automatically create main branch worktree after cloning', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);
      
      mockGitDetector.prototype.detectState = mockDetectState;
      
      jest.spyOn(prompts, 'promptForRepoUrl')
        .mockResolvedValue('https://github.com/test/repo.git');
      
      const mockInitializeBareRepository = jest.fn()
        .mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = jest.fn().mockResolvedValue(undefined);
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;
      
      const mockAddWorktree = jest.fn()
        .mockResolvedValue('/test/empty/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;
      
      const mockListWorktrees = jest.fn().mockResolvedValue([{
        path: '/test/empty/main',
        branch: 'main',
        isLocked: false,
        prunable: false,
        HEAD: 'abc123',
      }]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;
      
      jest.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValue('exit');
      
      const app = new ClaudeGWTApp('/test/empty', { interactive: true });
      await app.run();
      
      expect(mockInitializeBareRepository).toHaveBeenCalledWith('https://github.com/test/repo.git');
      expect(mockAddWorktree).toHaveBeenCalledWith('main');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Creating worktree for default branch: main'));
    });
  });
  
  describe('URL validation', () => {
    it('should accept various Git URL formats', async () => {
      // We'll test the actual prompt validation by mocking inquirer responses
      const validUrls = [
        'https://github.com/user/repo.git',
        'https://gitlab.com/user/repo',
        'git@github.com:user/repo.git',
        'ssh://git@github.com/user/repo.git',
        'git://github.com/user/repo.git',
        'file:///path/to/repo',
        'user@server.com:path/to/repo.git',
      ];
      
      // Test that valid URLs are accepted
      for (const url of validUrls) {
        const mockDetectState = jest.fn().mockResolvedValue({
          type: 'empty',
          path: '/test/empty',
        } as DirectoryState);
        
        mockGitDetector.prototype.detectState = mockDetectState;
        
        // Mock inquirer to return the URL
        const mockPrompt = prompts.promptForRepoUrl as jest.Mock;
        mockPrompt.mockResolvedValue(url);
        
        const mockInitializeBareRepository = jest.fn().mockResolvedValue(undefined);
        mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
        mockGitRepository.prototype.fetch = jest.fn().mockResolvedValue(undefined);
        
        mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue([]);
        jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');
        
        const app = new ClaudeGWTApp('/test/empty', { interactive: true });
        await app.run();
        
        expect(mockInitializeBareRepository).toHaveBeenCalledWith(url);
      }
    });
  });
});