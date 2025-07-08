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
      { path: '/path/main', branch: 'main', isMain: true, isCurrent: false },
      { path: '/path/feature', branch: 'feature', isMain: false, isCurrent: true },
    ];

    it('should prompt for worktree action with supervisor mode', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'supervisor' });

      const result = await prompts.promptForWorktreeAction(mockWorktrees);

      expect(result).toBe('supervisor');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'supervisor' }),
            expect.objectContaining({ value: 'new' }),
            expect.objectContaining({ value: 'list' }),
            expect.objectContaining({ value: 'exit' }),
          ]),
        }),
      ]);
    });

    it('should show remove option when multiple worktrees exist', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'remove' });

      const result = await prompts.promptForWorktreeAction(mockWorktrees);

      expect(result).toBe('remove');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: expect.arrayContaining([expect.objectContaining({ value: 'remove' })]),
        }),
      ]);
    });

    it('should not show remove option with single worktree', async () => {
      const singleWorktree = [mockWorktrees[0]];
      mockInquirer.prompt.mockResolvedValue({ action: 'new' });

      await prompts.promptForWorktreeAction(singleWorktree);

      const promptCall = mockInquirer.prompt.mock.calls[0][0] as PromptConfig[];
      const choices = promptCall[0]?.choices;
      const hasRemove = choices?.some((choice) => choice.value === 'remove');
      expect(hasRemove).toBe(false);
    });

    it('should show shutdown option when sessions exist', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'shutdown' });

      const result = await prompts.promptForWorktreeAction(mockWorktrees, true);

      expect(result).toBe('shutdown');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: expect.arrayContaining([expect.objectContaining({ value: 'shutdown' })]),
        }),
      ]);
    });

    it('should not show shutdown option when no sessions exist', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: 'new' });

      await prompts.promptForWorktreeAction(mockWorktrees, false);

      const promptCall = mockInquirer.prompt.mock.calls[0][0] as PromptConfig[];
      const choices = promptCall[0]?.choices;
      const hasShutdown = choices?.some((choice) => choice.value === 'shutdown');
      expect(hasShutdown).toBe(false);
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
          validate: expect.any(Function),
        }),
      ]);
    });

    it('should use custom default name', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'custom-name' });

      const result = await prompts.promptForSubdirectoryName('custom-name');

      expect(result).toBe('custom-name');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: 'custom-name',
        }),
      ]);
    });

    it('should validate subdirectory name - reject empty input', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'valid-name' });

      await prompts.promptForSubdirectoryName();

      const promptCall = mockInquirer.prompt.mock.calls[0][0] as PromptConfig[];
      const validator = promptCall[0]?.validate;

      expect(validator?.('')).toBe('Subdirectory name is required');
      expect(validator?.('   ')).toBe('Subdirectory name is required');
    });

    it('should validate subdirectory name - reject invalid characters', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'valid-name' });

      await prompts.promptForSubdirectoryName();

      const promptCall = mockInquirer.prompt.mock.calls[0][0] as PromptConfig[];
      const validator = promptCall[0]?.validate;

      expect(validator?.('invalid/name')).toBe(
        'Please use only letters, numbers, dots, hyphens, and underscores',
      );
      expect(validator?.('invalid name')).toBe(
        'Please use only letters, numbers, dots, hyphens, and underscores',
      );
      expect(validator?.('invalid@name')).toBe(
        'Please use only letters, numbers, dots, hyphens, and underscores',
      );
    });

    it('should validate subdirectory name - accept valid names', async () => {
      mockInquirer.prompt.mockResolvedValue({ subdirName: 'valid-name' });

      await prompts.promptForSubdirectoryName();

      const promptCall = mockInquirer.prompt.mock.calls[0][0] as PromptConfig[];
      const validator = promptCall[0]?.validate;

      expect(validator?.('valid-name')).toBe(true);
      expect(validator?.('valid_name')).toBe(true);
      expect(validator?.('valid.name')).toBe(true);
      expect(validator?.('validname123')).toBe(true);
    });
  });

  describe('selectAction', () => {
    it('should prompt for action selection', async () => {
      const choices = [
        { title: 'Option 1', value: 'option1' },
        { title: 'Option 2', value: 'option2' },
      ];
      mockInquirer.prompt.mockResolvedValue({ action: 'option1' });

      const result = await prompts.selectAction('Choose an option:', choices);

      expect(result).toBe('option1');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'Choose an option:',
          choices: [
            { name: 'Option 1', value: 'option1' },
            { name: 'Option 2', value: 'option2' },
          ],
        }),
      ]);
    });

    it('should handle empty choices array', async () => {
      mockInquirer.prompt.mockResolvedValue({ action: '' });

      const result = await prompts.selectAction('Choose:', []);

      expect(result).toBe('');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: [],
        }),
      ]);
    });
  });

  describe('selectBranch', () => {
    it('should prompt for branch selection', async () => {
      const branches = ['main', 'feature', 'develop'];
      mockInquirer.prompt.mockResolvedValue({ branch: 'feature' });

      const result = await prompts.selectBranch('Select a branch:', branches);

      expect(result).toBe('feature');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'branch',
          message: 'Select a branch:',
          choices: [
            { name: 'main', value: 'main' },
            { name: 'feature', value: 'feature' },
            { name: 'develop', value: 'develop' },
            expect.objectContaining({ value: 'cancel' }),
          ],
        }),
      ]);
    });

    it('should include cancel option', async () => {
      mockInquirer.prompt.mockResolvedValue({ branch: 'cancel' });

      const result = await prompts.selectBranch('Select:', ['main']);

      expect(result).toBe('cancel');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: expect.arrayContaining([expect.objectContaining({ value: 'cancel' })]),
        }),
      ]);
    });

    it('should handle empty branches array', async () => {
      mockInquirer.prompt.mockResolvedValue({ branch: 'cancel' });

      const result = await prompts.selectBranch('Select:', []);

      expect(result).toBe('cancel');
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: [expect.objectContaining({ value: 'cancel' })],
        }),
      ]);
    });
  });
});
