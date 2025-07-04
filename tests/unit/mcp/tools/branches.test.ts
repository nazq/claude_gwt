import { listBranchesTool } from '../../../../src/mcp/tools/branches';
import { GitDetector } from '../../../../src/core/git/GitDetector';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';
import type { GitWorktreeInfo } from '../../../../src/types';

jest.mock('../../../../src/core/git/GitDetector');
jest.mock('../../../../src/core/git/WorktreeManager');

describe('MCP Tool: list_branches', () => {
  const mockGitDetector = GitDetector as jest.MockedClass<typeof GitDetector>;
  const mockWorktreeManager = WorktreeManager as jest.MockedClass<typeof WorktreeManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
  });

  it('should have correct tool definition', () => {
    expect(listBranchesTool.definition.name).toBe('list_branches');
    expect(listBranchesTool.definition.description).toContain('List all Git worktree branches');
    expect(listBranchesTool.definition.inputSchema.properties).toHaveProperty('showDetails');
  });

  it('should list branches in a worktree project', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'git-worktree',
      path: '/test/project',
    });

    const mockWorktrees: GitWorktreeInfo[] = [
      {
        path: '/test/project',
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

    mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue(mockWorktrees);

    const result = await listBranchesTool.handler({});

    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text).toContain('Git Worktree Branches (2)');
    expect(text).toContain('main ← current');
    expect(text).toContain('feature-auth');
  });

  it('should show detailed information when requested', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'git-worktree',
      path: '/test/project',
    });

    const mockWorktrees: GitWorktreeInfo[] = [
      {
        path: '/test/project/main',
        branch: 'main',
        HEAD: 'abc123def456',
        isLocked: false,
        prunable: false,
      },
    ];

    mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue(mockWorktrees);

    const result = await listBranchesTool.handler({ showDetails: true });
    expect(result.content).toBeDefined();
    const text = (result.content[0] as any).text;

    expect(text).toContain('Path: /test/project/main');
    expect(text).toContain('HEAD: abc123de');
  });

  it('should handle non-worktree projects', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'git-repo',
      path: '/test/project',
    });

    const result = await listBranchesTool.handler({});

    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain('Not a Git worktree project');
    expect((result.content[0] as any).text).toContain('create_branch');
  });

  it('should handle empty worktree list', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'claude-gwt-parent',
      path: '/test/project',
    });

    mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue([]);

    const result = await listBranchesTool.handler({});

    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain('No worktree branches found');
  });

  it('should handle errors gracefully', async () => {
    mockGitDetector.prototype.detectState = jest
      .fn()
      .mockRejectedValue(new Error('Detection failed'));

    const result = await listBranchesTool.handler({});

    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain('Error listing branches');
    expect((result.content[0] as any).text).toContain('Detection failed');
  });
});
