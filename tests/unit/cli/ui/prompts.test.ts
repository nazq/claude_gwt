import inquirer from 'inquirer';
import {
  promptForRepoUrl,
  promptForBranchName,
  promptForWorktreeAction,
  selectWorktree,
  confirmAction,
  promptForSubdirectoryName,
  selectAction,
  selectBranch,
} from '../../../../src/cli/ui/prompts';
import type { GitWorktreeInfo } from '../../../../src/types';

jest.mock('inquirer');

const mockPrompt = inquirer.prompt as unknown as jest.Mock;

describe('prompts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('promptForRepoUrl', () => {
    it('should return valid repo URL', async () => {
      const mockUrl = 'https://github.com/user/repo.git';
      mockPrompt.mockResolvedValue({ repoUrl: mockUrl });

      const result = await promptForRepoUrl();

      expect(result).toBe(mockUrl);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'repoUrl',
          message: expect.stringContaining('repository URL'),
        }),
      ]);
    });

    it('should validate various Git URL formats', async () => {
      mockPrompt.mockResolvedValue({ repoUrl: '' });

      await promptForRepoUrl();

      const validator = mockPrompt.mock.calls[0][0][0].validate;

      // Valid URLs
      expect(validator('')).toBe(true); // Empty is valid
      expect(validator('https://github.com/user/repo.git')).toBe(true);
      expect(validator('git@github.com:user/repo.git')).toBe(true);
      expect(validator('ssh://git@github.com/user/repo.git')).toBe(true);
      expect(validator('git://github.com/user/repo.git')).toBe(true);
      expect(validator('file:///path/to/repo')).toBe(true);
      expect(validator('user@host.com:path/to/repo.git')).toBe(true);

      // Invalid URLs
      expect(validator('not-a-url')).toContain('Please enter a valid Git URL');
      expect(validator('ftp://invalid.com')).toContain('Please enter a valid Git URL');
    });
  });

  describe('promptForBranchName', () => {
    it('should return branch name with default', async () => {
      const branchName = 'feature/test';
      mockPrompt.mockResolvedValue({ branchName });

      const result = await promptForBranchName('main');

      expect(result).toBe(branchName);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'branchName',
          default: 'main',
        }),
      ]);
    });

    it('should validate branch names', async () => {
      mockPrompt.mockResolvedValue({ branchName: 'test' });

      await promptForBranchName();

      const validator = mockPrompt.mock.calls[0][0][0].validate;

      // Valid branch names
      expect(validator('feature/test')).toBe(true);
      expect(validator('fix-123')).toBe(true);
      expect(validator('release_1.0')).toBe(true);

      // Invalid branch names
      expect(validator('')).toBe('Branch name is required');
      expect(validator('feature test')).toBe('Invalid branch name');
      expect(validator('feature@test')).toBe('Invalid branch name');
    });
  });

  describe('promptForWorktreeAction', () => {
    const mockWorktrees: GitWorktreeInfo[] = [
      { path: '/path/main', branch: 'main', HEAD: 'abc123', isLocked: false, prunable: false },
      {
        path: '/path/feature',
        branch: 'feature',
        HEAD: 'def456',
        isLocked: false,
        prunable: false,
      },
    ];

    it('should show all options when worktrees exist and sessions active', async () => {
      mockPrompt.mockResolvedValue({ action: 'new' });

      const result = await promptForWorktreeAction(mockWorktrees, true);

      expect(result).toBe('new');
      const choices = mockPrompt.mock.calls[0][0][0].choices;
      expect(choices).toHaveLength(6); // supervisor, new, list, remove, shutdown, exit
      expect(choices.map((c: any) => c.value)).toEqual([
        'supervisor',
        'new',
        'list',
        'remove',
        'shutdown',
        'exit',
      ]);
    });

    it('should not show remove option with single worktree', async () => {
      mockPrompt.mockResolvedValue({ action: 'list' });

      await promptForWorktreeAction([mockWorktrees[0]!], false);

      const choices = mockPrompt.mock.calls[0][0][0].choices;
      expect(choices.map((c: any) => c.value)).not.toContain('remove');
    });

    it('should not show shutdown option without sessions', async () => {
      mockPrompt.mockResolvedValue({ action: 'exit' });

      await promptForWorktreeAction(mockWorktrees, false);

      const choices = mockPrompt.mock.calls[0][0][0].choices;
      expect(choices.map((c: any) => c.value)).not.toContain('shutdown');
    });
  });

  describe('selectWorktree', () => {
    it('should return selected worktree branch', async () => {
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
      mockPrompt.mockResolvedValue({ selection: 'feature' });

      const result = await selectWorktree(worktrees, 'Select a branch:');

      expect(result).toBe('feature');
      const choices = mockPrompt.mock.calls[0][0][0].choices;
      expect(choices).toHaveLength(2);
      expect(choices[0].value).toBe('main');
      expect(choices[1].value).toBe('feature');
    });

    it('should handle detached HEAD', async () => {
      const worktrees: GitWorktreeInfo[] = [
        { path: '/path/detached', branch: '', HEAD: 'abc123', isLocked: false, prunable: false },
      ];
      mockPrompt.mockResolvedValue({ selection: '/path/detached' });

      const result = await selectWorktree(worktrees, 'Select:');

      expect(result).toBe('/path/detached');
      const choices = mockPrompt.mock.calls[0][0][0].choices;
      expect(choices[0].name).toContain('detached');
      expect(choices[0].value).toBe('/path/detached');
    });
  });

  describe('confirmAction', () => {
    it('should return true when confirmed', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await confirmAction('Are you sure?');

      expect(result).toBe(true);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure?',
          default: false,
        }),
      ]);
    });

    it('should return false when not confirmed', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      const result = await confirmAction('Delete this?');

      expect(result).toBe(false);
    });
  });

  describe('promptForSubdirectoryName', () => {
    it('should return subdirectory name with default', async () => {
      const subdirName = 'my-awesome-project';
      mockPrompt.mockResolvedValue({ subdirName });

      const result = await promptForSubdirectoryName();

      expect(result).toBe(subdirName);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: 'my-project',
        }),
      ]);
    });

    it('should validate subdirectory names', async () => {
      mockPrompt.mockResolvedValue({ subdirName: 'test' });

      await promptForSubdirectoryName('custom-default');

      const validator = mockPrompt.mock.calls[0][0][0].validate;

      // Valid names
      expect(validator('my-project')).toBe(true);
      expect(validator('project_123')).toBe(true);
      expect(validator('test.app')).toBe(true);

      // Invalid names
      expect(validator('')).toBe('Subdirectory name is required');
      expect(validator('  ')).toBe('Subdirectory name is required');
      expect(validator('my project')).toContain('Please use only letters');
      expect(validator('project@123')).toContain('Please use only letters');
    });
  });

  describe('selectAction', () => {
    it('should return selected action', async () => {
      const choices = [
        { title: 'Option 1', value: 'opt1' },
        { title: 'Option 2', value: 'opt2' },
      ];
      mockPrompt.mockResolvedValue({ action: 'opt2' });

      const result = await selectAction('Choose:', choices);

      expect(result).toBe('opt2');
      const promptChoices = mockPrompt.mock.calls[0][0][0].choices;
      expect(promptChoices).toEqual([
        { name: 'Option 1', value: 'opt1' },
        { name: 'Option 2', value: 'opt2' },
      ]);
    });
  });

  describe('selectBranch', () => {
    it('should return selected branch', async () => {
      const branches = ['main', 'develop', 'feature/test'];
      mockPrompt.mockResolvedValue({ branch: 'develop' });

      const result = await selectBranch('Select branch:', branches);

      expect(result).toBe('develop');
      const choices = mockPrompt.mock.calls[0][0][0].choices;
      expect(choices).toHaveLength(4); // 3 branches + cancel
      expect(choices[3].value).toBe('cancel');
    });

    it('should include cancel option', async () => {
      mockPrompt.mockResolvedValue({ branch: 'cancel' });

      const result = await selectBranch('Pick one:', ['main']);

      expect(result).toBe('cancel');
    });
  });
});
