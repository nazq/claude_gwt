import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp';

describe('extractRepoNameFromUrl', () => {
  // Access private method through prototype
  const extractRepoName = (url: string): string => {
    const app = new ClaudeGWTApp('.', {});
    return (app as any).extractRepoNameFromUrl(url);
  };
  
  it('should extract repo name from GitHub HTTPS URLs', () => {
    expect(extractRepoName('https://github.com/user/my-repo.git')).toBe('my-repo');
    expect(extractRepoName('https://github.com/user/my-repo')).toBe('my-repo');
    expect(extractRepoName('https://github.com/org/team/project.git')).toBe('project');
  });
  
  it('should extract repo name from GitHub SSH URLs', () => {
    expect(extractRepoName('git@github.com:user/my-repo.git')).toBe('my-repo');
    expect(extractRepoName('git@github.com:org/my-project.git')).toBe('my-project');
  });
  
  it('should extract repo name from GitLab URLs', () => {
    expect(extractRepoName('https://gitlab.com/user/my-repo.git')).toBe('my-repo');
    expect(extractRepoName('git@gitlab.com:group/subgroup/project.git')).toBe('project');
    expect(extractRepoName('https://gitlab.com/group/sub/deep/repo')).toBe('repo');
  });
  
  it('should extract repo name from custom Git servers', () => {
    expect(extractRepoName('ssh://git@bitbucket.org/user/repo.git')).toBe('repo');
    expect(extractRepoName('https://git.company.com/team/project.git')).toBe('project');
    expect(extractRepoName('user@server.com:path/to/repo.git')).toBe('repo');
  });
  
  it('should handle edge cases', () => {
    expect(extractRepoName('repo.git')).toBe('repo');
    expect(extractRepoName('repo')).toBe('repo');
    expect(extractRepoName('')).toBe('my-project');
  });
  
  it('should clean special characters', () => {
    expect(extractRepoName('https://github.com/user/my repo.git')).toBe('my-repo');
    expect(extractRepoName('https://github.com/user/my@repo!.git')).toBe('my-repo-');
    expect(extractRepoName('https://github.com/user/my_project.git')).toBe('my_project');
  });
});