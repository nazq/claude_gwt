import { vi } from 'vitest';
import { ConfigManager } from '../../../src/core/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('fs');
vi.mock('../../../src/core/utils/logger');

describe('ConfigManager', () => {
  const mockFs = fs as vi.Mocked<typeof fs>;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (ConfigManager as any).instance = undefined;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should create config directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockReturnValue('{}');

      ConfigManager.getInstance();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('claude-gwt'), {
        recursive: true,
      });
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('contexts'), {
        recursive: true,
      });
    });

    it('should use XDG_CONFIG_HOME when available', () => {
      process.env['XDG_CONFIG_HOME'] = '/custom/config';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      ConfigManager.getInstance();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/custom/config/claude-gwt/config.json',
        'utf-8',
      );
    });

    it('should use home directory when XDG_CONFIG_HOME is not set', () => {
      delete process.env['XDG_CONFIG_HOME'];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      ConfigManager.getInstance();

      const homeDir = os.homedir();
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(homeDir, '.config/claude-gwt/config.json'),
        'utf-8',
      );
    });

    it('should create default config if file does not exist', () => {
      mockFs.existsSync
        .mockReturnValueOnce(true) // config dir exists
        .mockReturnValueOnce(true) // context dir exists
        .mockReturnValueOnce(false); // config file does not exist

      const mockWriteFileSync = vi.spyOn(mockFs, 'writeFileSync');
      mockFs.writeFileSync.mockImplementation(() => {});

      ConfigManager.getInstance();

      expect(mockWriteFileSync).toHaveBeenCalled();
      // Check that config.json was written
      const configCall = mockWriteFileSync.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('config.json'),
      );
      expect(configCall).toBeDefined();
      expect(configCall?.[1]).toContain('"context"');
    });

    it('should load existing config file', () => {
      const mockConfig = {
        context: { global: 'test context' },
        ui: { theme: 'minimal' as const },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();
      const context = manager.get('context');
      const ui = manager.get('ui');

      expect(context?.global).toBe('test context');
      expect(ui?.theme).toBe('minimal');
    });

    it('should handle invalid JSON in config file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const manager = ConfigManager.getInstance();
      const context = manager.get('context');

      expect(context).toBeUndefined();
    });
  });

  describe('getContext', () => {
    it('should return global context', () => {
      const mockConfig = {
        context: { global: 'global context' },
      };
      mockFs.existsSync.mockReturnValue(false); // No context files exist
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();
      const context = manager.getContext('my-project', 'main', 'child');

      expect(context).toBe('global context');
    });

    it('should return role-specific context', () => {
      const mockConfig = {
        context: {
          global: 'global context',
          supervisor: 'supervisor context',
          child: 'child context',
        },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();

      const supervisorContext = manager.getContext('project', 'main', 'supervisor');
      expect(supervisorContext).toContain('supervisor context');

      const childContext = manager.getContext('project', 'main', 'child');
      expect(childContext).toContain('child context');
    });

    it('should return project-specific context', () => {
      const mockConfig = {
        context: {
          global: 'global context',
          projects: {
            'my-project': {
              global: 'project context',
              supervisor: 'project supervisor context',
            },
          },
        },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();
      const context = manager.getContext('my-project', 'main', 'supervisor');

      expect(context).toContain('project supervisor context');
    });

    it('should return branch-specific context', () => {
      const mockConfig = {
        context: {
          projects: {
            'my-project': {
              branches: {
                'feature-x': 'branch specific context',
              },
            },
          },
        },
      };
      mockFs.existsSync.mockReturnValue(false); // No context files exist
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();
      const context = manager.getContext('my-project', 'feature-x', 'child');

      expect(context).toBe('branch specific context');
    });

    it('should merge contexts from multiple sources', () => {
      const mockConfig = {
        context: {
          global: 'global context',
          child: 'child context',
          projects: {
            'my-project': {
              global: 'project context',
              child: 'project child context',
            },
          },
        },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();
      const context = manager.getContext('my-project', 'main', 'child');

      expect(context).toContain('global context');
      expect(context).toContain('child context');
      expect(context).toContain('project context');
      expect(context).toContain('project child context');
    });

    it('should load project context from file if exists', () => {
      const mockConfig = {
        context: { global: 'global context' },
      };
      mockFs.existsSync
        .mockReturnValueOnce(true) // config dir
        .mockReturnValueOnce(true) // context dir
        .mockReturnValueOnce(true) // config file exists
        .mockReturnValueOnce(true); // project context file exists
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce('# Project specific context from file');

      const manager = ConfigManager.getInstance();
      const context = manager.getContext('my-project', 'main', 'child');

      expect(context).toContain('global context');
      expect(context).toContain('Project Context from my-project.md');
      expect(context).toContain('# Project specific context from file');
    });

    it('should load branch context from file for child role', () => {
      const mockConfig = {
        context: { global: 'global context' },
      };
      mockFs.existsSync
        .mockReturnValueOnce(true) // config dir
        .mockReturnValueOnce(true) // context dir
        .mockReturnValueOnce(true) // config file exists
        .mockReturnValueOnce(false) // project context file doesn't exist
        .mockReturnValueOnce(true); // branch context file exists
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce('# Branch specific context from file');

      const manager = ConfigManager.getInstance();
      const context = manager.getContext('my-project', 'feature-x', 'child');

      expect(context).toContain('global context');
      expect(context).toContain('Branch Context for feature-x');
      expect(context).toContain('# Branch specific context from file');
    });
  });

  describe('getTemplate', () => {
    it('should return template by name', () => {
      const mockConfig = {
        context: {
          templates: {
            'test-template': {
              name: 'Test Template',
              description: 'A test template',
              context: 'template context',
            },
          },
        },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();
      const template = manager.getTemplate('test-template');

      expect(template).toBe('template context');
    });

    it('should return null for non-existent template', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockReturnValue('{}');

      const manager = ConfigManager.getInstance();
      const template = manager.getTemplate('non-existent');

      expect(template).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('should return all templates', () => {
      const mockConfig = {
        context: {
          templates: {
            template1: {
              name: 'Template 1',
              description: 'First template',
              context: 'context 1',
            },
            template2: {
              name: 'Template 2',
              description: 'Second template',
              context: 'context 2',
            },
          },
        },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      mockFs.readdirSync.mockReturnValue([]);

      const manager = ConfigManager.getInstance();
      const templates = manager.listTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0]).toEqual({
        name: 'template1',
        description: 'First template',
      });
      expect(templates[1]).toEqual({
        name: 'template2',
        description: 'Second template',
      });
    });

    it('should return empty array when no templates exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockReturnValue('{}');
      mockFs.readdirSync.mockReturnValue([]);

      const manager = ConfigManager.getInstance();
      const templates = manager.listTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('get/set', () => {
    it('should get configuration values', () => {
      const mockConfig = {
        ui: { theme: 'verbose' as const },
        git: { defaultBranchPrefix: 'feature/' },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = ConfigManager.getInstance();
      const ui = manager.get('ui');
      const git = manager.get('git');

      expect(ui).toEqual({ theme: 'verbose' });
      expect(git).toEqual({ defaultBranchPrefix: 'feature/' });
    });

    it('should set configuration values', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      const manager = ConfigManager.getInstance();
      manager.set('ui', { theme: 'minimal' });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        JSON.stringify({ ui: { theme: 'minimal' } }, null, 2),
      );
    });
  });

  describe('getConfigDir/getContextDir', () => {
    it('should return config directory path', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      const manager = ConfigManager.getInstance();
      const configDir = manager.getConfigDir();

      expect(configDir).toContain('claude-gwt');
    });

    it('should return context directory path', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      const manager = ConfigManager.getInstance();
      const contextDir = manager.getContextDir();

      expect(contextDir).toContain('claude-gwt');
      expect(contextDir).toContain('contexts');
    });
  });

  describe('getTemplate', () => {
    it('should handle file read errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync
        .mockImplementationOnce(() => '{}') // For config load
        .mockImplementationOnce(() => {
          throw new Error('Permission denied');
        });

      const manager = ConfigManager.getInstance();
      const template = manager.getTemplate('test-template');

      expect(template).toBeNull();
    });
  });

  describe('initializeUserConfig', () => {
    let consoleLogSpy: vi.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should initialize user configuration with console output', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      const manager = ConfigManager.getInstance();
      manager.initializeUserConfig();

      // Check that configuration information was displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Claude GWT Configuration'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration directory:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Context directory:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration files created:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tips:'));
    });
  });
});
