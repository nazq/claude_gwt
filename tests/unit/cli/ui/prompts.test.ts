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
          message: 'Enter Git repository URL:',
        }),
      ]);
    });

    it('should validate URL format', async () => {
      mockInquirer.prompt.mockResolvedValue({ repoUrl: 'https://github.com/user/repo.git' });

      await prompts.promptForRepoUrl();

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      expect(promptConfig).toBeDefined();
      const validator = promptConfig[0]?.validate;
      expect(validator).toBeDefined();

      if (validator) {
        expect(validator('https://github.com/user/repo.git')).toBe(true);
        expect(validator('git@github.com:user/repo.git')).toBe(true);
        expect(validator('invalid-url')).toContain('Please enter a valid Git repository URL');
      }
    });
  });

  describe('promptForFolderName', () => {
    it('should prompt for folder name with default value', async () => {
      mockInquirer.prompt.mockResolvedValue({ folderName: 'repo' });

      const result = await prompts.promptForFolderName('repo');

      expect(result).toBe('repo');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'folderName',
          message: 'Folder name:',
          default: 'repo',
        }),
      ]);
    });

    it('should validate folder name', async () => {
      mockInquirer.prompt.mockResolvedValue({ folderName: 'valid-folder' });

      await prompts.promptForFolderName('default');

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        expect(validator('valid-folder')).toBe(true);
        expect(validator('valid_folder')).toBe(true);
        expect(validator('invalid/folder')).toContain('Invalid folder name');
        expect(validator('..')).toContain('Invalid folder name');
      }
    });
  });

  describe('selectWorktree', () => {
    const mockWorktrees: GitWorktreeInfo[] = [
      {
        path: '/path/to/main',
        branch: 'main',
        isMain: true,
        isCurrent: true,
        head: 'abc123',
      },
      {
        path: '/path/to/feature',
        branch: 'feature-branch',
        isMain: false,
        isCurrent: false,
        head: 'def456',
      },
    ];

    it('should show worktree selection prompt', async () => {
      mockInquirer.prompt.mockResolvedValue({ worktree: mockWorktrees[1] });

      const result = await prompts.selectWorktree(mockWorktrees);

      expect(result).toBe(mockWorktrees[1]);
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'worktree',
          message: 'Select a worktree:',
          choices: expect.arrayContaining([
            expect.objectContaining({
              name: expect.stringContaining('main'),
              value: mockWorktrees[0],
            }),
            expect.objectContaining({
              name: expect.stringContaining('feature-branch'),
              value: mockWorktrees[1],
            }),
          ]),
        }),
      ]);
    });

    it('should mark current worktree in the list', async () => {
      mockInquirer.prompt.mockResolvedValue({ worktree: mockWorktrees[0] });

      await prompts.selectWorktree(mockWorktrees);

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const choices = promptConfig[0]?.choices;

      expect(choices?.[0]?.name).toContain('(current)');
      expect(choices?.[1]?.name).not.toContain('(current)');
    });
  });

  describe('promptForBranchName', () => {
    it('should prompt for branch name', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'feature/new-feature' });

      const result = await prompts.promptForBranchName();

      expect(result).toBe('feature/new-feature');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'branchName',
          message: 'Enter branch name:',
        }),
      ]);
    });

    it('should validate branch name', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'feature/test' });

      await prompts.promptForBranchName();

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        expect(validator('feature/test')).toBe(true);
        expect(validator('bugfix-123')).toBe(true);
        expect(validator('-invalid')).toContain('Invalid branch name');
        expect(validator('invalid-')).toContain('Invalid branch name');
        expect(validator('invalid..branch')).toContain('Invalid branch name');
      }
    });
  });

  describe('confirmAction', () => {
    it('should prompt for confirmation with default true', async () => {
      mockInquirer.prompt.mockResolvedValue({ confirmed: true });

      const result = await prompts.confirmAction('Do you want to proceed?');

      expect(result).toBe(true);
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: 'Do you want to proceed?',
          default: true,
        }),
      ]);
    });

    it('should use custom default value', async () => {
      mockInquirer.prompt.mockResolvedValue({ confirmed: false });

      const result = await prompts.confirmAction('Are you sure?', false);

      expect(result).toBe(false);
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: false,
        }),
      ]);
    });
  });

  describe('showMainMenu', () => {
    it('should show main menu and return selected action', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'switch' });

      const result = await prompts.showMainMenu();

      expect(result).toBe('switch');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'switch' }),
            expect.objectContaining({ value: 'create' }),
            expect.objectContaining({ value: 'delete' }),
            expect.objectContaining({ value: 'refresh' }),
            expect.objectContaining({ value: 'exit' }),
          ]),
        }),
      ]);
    });
  });

  describe('showEmptyDirectoryMenu', () => {
    it('should show empty directory menu', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'clone' });

      const result = await prompts.showEmptyDirectoryMenu();

      expect(result).toBe('clone');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'This directory is empty. What would you like to do?',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'clone' }),
            expect.objectContaining({ value: 'exit' }),
          ]),
        }),
      ]);
    });
  });

  describe('showNonEmptyDirectoryMenu', () => {
    it('should show non-empty directory menu', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'subdirectory' });

      const result = await prompts.showNonEmptyDirectoryMenu();

      expect(result).toBe('subdirectory');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'This directory is not empty. What would you like to do?',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'subdirectory' }),
            expect.objectContaining({ value: 'exit' }),
          ]),
        }),
      ]);
    });
  });

  describe('showRegularRepoMenu', () => {
    it('should show regular repo menu', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'convert' });

      const result = await prompts.showRegularRepoMenu();

      expect(result).toBe('convert');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'This is a regular Git repository. What would you like to do?',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'convert' }),
            expect.objectContaining({ value: 'exit' }),
          ]),
        }),
      ]);
    });
  });

  describe('promptForWorktreeAction', () => {
    const mockWorktrees: GitWorktreeInfo[] = [
      {
        path: '/path/to/main',
        branch: 'main',
        isMain: true,
        isCurrent: true,
        head: 'abc123',
      },
      {
        path: '/path/to/feature',
        branch: 'feature-branch',
        isMain: false,
        isCurrent: false,
        head: 'def456',
      },
    ];

    it('should show all options when multiple worktrees exist and has sessions', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'new' });

      const result = await prompts.promptForWorktreeAction(mockWorktrees, true);

      expect(result).toBe('new');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'supervisor' }),
            expect.objectContaining({ value: 'new' }),
            expect.objectContaining({ value: 'list' }),
            expect.objectContaining({ value: 'remove' }),
            expect.objectContaining({ value: 'shutdown' }),
            expect.objectContaining({ value: 'exit' }),
          ]),
        }),
      ]);
    });

    it('should hide remove option with single worktree', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'list' });

      const singleWorktree = [mockWorktrees[0]];
      const result = await prompts.promptForWorktreeAction(singleWorktree, false);

      expect(result).toBe('list');
      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const choices = promptConfig[0]?.choices;

      expect(choices?.find((c) => c.value === 'remove')).toBeUndefined();
      expect(choices?.find((c) => c.value === 'shutdown')).toBeUndefined();
    });

    it('should return supervisor action', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'supervisor' });

      const result = await prompts.promptForWorktreeAction(mockWorktrees);

      expect(result).toBe('supervisor');
    });

    it('should return shutdown action when sessions exist', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'shutdown' });

      const result = await prompts.promptForWorktreeAction(mockWorktrees, true);

      expect(result).toBe('shutdown');
    });
  });

  describe('promptForSubdirectoryName', () => {
    it('should prompt for subdirectory name with default', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'my-project' });

      const result = await prompts.promptForSubdirectoryName();

      expect(result).toBe('my-project');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'subdirName',
          message: 'Subdirectory name:',
          default: 'my-project',
        }),
      ]);
    });

    it('should validate subdirectory name', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'valid-name' });

      await prompts.promptForSubdirectoryName('custom-default');

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        expect(validator('valid-name')).toBe(true);
        expect(validator('valid_name')).toBe(true);
        expect(validator('valid.name')).toBe(true);
        expect(validator('')).toContain('Subdirectory name is required');
        expect(validator('   ')).toContain('Subdirectory name is required');
        expect(validator('invalid/name')).toContain('Please use only letters');
        expect(validator('invalid name')).toContain('Please use only letters');
        expect(validator('invalid@name')).toContain('Please use only letters');
      }
    });
  });

  describe('selectAction', () => {
    it('should show action selection prompt', async () => {
      const choices = [
        { title: 'Option 1', value: 'opt1' },
        { title: 'Option 2', value: 'opt2' },
        { title: 'Option 3', value: 'opt3' },
      ];

      mockInquirer.prompt.mockResolvedValue({ action: 'opt2' });

      const result = await prompts.selectAction('Choose an option:', choices);

      expect(result).toBe('opt2');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'Choose an option:',
          choices: [
            { name: 'Option 1', value: 'opt1' },
            { name: 'Option 2', value: 'opt2' },
            { name: 'Option 3', value: 'opt3' },
          ],
        }),
      ]);
    });

    it('should handle empty choices array', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: undefined });

      const result = await prompts.selectAction('No options available', []);

      expect(result).toBeUndefined();
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: [],
        }),
      ]);
    });
  });

  describe('selectBranch', () => {
    it('should show branch selection with cancel option', async () => {
      const branches = ['main', 'develop', 'feature-1'];
      mockInquirer.prompt.mockResolvedValue({ branch: 'develop' });

      const result = await prompts.selectBranch('Select a branch:', branches);

      expect(result).toBe('develop');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'branch',
          message: 'Select a branch:',
          choices: expect.arrayContaining([
            { name: 'main', value: 'main' },
            { name: 'develop', value: 'develop' },
            { name: 'feature-1', value: 'feature-1' },
            expect.objectContaining({ value: 'cancel' }),
          ]),
        }),
      ]);
    });

    it('should handle cancel selection', async () => {
      mockInquirer.prompt.mockResolvedValue({ branch: 'cancel' });

      const result = await prompts.selectBranch('Select a branch:', ['main']);

      expect(result).toBe('cancel');
    });

    it('should handle empty branches array', async () => {
      mockInquirer.prompt.mockResolvedValue({ branch: 'cancel' });

      const result = await prompts.selectBranch('No branches available:', []);

      expect(result).toBe('cancel');
      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const choices = promptConfig[0]?.choices;

      // Should only have cancel option
      expect(choices?.length).toBe(1);
      expect(choices?.[0]?.value).toBe('cancel');
    });
  });

  describe('promptForRepoUrl edge cases', () => {
    it('should allow empty input', async () => {
      mockInquirer.prompt.mockResolvedValue({ repoUrl: '' });

      await prompts.promptForRepoUrl();

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        expect(validator('')).toBe(true); // Empty input is allowed
      }
    });

    it('should validate various Git URL formats', async () => {
      mockInquirer.prompt.mockResolvedValue({ repoUrl: 'git@github.com:user/repo.git' });

      await prompts.promptForRepoUrl();

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        // Test all supported formats
        expect(validator('https://github.com/user/repo.git')).toBe(true);
        expect(validator('http://gitlab.com/user/repo.git')).toBe(true);
        expect(validator('git@github.com:user/repo.git')).toBe(true);
        expect(validator('ssh://git@github.com/user/repo.git')).toBe(true);
        expect(validator('git://github.com/user/repo.git')).toBe(true);
        expect(validator('file:///path/to/repo')).toBe(true);
        expect(validator('user@example.com:path/to/repo.git')).toBe(true);

        // Invalid formats
        expect(validator('not-a-url')).toContain('Please enter a valid Git repository URL');
        expect(validator('ftp://invalid.com')).toContain('Please enter a valid Git repository URL');
      }
    });
  });

  describe('promptForBranchName edge cases', () => {
    it('should use default branch name', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'feature/default' });

      const result = await prompts.promptForBranchName('feature/default');

      expect(result).toBe('feature/default');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: 'feature/default',
        }),
      ]);
    });

    it('should reject empty branch name', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'valid-branch' });

      await prompts.promptForBranchName();

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        expect(validator('')).toContain('Branch name is required');
      }
    });

    it('should allow various valid branch name formats', async () => {
      mockInquirer.prompt.mockResolvedValue({ branchName: 'valid' });

      await prompts.promptForBranchName();

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        expect(validator('feature/new-feature')).toBe(true);
        expect(validator('bugfix-123')).toBe(true);
        expect(validator('release_v1.0.0')).toBe(true);
        expect(validator('user.feature')).toBe(true);
        expect(validator('UPPERCASE')).toBe(true);
      }
    });
  });

  describe('promptForFolderName edge cases', () => {
    it('should reject empty folder name', async () => {
      mockInquirer.prompt.mockResolvedValue({ folderName: 'valid' });

      await prompts.promptForFolderName();

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const validator = promptConfig[0]?.validate;

      if (validator) {
        expect(validator('')).toContain('Folder name is required');
      }
    });
  });

  describe('selectWorktree edge cases', () => {
    it('should use custom message', async () => {
      const worktrees: GitWorktreeInfo[] = [
        {
          path: '/path',
          branch: 'main',
          isMain: true,
          isCurrent: false,
          head: 'abc',
        },
      ];

      mockInquirer.prompt.mockResolvedValue({ worktree: worktrees[0] });

      await prompts.selectWorktree(worktrees, 'Choose a branch to switch to:');

      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          message: 'Choose a branch to switch to:',
        }),
      ]);
    });

    it('should handle main branch that is not current', async () => {
      const worktrees: GitWorktreeInfo[] = [
        {
          path: '/main',
          branch: 'main',
          isMain: true,
          isCurrent: false,
          head: 'abc',
        },
      ];

      mockInquirer.prompt.mockResolvedValue({ worktree: worktrees[0] });

      await prompts.selectWorktree(worktrees);

      const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
      const choices = promptConfig[0]?.choices;

      expect(choices?.[0]?.name).toContain('main (main)');
      expect(choices?.[0]?.name).not.toContain('(current)');
    });
  });
});
