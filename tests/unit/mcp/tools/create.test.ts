import { createBranchTool } from '../../../../src/mcp/tools/create';
import { GitDetector } from '../../../../src/core/git/GitDetector';
import { GitRepository } from '../../../../src/core/git/GitRepository';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';

jest.mock('../../../../src/core/git/GitDetector');
jest.mock('../../../../src/core/git/GitRepository');
jest.mock('../../../../src/core/git/WorktreeManager');

describe('MCP Tool: create_branch', () => {
  const mockGitDetector = GitDetector as jest.MockedClass<typeof GitDetector>;
  const mockGitRepository = GitRepository as jest.MockedClass<typeof GitRepository>;
  const mockWorktreeManager = WorktreeManager as jest.MockedClass<typeof WorktreeManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
  });

  it('should have correct tool definition', () => {
    expect(createBranchTool.definition.name).toBe('create_branch');
    expect(createBranchTool.definition.description).toContain('Create a new Git worktree branch');
    expect(createBranchTool.definition.inputSchema.required).toContain('branch');
    expect(createBranchTool.definition.inputSchema.properties).toHaveProperty('baseBranch');
    expect(createBranchTool.definition.inputSchema.properties).toHaveProperty('setupWorktree');
  });

  it('should create a new branch in existing worktree project', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'git-worktree',
      path: '/test/project',
    });

    mockWorktreeManager.prototype.addWorktree = jest.fn().mockResolvedValue(
      '/test/project/feature-new'
    );

    const result = await createBranchTool.handler({ branch: 'feature-new' });
    
    expect(mockWorktreeManager.prototype.addWorktree).toHaveBeenCalledWith('feature-new', undefined);
    
    expect(result.content).toBeDefined();
    const text = (result.content[0] as any).text;
    expect(text).toContain('Created branch: feature-new');
    expect(text).toContain('Location: /test/project/feature-new');
    expect(text).toContain('switch_branch feature-new');
  });

  it('should create branch with base branch', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'claude-gwt-parent',
      path: '/test/project',
    });

    mockWorktreeManager.prototype.addWorktree = jest.fn().mockResolvedValue(
      '/test/project/feature-new'
    );

    await createBranchTool.handler({ 
      branch: 'feature-new',
      baseBranch: 'develop'
    });
    
    expect(mockWorktreeManager.prototype.addWorktree).toHaveBeenCalledWith('feature-new', 'develop');
  });

  it('should initialize worktree setup if not present', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'git-repo',
      path: '/test/project',
    });

    mockGitRepository.prototype.initializeBareRepository = jest.fn().mockResolvedValue({
      defaultBranch: 'main'
    });

    const result = await createBranchTool.handler({ 
      branch: 'feature-new',
      setupWorktree: true
    });
    
    expect(mockGitRepository.prototype.initializeBareRepository).toHaveBeenCalled();
    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain('Initialized Git worktree setup');
    expect((result.content[0] as any).text).toContain('run the command again');
  });

  it('should reject non-worktree without setup flag', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'git-repo',
      path: '/test/project',
    });

    const result = await createBranchTool.handler({ 
      branch: 'feature-new',
      setupWorktree: false
    });
    
    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain('Not a Git worktree project');
    expect((result.content[0] as any).text).toContain('setupWorktree: true');
  });

  it('should handle errors gracefully', async () => {
    mockGitDetector.prototype.detectState = jest.fn().mockResolvedValue({
      type: 'git-worktree',
      path: '/test/project',
    });

    mockWorktreeManager.prototype.addWorktree = jest.fn().mockRejectedValue(
      new Error('Branch already exists')
    );

    const result = await createBranchTool.handler({ branch: 'existing-branch' });
    
    expect(result.content).toBeDefined();
    expect((result.content[0] as any).text).toContain('Error creating branch');
    expect((result.content[0] as any).text).toContain('Branch already exists');
  });
});