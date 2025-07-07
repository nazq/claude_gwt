import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('CLI Version', () => {
  it('should match package.json version', () => {
    // Read package.json version
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent) as { version: string };
    const expectedVersion = packageJson.version;

    // Get CLI version
    const cliPath = join(process.cwd(), 'dist', 'src', 'cli', 'index.js');
    const cliVersion = execSync(`node ${cliPath} --version`, { encoding: 'utf-8' }).trim();

    // Verify they match
    expect(cliVersion).toBe(expectedVersion);
  });

  it('should display version with --version flag', () => {
    const cliPath = join(process.cwd(), 'dist', 'src', 'cli', 'index.js');
    const output = execSync(`node ${cliPath} --version`, { encoding: 'utf-8' }).trim();

    // Should be a valid semver format
    expect(output).toMatch(/^\d+\.\d+\.\d+(-\S+)?$/);
  });

  it('should display version with -V flag', () => {
    const cliPath = join(process.cwd(), 'dist', 'src', 'cli', 'index.js');
    const output = execSync(`node ${cliPath} -V`, { encoding: 'utf-8' }).trim();

    // Should be a valid semver format
    expect(output).toMatch(/^\d+\.\d+\.\d+(-\S+)?$/);
  });
});
