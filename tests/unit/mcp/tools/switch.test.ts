import { switchBranchTool } from '../../../../src/mcp/tools/switch';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';
import { promises as fs } from 'fs';
import type { GitWorktreeInfo } from '../../../../src/types';

jest.mock('../../../../src/core/git/WorktreeManager');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('MCP Tool: switch_branch', () => {
  const mockWorktreeManager = WorktreeManager as jest.MockedClass<typeof WorktreeManager>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue('/test/project/main');
  });

  it('should have correct tool definition', () => {
    expect(switchBranchTool.definition.name).toBe('switch_branch');
    expect(switchBranchTool.definition.description).toContain(
      'Switch to a different Git worktree branch',
    );
    expect(switchBranchTool.definition.inputSchema.required).toContain('branch');
  });

  it('should switch to an existing branch', async () => {
    const mockWorktrees: GitWorktreeInfo[] = [
      {
        path: '/test/project/main',
        branch: 'main',
        HEAD: 'abc123',
        isLocked: false,
        prunable: false,
      },
      {
        path: '/test/project/feature-auth',
        branch: 'feature-auth',
        HEAD: 'def456',
        isLocked: false,
        prunable: false,
      },
    ];

    mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue(mockWorktrees);

    const result = await switchBranchTool.handler({ branch: 'feature-auth' });

    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.claude-gwt/context'), {
      recursive: true,
    });

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('main.json'),
      expect.stringContaining('"branch": "main"'),
    );

    expect(result.content).toBeDefined();
    const text = (result.content[0] as any).text;
    expect(text).toContain('Switched to branch: feature-auth');
    expect(text).toContain('Working directory: /test/project/feature-auth');
    expect(text).toContain('cd /test/project/feature-auth');
  });

  it('should handle non-existent branch', async () => {
    const mockWorktrees: GitWorktreeInfo[] = [
      {
        path: '/test/project/main',
        branch: 'main',
        HEAD: 'abc123',
        isLocked: false,
        prunable: false,
      },
    ];

    mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue(mockWorktrees);

    const result = await switchBranchTool.handler({ branch: 'non-existent' });

    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain("Branch 'non-existent' not found");
    expect((result.content[0] as any).text).toContain('Available branches: main');
  });

  it('should handle errors gracefully', async () => {
    mockWorktreeManager.prototype.listWorktrees = jest
      .fn()
      .mockRejectedValue(new Error('Failed to list worktrees'));

    const result = await switchBranchTool.handler({ branch: 'any' });

    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain('Error switching branches');
    expect((result.content[0] as any).text).toContain('Failed to list worktrees');
  });

  it('should save current context before switching', async () => {
    const mockWorktrees: GitWorktreeInfo[] = [
      {
        path: '/test/project/main',
        branch: 'main',
        HEAD: 'abc123',
        isLocked: false,
        prunable: false,
      },
      {
        path: '/test/project/feature-api',
        branch: 'feature-api',
        HEAD: 'ghi789',
        isLocked: false,
        prunable: false,
      },
    ];

    mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue(mockWorktrees);

    await switchBranchTool.handler({ branch: 'feature-api' });

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('main.json'),
      expect.stringContaining('"lastCommand": "switch_branch"'),
    );
  });
});
