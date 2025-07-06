import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './utils/logger.js';

export interface ContextConfig {
  // Global context applied to all sessions
  global?: string;

  // Context specific to supervisor sessions
  supervisor?: string;

  // Context specific to child/branch sessions
  child?: string;

  // Project-specific contexts (by repo name or path)
  projects?: {
    [projectKey: string]: {
      global?: string;
      supervisor?: string;
      child?: string;
      // Branch-specific contexts
      branches?: {
        [branchName: string]: string;
      };
    };
  };

  // Templates for common scenarios
  templates?: {
    [templateName: string]: {
      name: string;
      description: string;
      context: string;
    };
  };
}

export interface ClaudeGWTConfig {
  // Context configuration
  context?: ContextConfig;

  // UI preferences
  ui?: {
    theme?: 'default' | 'minimal' | 'verbose';
    showTokenUsage?: boolean;
    autoLaunchSupervisor?: boolean;
  };

  // Git preferences
  git?: {
    defaultBranchPrefix?: string;
    autoConvertToWorktree?: boolean;
    commitMessageTemplate?: string;
  };

  // Session preferences
  sessions?: {
    alwaysContinue?: boolean;
    defaultClean?: boolean;
    maxParallelSessions?: number;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private configDir: string;
  private configFile: string;
  private contextDir: string;
  private config: ClaudeGWTConfig = {};

  private constructor() {
    // Follow XDG Base Directory specification
    const configHome = process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config');
    this.configDir = path.join(configHome, 'claude-gwt');
    this.configFile = path.join(this.configDir, 'config.json');
    this.contextDir = path.join(this.configDir, 'contexts');

    this.ensureConfigDir();
    this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
      Logger.info('Created config directory', { dir: this.configDir });
    }

    if (!fs.existsSync(this.contextDir)) {
      fs.mkdirSync(this.contextDir, { recursive: true });
    }

    // Create default config if it doesn't exist
    if (!fs.existsSync(this.configFile)) {
      this.createDefaultConfig();
    }
  }

  private createDefaultConfig(): void {
    const defaultConfig: ClaudeGWTConfig = {
      context: {
        global: `# Global Context for Claude GWT

You are working with Claude GWT (Git Worktree Tool), which manages multiple git worktrees for parallel development.

## Key Commands Available:
- !cgwt l - List all sessions
- !cgwt s <branch> - Switch to branch session
- !cgwt 0 - Return to supervisor
- !cgwt ? - Show status

## Best Practices:
- Keep changes focused on the current branch
- Use descriptive commit messages
- Run tests before committing
`,
        supervisor: `# Supervisor Context

As the SUPERVISOR, you coordinate work across all branches and maintain the big picture of the project.

## Your Responsibilities:
1. Distribute tasks to appropriate branches
2. Monitor progress across worktrees
3. Ensure consistency between branches
4. Guide architectural decisions
`,
        child: `# Branch Worker Context

You are working on a specific branch. Focus on the tasks assigned to this branch.

## Guidelines:
1. Stay within the scope of this branch
2. Coordinate with supervisor for cross-branch changes
3. Keep commits atomic and well-documented
`,
      },
      ui: {
        theme: 'default',
        showTokenUsage: true,
        autoLaunchSupervisor: true,
      },
      git: {
        defaultBranchPrefix: 'feature/',
        autoConvertToWorktree: false,
      },
      sessions: {
        alwaysContinue: true,
        defaultClean: false,
        maxParallelSessions: 10,
      },
    };

    this.saveConfig(defaultConfig);

    // Create example context files
    this.createExampleContextFiles();
  }

  private createExampleContextFiles(): void {
    // Create an example project context
    const exampleProjectContext = `# Example Project Context

This is an example of a project-specific context file.
Place this in: ${this.contextDir}/projects/your-project-name.md

## Project-Specific Guidelines:
- API endpoints should follow REST conventions
- Use TypeScript strict mode
- Follow the team's ESLint configuration

## Project Architecture:
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL

## Important Files:
- src/config/database.ts - Database configuration
- src/api/routes.ts - API route definitions
- docs/API.md - API documentation
`;

    const examplePath = path.join(this.contextDir, 'example-project.md');
    fs.writeFileSync(examplePath, exampleProjectContext);

    // Create a template example
    const templateExample = `# API Development Template

Use this template when working on API endpoints.

## Checklist:
- [ ] Define request/response types
- [ ] Implement input validation
- [ ] Add error handling
- [ ] Write unit tests
- [ ] Update API documentation
- [ ] Add rate limiting if needed

## Code Structure:
\`\`\`typescript
// Define types
interface RequestDTO { ... }
interface ResponseDTO { ... }

// Implement endpoint
router.post('/endpoint', 
  validateInput(schema),
  async (req, res) => {
    try {
      // Implementation
    } catch (error) {
      // Error handling
    }
  }
);
\`\`\`
`;

    const templatePath = path.join(this.contextDir, 'templates', 'api-development.md');
    fs.mkdirSync(path.dirname(templatePath), { recursive: true });
    fs.writeFileSync(templatePath, templateExample);
  }

