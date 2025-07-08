import inquirer from 'inquirer';
import type { GitWorktreeInfo } from '../../types/index.js';
import { theme } from './theme.js';

export async function promptForRepoUrl(): Promise<string> {
  const { repoUrl } = await inquirer.prompt<{ repoUrl: string }>([
    {
      type: 'input',
      name: 'repoUrl',
      message: 'Enter Git repository URL:',
      validate: (input: string): boolean | string => {
        if (!input) return true;
        // Support various Git URL formats
        const patterns = [
          /^https?:\/\/.+/, // HTTP(S) URLs
          /^git@.+:.+/, // SSH (git@host:path)
          /^ssh:\/\/.+/, // SSH URLs
          /^git:\/\/.+/, // Git protocol
          /^file:\/\/.+/, // Local file
          /^[a-zA-Z0-9_-]+@[a-zA-Z0-9.-]+:.+/, // Generic SSH format
        ];
        const isValid = patterns.some((pattern) => pattern.test(input));
        return isValid || 'Please enter a valid Git repository URL';
      },
    },
  ]);

  return repoUrl;
}

export async function promptForBranchName(defaultBranch?: string): Promise<string> {
  const { branchName } = await inquirer.prompt<{ branchName: string }>([
    {
      type: 'input',
      name: 'branchName',
      message: 'Enter branch name:',
      default: defaultBranch,
      validate: (input: string): boolean | string => {
        if (!input) return 'Branch name is required';
        // Check for invalid patterns
        if (input.startsWith('-') || input.endsWith('-') || input.includes('..')) {
          return 'Invalid branch name';
        }
        const validBranch = /^[a-zA-Z0-9._\-/]+$/.test(input);
        return validBranch || 'Invalid branch name';
      },
    },
  ]);

  return branchName;
}

export async function promptForWorktreeAction(
  worktrees: GitWorktreeInfo[],
  hasSessions: boolean = false,
): Promise<'new' | 'existing' | 'list' | 'remove' | 'supervisor' | 'shutdown' | 'exit'> {
  const choices = [];

  // Add supervisor mode option
  choices.push({ name: `${theme.claude('👨‍💼')} Enter supervisor mode`, value: 'supervisor' });

  choices.push(
    { name: `${theme.success('➕')} Create new branch`, value: 'new' },
    { name: `${theme.success('🔗')} Add worktree for existing branch`, value: 'existing' },
    { name: `${theme.info('📋')} List all branches`, value: 'list' },
  );

  if (worktrees.length > 1) {
    choices.push({ name: `${theme.error('🗑️')} Remove branch`, value: 'remove' });
  }

  if (hasSessions) {
    choices.push({ name: `${theme.error('🛑')} Shutdown all sessions`, value: 'shutdown' });
  }

  choices.push({ name: `${theme.muted('🚪')} Exit`, value: 'exit' });

  const { action } = await inquirer.prompt<{
    action: 'new' | 'existing' | 'list' | 'remove' | 'supervisor' | 'shutdown' | 'exit';
  }>([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
    },
  ]);

  return action;
}

export async function selectWorktree(
  worktrees: GitWorktreeInfo[],
  message = 'Select a worktree:',
): Promise<GitWorktreeInfo | undefined> {
  const choices = worktrees.map((wt) => ({
    name: `${wt.branch} (${wt.isMain ? 'main' : wt.branch})${wt.isCurrent ? ' (current)' : ''}`,
    value: wt,
  }));

  const { worktree } = await inquirer.prompt<{ worktree: GitWorktreeInfo }>([
    {
      type: 'list',
      name: 'worktree',
      message,
      choices,
    },
  ]);

  return worktree;
}

export async function confirmAction(message: string, defaultValue = true): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);

  return confirmed;
}

