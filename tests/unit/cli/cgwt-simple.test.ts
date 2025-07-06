import { describe, it, expect } from 'vitest';

// Test that cgwt.ts is a proper CLI entry point
describe('cgwt CLI script', () => {
  it('should be a valid CLI script', async () => {
    // Import the raw source to check structure
    const fs = await import('fs');
    const path = await import('path');

    const cgwtPath = path.join(process.cwd(), 'src/cli/cgwt.ts');
    const content = fs.readFileSync(cgwtPath, 'utf-8');

    // Check shebang
    expect(content).toMatch(/^#!\/usr\/bin\/env node/);

    // Check basic structure - now it should import cgwt-program
    expect(content).toContain("import { createProgram } from './cgwt-program.js'");
    expect(content).toContain('createProgram()');
    expect(content).toContain('program.parse(process.argv)');
  });

  it('should be a minimal entry point', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const cgwtPath = path.join(process.cwd(), 'src/cli/cgwt.ts');
    const content = fs.readFileSync(cgwtPath, 'utf-8');

    // The file should be very small now - just the shebang, import, and parse
    const lines = content.split('\n').filter((line) => line.trim() !== '');
    expect(lines.length).toBeLessThan(15); // Should be a very minimal file
  });

  it('should have corresponding program module', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const programPath = path.join(process.cwd(), 'src/cli/cgwt-program.ts');
    const exists = fs.existsSync(programPath);

    expect(exists).toBe(true);

    // Check that the program module exports the expected functions
    const content = fs.readFileSync(programPath, 'utf-8');
    expect(content).toContain('export function createProgram()');
    expect(content).toContain('export function listSessions()');
    expect(content).toContain('export function switchSession(');
  });
});
