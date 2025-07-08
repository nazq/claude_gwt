import { describe, it, expect } from 'vitest';

describe('Interface Imports', () => {
  it('should import cli/interfaces.ts without error', async () => {
    const module = await import('../../src/cli/interfaces.js');
    expect(module).toBeDefined();
  });

  it('should import core/services/interfaces.ts without error', async () => {
    const module = await import('../../src/core/services/interfaces.js');
    expect(module).toBeDefined();
  });

  it('should import sessions/TmuxOperationResult.ts without error', async () => {
    const module = await import('../../src/sessions/TmuxOperationResult.js');
    expect(module).toBeDefined();
  });
});
