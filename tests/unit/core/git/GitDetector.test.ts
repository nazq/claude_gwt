import { vi } from 'vitest';
import { GitDetector } from '../../../../src/core/git/GitDetector';
import { promises as fs } from 'fs';
import { simpleGit } from 'simple-git';
import type { DirectoryState } from '../../../../src/types';

vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock('simple-git');

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
describe('GitDetector', () => {
  const mockFs = fs as vi.Mocked<typeof fs>;
  const mockGit = {
    status: vi.fn(),
    getRemotes: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (simpleGit as vi.Mock).mockReturnValue(mockGit);
  });

  describe('detectState', () => {
    it('should detect empty directory', async () => {
      mockFs.readdir.mockResolvedValue([] as any);

      const detector = new GitDetector('/test/path');
      const result = await detector.detectState();

      expect(result).toEqual<DirectoryState>({
        type: 'empty',
        path: '/test/path',
      });
    });

    it('should create directory if it does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readdir.mockRejectedValue(error);
      mockFs.mkdir.mockResolvedValue(undefined);

      const detector = new GitDetector('/test/path');
      const result = await detector.detectState();

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true });
      expect(result.type).toBe('empty');
    });

    it('should detect non-git directory', async () => {
      mockFs.readdir.mockResolvedValue(['file1.txt', 'file2.txt'] as any);
      mockGit.status.mockRejectedValue(new Error('Not a git repository'));

      const detector = new GitDetector('/test/path');
      const result = await detector.detectState();

      expect(result).toEqual<DirectoryState>({
        type: 'non-git',
        path: '/test/path',
      });
    });

    it('should detect git worktree', async () => {
      mockFs.readdir.mockResolvedValue(['.git', 'file1.txt'] as any);
      mockGit.status.mockResolvedValue({
        current: 'feature-branch',
        tracking: 'origin/feature-branch',
      });
      mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
      mockFs.readFile.mockResolvedValue('gitdir: ../.bare/worktrees/feature-branch');
      mockFs.access.mockRejectedValue(new Error('No .bare directory'));
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } },
      ]);

      const detector = new GitDetector('/test/path');
      const result = await detector.detectState();

      expect(result).toEqual<DirectoryState>({
        type: 'git-worktree',
        path: '/test/path',
        gitInfo: {
          isWorktree: true,
          isBareRepo: false,
          branch: 'feature-branch',
          remote: 'https://github.com/user/repo.git',
        },
      });
    });

    it('should detect regular git repository', async () => {
      mockFs.readdir.mockResolvedValue(['.git', 'file1.txt'] as any);
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
      });
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access.mockRejectedValue(new Error('No .bare directory'));
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } },
      ]);

      const detector = new GitDetector('/test/path');
      const result = await detector.detectState();

      expect(result).toEqual<DirectoryState>({
        type: 'git-repo',
        path: '/test/path',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
          remote: 'https://github.com/user/repo.git',
        },
      });
    });

    it('should detect claude-gwt-parent setup', async () => {
      mockFs.readdir.mockResolvedValue(['.git', '.bare', 'file1.txt'] as any);

      // Mock checks for claude-gwt-parent
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // .bare exists
        .mockResolvedValueOnce({ isDirectory: () => false } as any); // .git is file
      mockFs.readFile.mockResolvedValue('gitdir: ./.bare');
      mockFs.access.mockResolvedValue(undefined); // HEAD exists in .bare

      const detector = new GitDetector('/test/path');
      const result = await detector.detectState();

      expect(result.type).toBe('claude-gwt-parent');
    });

    it('should handle errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const detector = new GitDetector('/test/path');

      await expect(detector.detectState()).rejects.toThrow('Failed to detect directory state');
    });
  });
});