  private loadConfig(): void {
    try {
      const data = fs.readFileSync(this.configFile, 'utf-8');
      this.config = JSON.parse(data) as ClaudeGWTConfig;
      Logger.debug('Loaded configuration', { config: this.config });
    } catch (error) {
      Logger.error('Failed to load config, using defaults', error);
      this.config = {};
    }
  }

  private saveConfig(config: ClaudeGWTConfig): void {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      Logger.info('Saved configuration');
    } catch (error) {
      Logger.error('Failed to save config', error);
    }
  }

  /**
   * Get context for a specific session
   */
  getContext(projectName: string, branchName: string, role: 'supervisor' | 'child'): string {
    const contexts: string[] = [];

    // 1. Global context
    if (this.config.context?.global) {
      contexts.push(this.config.context.global);
    }

    // 2. Role-specific context
    const roleContext =
      role === 'supervisor' ? this.config.context?.supervisor : this.config.context?.child;
    if (roleContext) {
      contexts.push(roleContext);
    }

    // 3. Project-specific context from config
    const projectConfig = this.config.context?.projects?.[projectName];
    if (projectConfig) {
      if (projectConfig.global) {
        contexts.push(projectConfig.global);
      }

      const projectRoleContext =
        role === 'supervisor' ? projectConfig.supervisor : projectConfig.child;
      if (projectRoleContext) {
        contexts.push(projectRoleContext);
      }

      // Branch-specific context
      if (role === 'child' && projectConfig.branches?.[branchName]) {
        contexts.push(projectConfig.branches[branchName]);
      }
    }

    // 4. Load project context from file if exists
    const projectContextFile = path.join(this.contextDir, 'projects', `${projectName}.md`);
    if (fs.existsSync(projectContextFile)) {
      try {
        const projectContext = fs.readFileSync(projectContextFile, 'utf-8');
        contexts.push(`# Project Context from ${projectName}.md\n\n${projectContext}`);
      } catch (error) {
        Logger.error('Failed to load project context file', error);
      }
    }

    // 5. Load branch-specific context file if exists
    if (role === 'child') {
      const branchContextFile = path.join(
        this.contextDir,
        'projects',
        projectName,
        `${branchName}.md`,
      );
      if (fs.existsSync(branchContextFile)) {
        try {
          const branchContext = fs.readFileSync(branchContextFile, 'utf-8');
          contexts.push(`# Branch Context for ${branchName}\n\n${branchContext}`);
        } catch (error) {
          Logger.error('Failed to load branch context file', error);
        }
      }
    }

    return contexts.join('\n\n---\n\n');
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof ClaudeGWTConfig>(key: K): ClaudeGWTConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration
   */
  set<K extends keyof ClaudeGWTConfig>(key: K, value: ClaudeGWTConfig[K]): void {
    this.config[key] = value;
    this.saveConfig(this.config);
  }

  /**
   * Get the configuration directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Get the context directory path
   */
  getContextDir(): string {
    return this.contextDir;
  }

  /**
   * List available templates
   */
  listTemplates(): Array<{ name: string; description: string }> {
    const templates: Array<{ name: string; description: string }> = [];

    // From config
    if (this.config.context?.templates) {
      Object.entries(this.config.context.templates).forEach(([key, template]) => {
        templates.push({ name: key, description: template.description });
      });
    }

    // From files
    const templateDir = path.join(this.contextDir, 'templates');
    if (fs.existsSync(templateDir)) {
      const files = fs.readdirSync(templateDir);
      files.forEach((file) => {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '');
          if (!templates.find((t) => t.name === name)) {
            templates.push({ name, description: `Template from ${file}` });
          }
        }
      });
    }

    return templates;
  }

  /**
   * Get a template by name
   */
  getTemplate(name: string): string | null {
    // Check config first
    if (this.config.context?.templates?.[name]) {
      return this.config.context.templates[name].context;
    }

    // Check file
    const templateFile = path.join(this.contextDir, 'templates', `${name}.md`);
    if (fs.existsSync(templateFile)) {
      try {
        return fs.readFileSync(templateFile, 'utf-8');
      } catch (error) {
        Logger.error('Failed to load template file', error);
      }
    }

    return null;
  }

  /**
   * Initialize configuration for a new user
   */
  initializeUserConfig(): void {
    console.log(`\n🎯 Claude GWT Configuration`);
    console.log(`\nConfiguration directory: ${this.configDir}`);
    console.log(`Context directory: ${this.contextDir}`);

    console.log(`\n📝 Configuration files created:`);
    console.log(`  • config.json - Main configuration`);
    console.log(`  • contexts/example-project.md - Example project context`);
    console.log(`  • contexts/templates/api-development.md - Example template`);

    console.log(`\n🚀 Next steps:`);
    console.log(`  1. Edit ${this.configFile} to customize settings`);
    console.log(`  2. Create project contexts in ${this.contextDir}/projects/`);
    console.log(`  3. Add templates in ${this.contextDir}/templates/`);

    console.log(`\n💡 Tips:`);
    console.log(`  • Project contexts are loaded by project name`);
    console.log(`  • Branch contexts can be nested under project directories`);
    console.log(`  • Templates can be referenced in your prompts`);
  }
}