export async function promptForFolderName(defaultName = 'my-project'): Promise<string> {
  const { folderName } = await inquirer.prompt<{ folderName: string }>([
    {
      type: 'input',
      name: 'folderName',
      message: 'Folder name:',
      default: defaultName,
      validate: (input: string): boolean | string => {
        if (!input) return 'Folder name is required';
        // Disallow .. and paths with /
        if (input === '..' || input.includes('/')) return 'Invalid folder name';
        const valid = /^[a-zA-Z0-9._-]+$/.test(input);
        return valid || 'Invalid folder name';
      },
    },
  ]);

  return folderName;
}

export async function promptForSubdirectoryName(defaultName = 'my-project'): Promise<string> {
  const { subdirName } = await inquirer.prompt<{ subdirName: string }>([
    {
      type: 'input',
      name: 'subdirName',
      message: 'Subdirectory name:',
      default: defaultName,
      validate: (input: string): boolean | string => {
        if (!input || input.trim().length === 0) {
          return 'Subdirectory name is required';
        }
        // Check for valid directory name
        const validName = /^[a-zA-Z0-9._-]+$/.test(input);
        if (!validName) {
          return 'Please use only letters, numbers, dots, hyphens, and underscores';
        }
        return true;
      },
    },
  ]);

  return subdirName;
}

export async function selectAction(
  message: string,
  choices: Array<{ title: string; value: string }>,
): Promise<string> {
  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message,
      choices: choices.map((c) => ({ name: c.title, value: c.value })),
    },
  ]);

  return action;
}

export async function selectBranch(message: string, branches: string[]): Promise<string> {
  const choices = [
    ...branches.map((b) => ({ name: b, value: b })),
    { name: theme.muted('Cancel'), value: 'cancel' },
  ];

  const { branch } = await inquirer.prompt<{ branch: string }>([
    {
      type: 'list',
      name: 'branch',
      message,
      choices,
    },
  ]);

  return branch;
}

export async function selectExistingBranch(branches: string[]): Promise<string | null> {
  if (branches.length === 0) {
    console.log(theme.warning('\nNo existing branches without worktrees found.'));
    console.log(theme.muted('All branches already have worktrees or there are no other branches.'));
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...',
      },
    ]);
    return null;
  }

  const choices = [
    ...branches.map((b) => ({
      name: `${theme.branch(b)}`,
      value: b,
    })),
    { name: theme.muted('Cancel'), value: 'cancel' },
  ];

  const { branch } = await inquirer.prompt<{ branch: string }>([
    {
      type: 'list',
      name: 'branch',
      message: 'Select an existing branch to create a worktree for:',
      choices,
      pageSize: 15,
    },
  ]);

  return branch === 'cancel' ? null : branch;
}

// Legacy menu functions for backward compatibility
export async function showMainMenu(): Promise<string> {
  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: theme.primary('Switch to existing worktree'), value: 'switch' },
        { name: theme.success('Create new worktree'), value: 'create' },
        { name: theme.error('Delete worktree'), value: 'delete' },
        { name: theme.secondary('Refresh worktrees'), value: 'refresh' },
        { name: theme.muted('Exit'), value: 'exit' },
      ],
    },
  ]);
  return action;
}

export async function showEmptyDirectoryMenu(): Promise<string> {
  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message: 'This directory is empty. What would you like to do?',
      choices: [
        { name: theme.success('Clone a repository'), value: 'clone' },
        { name: theme.muted('Exit'), value: 'exit' },
      ],
    },
  ]);
  return action;
}

export async function showNonEmptyDirectoryMenu(): Promise<string> {
  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message: 'This directory is not empty. What would you like to do?',
      choices: [
        { name: theme.warning('Clone into subdirectory'), value: 'subdirectory' },
        { name: theme.muted('Exit'), value: 'exit' },
      ],
    },
  ]);
  return action;
}

export async function showRegularRepoMenu(): Promise<string> {
  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message: 'This is a regular Git repository. What would you like to do?',
      choices: [
        { name: theme.success('Convert to worktree repository'), value: 'convert' },
        { name: theme.muted('Exit'), value: 'exit' },
      ],
    },
  ]);
  return action;
}
