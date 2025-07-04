import { WorktreeManager } from '../../core/git/WorktreeManager';
import { GitDetector } from '../../core/git/GitDetector';
import path from 'path';
import { promises as fs } from 'fs';

export class WorktreeResourceProvider {
  async listResources() {
    try {
      const detector = new GitDetector(process.cwd());
      const state = await detector.detectState();

      if (state.type !== 'claude-gwt-parent' && state.type !== 'git-worktree') {
        return [];
      }

      const resources = [
        {
          uri: 'worktree://current',
          name: 'Current Branch Info',
          description: 'Information about the current Git worktree branch',
          mimeType: 'text/markdown',
        },
        {
          uri: 'worktree://branches',
          name: 'All Branches',
          description: 'List of all Git worktree branches',
          mimeType: 'text/markdown',
        },
        {
          uri: 'worktree://tasks',
          name: 'Branch Tasks',
          description: 'Tasks assigned to each branch',
          mimeType: 'text/markdown',
        },
      ];

      return resources;
    } catch {
      return [];
    }
  }

  async readResource(uri: string) {
    const manager = new WorktreeManager(process.cwd());

    switch (uri) {
      case 'worktree://current': {
        const worktrees = await manager.listWorktrees();
        const current = worktrees.find((wt) => wt.path === process.cwd());

        if (!current) {
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: '# Current Branch\n\nNot in a Git worktree branch.',
              },
            ],
          };
        }

        const taskFile = path.join(process.cwd(), 'TASK.md');
        let taskContent = 'No task assigned';

        try {
          taskContent = await fs.readFile(taskFile, 'utf-8');
        } catch {
          // No task file
        }

        const content =
          `# Current Branch: ${current.branch}\n\n` +
          `**Path:** ${current.path}\n` +
          `**HEAD:** ${current.HEAD.substring(0, 8)}\n\n` +
          `## Task\n\n${taskContent}`;

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: content,
            },
          ],
        };
      }

      case 'worktree://branches': {
        const worktrees = await manager.listWorktrees();
        const branchList = worktrees
          .map((wt) => {
            const current = wt.path === process.cwd() ? ' *(current)*' : '';
            return `- **${wt.branch}**${current}\n  - Path: ${wt.path}\n  - HEAD: ${wt.HEAD.substring(0, 8)}`;
          })
          .join('\n\n');

        const content = `# Git Worktree Branches\n\nTotal: ${worktrees.length}\n\n${branchList}`;

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: content,
            },
          ],
        };
      }

      case 'worktree://tasks': {
        const worktrees = await manager.listWorktrees();
        const taskReports = await Promise.all(
          worktrees.map(async (wt) => {
            const taskFile = path.join(wt.path, 'TASK.md');
            try {
              const content = await fs.readFile(taskFile, 'utf-8');
              return `## ${wt.branch}\n\n${content}`;
            } catch {
              return `## ${wt.branch}\n\nNo task assigned.`;
            }
          }),
        );

        const content = `# Branch Tasks\n\n${taskReports.join('\n\n---\n\n')}`;

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: content,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }
}
