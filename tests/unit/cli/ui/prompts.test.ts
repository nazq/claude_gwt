import { vi } from 'vitest';
import * as prompts from '../../../../src/cli/ui/prompts';
import type { GitWorktreeInfo } from '../../../../src/types';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';

interface PromptConfig {
  type: string;
  name: string;
  message: string;
  default?: string;
  validate?: (input: string) => boolean | string;
  choices?: Array<{ name: string; value: string }>;
}

describe('prompts', () => {
  const mockInquirer = inquirer as vi.Mocked<typeof inquirer>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promptForRepoUrl', () => {
    it('should prompt for repository URL and return it', async () => {
      mockInquirer.prompt.mockResolvedValue({ repoUrl: 'https://github.com/user/repo.git' });

      const result = await prompts.promptForRepoUrl();

      expect(result).toBe('https://github.com/user/repo.git');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'repoUrl',
          message: expect.stringContaining('repository URL') as string,
        }),
      ]);
    });

    it('should return empty string for local init', async () => {
      mockInquirer.prompt.mockResolvedValue({ repoUrl: '' });

      const result = await prompts.promptForRepoUrl();

      expect(result).toBe('');
    });

    it('should validate various Git URL formats', async () => {
      mockInquirer.prompt.mockResolvedValue({ repoUrl: 'https://github.com/user/repo.git' });

      await prompts.promptForRepoUrl();

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const validate = promptConfig?.validate;

      // Valid URLs
      expect(validate?.('https://github.com/user/repo.git')).toBe(true);
      expect(validate?.('http://gitlab.com/user/repo.git')).toBe(true);
      expect(validate?.('git@github.com:user/repo.git')).toBe(true);
      expect(validate?.('ssh://git@github.com/user/repo.git')).toBe(true);
      expect(validate?.('git://github.com/user/repo.git')).toBe(true);
      expect(validate?.('file:///path/to/repo')).toBe(true);
      expect(validate?.('user@server.com:path/to/repo.git')).toBe(true);
      expect(validate?.('')).toBe(true); // Empty for local init

      // Invalid URLs
      expect(validate?.('not-a-url')).toContain('Please enter a valid Git URL');
      expect(validate?.('ftp://example.com/repo')).toContain('Please enter a valid Git URL');
    });
  });

  describe('promptForBranchName', () => {
    it('should prompt for branch name and return it', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'feature/new-feature' });

      const result = await prompts.promptForBranchName();

      expect(result).toBe('feature/new-feature');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'branchName',
          message: expect.stringContaining('name') as string,
        }),
      ]);
    });

    it('should use default branch when provided', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'main' });

      await prompts.promptForBranchName('main');

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      expect(promptConfig?.default).toBe('main');
    });

    it('should validate branch names', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'valid-branch' });

      await prompts.promptForBranchName();

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const validate = promptConfig?.validate;

      // Valid branch names
      expect(validate?.('feature/new-feature')).toBe(true);
      expect(validate?.('bugfix-123')).toBe(true);
      expect(validate?.('release_1.0')).toBe(true);
      expect(validate?.('develop')).toBe(true);

      // Invalid branch names
      expect(validate?.('')).toBe('Branch name is required');
      expect(validate?.('feature with spaces')).toBe('Invalid branch name');
      expect(validate?.('feature@branch')).toBe('Invalid branch name');
      expect(validate?.('feature#branch')).toBe('Invalid branch name');
    });
  });

  describe('promptForWorktreeAction', () => {
    it('should show all options when worktrees exist and sessions are active', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'new' });

      const worktrees: GitWorktreeInfo[] = [
        { path: '/path/main', branch: 'main', HEAD: 'abc123', isLocked: false, prunable: false },
        {
          path: '/path/feature',
          branch: 'feature',
          HEAD: 'def456',
          isLocked: false,
          prunable: false,
        },
      ];

      await prompts.promptForWorktreeAction(worktrees, true);

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const choices = promptConfig?.choices ?? [];
      const values = choices.map((c) => c.value);

      expect(values).toContain('supervisor');
      expect(values).toContain('new');
      expect(values).toContain('list');
      expect(values).toContain('remove');
      expect(values).toContain('shutdown');
      expect(values).toContain('exit');
    });

    it('should hide remove option when only one worktree', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'exit' });

      const worktrees: GitWorktreeInfo[] = [
        { path: '/path/main', branch: 'main', HEAD: 'abc123', isLocked: false, prunable: false },
      ];

      await prompts.promptForWorktreeAction(worktrees, false);

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const choices = promptConfig?.choices ?? [];
      const values = choices.map((c) => c.value);

      expect(values).not.toContain('remove');
    });

    it('should hide shutdown option when no sessions', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'exit' });

      const worktrees: GitWorktreeInfo[] = [
        { path: '/path/main', branch: 'main', HEAD: 'abc123', isLocked: false, prunable: false },
      ];

      await prompts.promptForWorktreeAction(worktrees, false);

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const choices = promptConfig?.choices ?? [];
      const values = choices.map((c) => c.value);

      expect(values).not.toContain('shutdown');
    });
  });

  describe('selectWorktree', () => {
    it('should display worktrees for selection', async () => {
      mockInquirer.prompt.mockResolvedValue({ selection: 'feature' });

      const worktrees: GitWorktreeInfo[] = [
        { path: '/repo/main', branch: 'main', HEAD: 'abc123', isLocked: false, prunable: false },
        {
          path: '/repo/feature',
          branch: 'feature',
          HEAD: 'def456',
          isLocked: false,
          prunable: false,
        },
      ];

      const result = await prompts.selectWorktree(worktrees, 'Select a branch:');

      expect(result).toBe('feature');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'selection',
          message: 'Select a branch:',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'main' }),
            expect.objectContaining({ value: 'feature' }),
          ]) as Array<{ name: string; value: string }>,
        }),
      ]);
    });

    it('should handle detached HEAD', async () => {
      mockInquirer.prompt.mockResolvedValue({ selection: '/repo/detached' });

      const worktrees: GitWorktreeInfo[] = [
        { path: '/repo/detached', branch: '', HEAD: 'abc123', isLocked: false, prunable: false },
      ];

      const result = await prompts.selectWorktree(worktrees, 'Select:');

      expect(result).toBe('/repo/detached');

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const choices = promptConfig?.choices ?? [];
      expect(choices[0]?.name).toContain('detached');
      expect(choices[0]?.value).toBe('/repo/detached');
    });
  });

  describe('confirmAction', () => {
    it('should return true when confirmed', async () => {
      mockInquirer.prompt.mockResolvedValue({ confirmed: true });

      const result = await prompts.confirmAction('Are you sure?');

      expect(result).toBe(true);
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure?',
          default: false,
        }),
      ]);
    });

    it('should return false when not confirmed', async () => {
      mockInquirer.prompt.mockResolvedValue({ confirmed: false });

      const result = await prompts.confirmAction('Are you sure?');

      expect(result).toBe(false);
    });
  });

  describe('promptForSubdirectoryName', () => {
    it('should prompt for subdirectory name with default', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'my-app' });

      const result = await prompts.promptForSubdirectoryName();

      expect(result).toBe('my-app');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'subdirName',
          message: 'Subdirectory name:',
          default: 'my-project',
        }),
      ]);
    });

    it('should use provided default name', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'custom-name' });

      await prompts.promptForSubdirectoryName('custom-default');

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      expect(promptConfig?.default).toBe('custom-default');
    });

    it('should validate subdirectory names', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'valid-name' });

      await prompts.promptForSubdirectoryName();

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const validate = promptConfig?.validate;

      // Valid names
      expect(validate?.('my-project')).toBe(true);
      expect(validate?.('app_v1.0')).toBe(true);
      expect(validate?.('test123')).toBe(true);

      // Invalid names
      expect(validate?.('')).toBe('Subdirectory name is required');
      expect(validate?.('   ')).toBe('Subdirectory name is required');
      expect(validate?.('my project')).toBe(
        'Please use only letters, numbers, dots, hyphens, and underscores',
      );
      expect(validate?.('app@2.0')).toBe(
        'Please use only letters, numbers, dots, hyphens, and underscores',
      );
      expect(validate?.('test/folder')).toBe(
        'Please use only letters, numbers, dots, hyphens, and underscores',
      );
    });
  });

  describe('selectAction', () => {
    it('should display custom actions for selection', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'create' });

      const choices = [
        { title: 'Create new file', value: 'create' },
        { title: 'Edit file', value: 'edit' },
        { title: 'Delete file', value: 'delete' },
      ];

      const result = await prompts.selectAction('Choose an action:', choices);

      expect(result).toBe('create');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action' as const,
          message: 'Choose an action:',
          choices: [
            { name: 'Create new file', value: 'create' },
            { name: 'Edit file', value: 'edit' },
            { name: 'Delete file', value: 'delete' },
          ],
        }),
      ]);
    });
  });

  describe('selectBranch', () => {
    it('should display branches with cancel option', async () => {
      mockInquirer.prompt.mockResolvedValue({ branch: 'develop' });

      const branches = ['main', 'develop', 'feature/test'];

      const result = await prompts.selectBranch('Select target branch:', branches);

      expect(result).toBe('develop');

      const promptArgs = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[] | undefined;
      const promptConfig = Array.isArray(promptArgs) ? promptArgs[0] : undefined;
      const choices = promptConfig?.choices ?? [];
      expect(choices).toHaveLength(4); // 3 branches + cancel
      expect(choices[choices.length - 1]?.value).toBe('cancel');
    });

    it('should return cancel when selected', async () => {
      mockInquirer.prompt.mockResolvedValue({ branch: 'cancel' });

      const branches = ['main'];

      const result = await prompts.selectBranch('Select:', branches);

      expect(result).toBe('cancel');
    });
  });
});
