import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        branches: 15,
        functions: 15,
        lines: 20,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'chalk': path.resolve(__dirname, './tests/mocks/chalk.js'),
      'ora': path.resolve(__dirname, './tests/mocks/ora.js'),
      'figlet': path.resolve(__dirname, './tests/mocks/figlet.js'),
      'boxen': path.resolve(__dirname, './tests/mocks/boxen.js'),
      'inquirer': path.resolve(__dirname, './tests/mocks/inquirer.js'),
      '../../../src/core/utils/logger': path.resolve(__dirname, './tests/mocks/logger.js'),
      '../core/utils/logger': path.resolve(__dirname, './tests/mocks/logger.js'),
      '../../../src/cli/ui/theme': path.resolve(__dirname, './tests/mocks/theme.js'),
    },
  },
});