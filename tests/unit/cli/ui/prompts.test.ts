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
});
