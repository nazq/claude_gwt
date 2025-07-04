import { WorktreeResourceProvider } from '../../../../src/mcp/resources/worktree';
import { GitDetector } from '../../../../src/core/git/GitDetector';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';
import { promises as fs } from 'fs';
import type { GitWorktreeInfo } from '../../../../src/types';

jest.mock('../../../../src/core/git/GitDetector');
jest.mock('../../../../src/core/git/WorktreeManager');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

describe('MCP Resource: WorktreeResourceProvider', () => {
  const mockGitDetector = GitDetector as jest.MockedClass<typeof GitDetector>;
  const mockWorktreeManager = WorktreeManager as jest.MockedClass<typeof WorktreeManager>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  const mockWorktrees: GitWorktreeInfo[] = [
    {
      path: '/test/project/main',
      branch: 'main',
      HEAD: 'abc123def456',
      isLocked: false,
      prunable: false,
    },
    {
      path: '/test/project/feature-auth',
      branch: 'feature-auth',
      HEAD: 'def456ghi789',
      isLocked: false,
      prunable: false,
    },
  ];

  let provider: WorktreeResourceProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue('/test/project/main');
    provider = new WorktreeResourceProvider();
  });

  describe('listResources', () => {
    it('should list resources for worktree projects', async () => {
      mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/project',
      });

      const resources = await provider.listResources();

      expect(resources).toHaveLength(3);
      expect(resources[0]).toEqual({
        uri: 'worktree://current',
        name: 'Current Branch Info',
        description: 'Information about the current Git worktree branch',
        mimeType: 'text/markdown',
      });
      expect(resources[1]?.uri).toBe('worktree://branches');
      expect(resources[2]?.uri).toBe('worktree://tasks');
    });

    it('should return empty array for non-worktree projects', async () => {
      mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/project',
      });

      const resources = await provider.listResources();

      expect(resources).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockGitDetector.prototype.detectState = jest
        .fn()
        .mockRejectedValue(new Error('Detection failed'));

      const resources = await provider.listResources();

      expect(resources).toEqual([]);
    });
  });

  describe('readResource', () => {
    beforeEach(() => {
      mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue(mockWorktrees);
    });

    it('should read current branch resource', async () => {
      mockFs.readFile.mockResolvedValue('# Task: Implement Authentication\n\nImplement OAuth2');

      const result = await provider.readResource('worktree://current');

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0];
      expect(content?.uri).toBe('worktree://current');
      expect(content?.mimeType).toBe('text/markdown');
      expect(content?.text).toContain('Current Branch: main');
      expect(content?.text).toContain('**Path:** /test/project/main');
      expect(content?.text).toContain('**HEAD:** abc123de');
      expect(content?.text).toContain('Task: Implement Authentication');
    });

    it('should handle missing current branch', async () => {
      jest.spyOn(process, 'cwd').mockReturnValue('/unknown/path');

      const result = await provider.readResource('worktree://current');

      expect(result.contents[0]?.text).toContain('Not in a Git worktree branch');
    });

    it('should read branches resource', async () => {
      const result = await provider.readResource('worktree://branches');

      const content = result.contents[0];
      expect(content?.uri).toBe('worktree://branches');
      expect(content?.text).toContain('Git Worktree Branches');
      expect(content?.text).toContain('Total: 2');
      expect(content?.text).toContain('**main** *(current)*');
      expect(content?.text).toContain('**feature-auth**');
      expect(content?.text).toContain('Path: /test/project/main');
      expect(content?.text).toContain('HEAD: abc123de');
    });

    it('should read tasks resource', async () => {
      mockFs.readFile
        .mockResolvedValueOnce('# Task: Main branch task')
        .mockRejectedValueOnce(new Error('No task file'));

      const result = await provider.readResource('worktree://tasks');

      const content = result.contents[0];
      expect(content?.uri).toBe('worktree://tasks');
      expect(content?.text).toContain('Branch Tasks');
      expect(content?.text).toContain('## main');
      expect(content?.text).toContain('Task: Main branch task');
      expect(content?.text).toContain('## feature-auth');
      expect(content?.text).toContain('No task assigned');
    });

    it('should handle missing task files', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await provider.readResource('worktree://current');

      expect(result.contents[0]?.text).toContain('No task assigned');
    });

    it('should throw error for unknown resource', async () => {
      await expect(provider.readResource('worktree://unknown')).rejects.toThrow(
        'Unknown resource: worktree://unknown',
      );
    });
  });
});
