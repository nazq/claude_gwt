import inquirer from 'inquirer';
import path from 'path';
import { theme } from './theme';
import type { GitWorktreeInfo } from '../../types';

export async function promptForRepoUrl(): Promise<string> {
  const { repoUrl } = await inquirer.prompt<{ repoUrl: string }>([
    {
      type: 'input',
      name: 'repoUrl',
      message: `${theme.git('Git')} repository URL (leave empty for local init):`,
      validate: (input: string) => {
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
        return isValid || 'Please enter a valid Git URL (https://, git@, ssh://, etc.)';
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
      message: `${theme.branch('Branch')} name:`,
      default: defaultBranch,
      validate: (input: string) => {
        if (!input) return 'Branch name is required';
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
): Promise<'new' | 'list' | 'remove' | 'supervisor' | 'shutdown' | 'exit'> {
  const choices = [];

  // Add supervisor mode option
  choices.push({ name: `${theme.claude('👨‍💼')} Enter supervisor mode`, value: 'supervisor' });

  choices.push(
    { name: `${theme.success('➕')} Create new branch`, value: 'new' },
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
    action: 'new' | 'list' | 'remove' | 'supervisor' | 'shutdown' | 'exit';
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
  message: string,
): Promise<string> {
  const choices = worktrees.map((wt) => ({
    name: `${theme.branch(wt.branch || 'detached')} ${theme.dim(`(${path.basename(wt.path)})`)}`,
    value: wt.branch || wt.path,
  }));

  const { selection } = await inquirer.prompt<{ selection: string }>([
    {
      type: 'list',
      name: 'selection',
      message,
      choices,
    },
  ]);

  return selection;
}

export async function confirmAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);

  return confirmed;
}

export async function promptForSubdirectoryName(defaultName = 'my-project'): Promise<string> {
  const { subdirName } = await inquirer.prompt<{ subdirName: string }>([
    {
      type: 'input',
      name: 'subdirName',
      message: 'Subdirectory name:',
      default: defaultName,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Subdirectory name is required';
        }
        // Check for valid directory name
        const validName = /^[a-zA-Z0-9._\-]+$/.test(input);
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
