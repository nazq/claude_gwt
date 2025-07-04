#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';

// Force color support
chalk.level = 3;
import * as path from 'path';
import { TmuxManager } from '../sessions/TmuxManager';
import { WorktreeManager } from '../core/git/WorktreeManager';
import { GitDetector } from '../core/git/GitDetector';
import { TokenTracker } from '../core/TokenTracker';
import { TokenReporter } from '../core/TokenReporter';
import { ConfigManager } from '../core/ConfigManager';

const SESSION_PREFIX = 'cgwt';

function listSessions(): void {
  try {
    const allSessions = execSync('tmux ls 2>/dev/null || true', { encoding: 'utf-8' })
      .split('\n')
      .filter((line) => line.includes(SESSION_PREFIX))
      .map((line) => {
        const sessionName = line.split(':')[0] ?? '';
        // Parse cgwt-${REPO}-${branch} format
        const parts = sessionName.split('-');
        let branch = '';
        let repo = '';

        if (parts.length >= 3) {
          // cgwt-repo-branch or cgwt-repo-name-branch
          repo = parts.slice(1, -1).join('-'); // Everything between cgwt and last part
          branch = parts[parts.length - 1] ?? '';
        }

        return {
          sessionName,
          repo,
          branch,
          isCurrent: line.includes('(attached)'),
          raw: line,
        };
      });

    // Group sessions by repository
    const sessionsByRepo = new Map<string, typeof allSessions>();
    allSessions.forEach((session) => {
      if (!sessionsByRepo.has(session.repo)) {
        sessionsByRepo.set(session.repo, []);
      }
      sessionsByRepo.get(session.repo)?.push(session);
    });

    // Display header if there are sessions
    if (allSessions.length > 0) {
      console.log(chalk.bold('\nClaude GWT Sessions:'));
    }

    // Display sessions grouped by repository
    let sessionIndex = 0;
    const indexMap = new Map<string, number>();

    sessionsByRepo.forEach((repoSessions, repoName) => {
      if (sessionsByRepo.size > 1) {
        console.log(chalk.bold(`\n${repoName}:`));
      }

      // Sort sessions within each repo
      const supervisor = repoSessions.find((s) => s.branch === 'supervisor');
      const branches = repoSessions
        .filter((s) => s.branch !== 'supervisor')
        .sort((a, b) => a.branch.localeCompare(b.branch));

      // Display supervisor first if it exists
      if (supervisor) {
        indexMap.set(supervisor.sessionName, sessionIndex);
        // Special formatting for supervisor
        const indexStr = chalk.magenta(`${sessionIndex}:`);
        const repoStr = chalk.blue(`${repoName}/`);
        const supervisorTag = chalk.bgMagenta.white('SUPERVISOR');
        const currentTag = supervisor.isCurrent ? chalk.green(' [current]') : '';
        console.log(`  ${indexStr} ${repoStr} ${supervisorTag} ${currentTag}`);
        sessionIndex++;
      }

      // Then display branches
      branches.forEach((session) => {
        indexMap.set(session.sessionName, sessionIndex);
        const indexStr = chalk.yellow(`${sessionIndex}:`);
        const displayName = `${repoName}/${session.branch}`;
        const currentTag = session.isCurrent ? chalk.green(' [current]') : '';
        console.log(`  ${indexStr} ${chalk.cyan(displayName.padEnd(25))}${currentTag}`);
        sessionIndex++;
      });
    });

    if (allSessions.length === 0) {
      console.log('No Claude GWT sessions found');
    }
  } catch (error) {
    console.error('Error listing sessions');
  }
}

function switchSession(target: string): void {
  let sessionName: string;

  if (/^\d+$/.test(target)) {
    // Switch by index - recreate the same ordering as listSessions
    try {
      const allSessions = execSync('tmux ls 2>/dev/null || true', { encoding: 'utf-8' })
        .split('\n')
        .filter((line) => line.includes(SESSION_PREFIX))
        .map((line) => {
          const sessionName = line.split(':')[0] ?? '';
          const parts = sessionName.split('-');
          let branch = '';
          let repo = '';

          if (parts.length >= 3) {
            repo = parts.slice(1, -1).join('-');
            branch = parts[parts.length - 1] ?? '';
          }

          return { sessionName, repo, branch };
        });

      // Group by repository and sort exactly like listSessions
      const sessionsByRepo = new Map<string, typeof allSessions>();
      allSessions.forEach((session) => {
        if (!sessionsByRepo.has(session.repo)) {
          sessionsByRepo.set(session.repo, []);
        }
        sessionsByRepo.get(session.repo)?.push(session);
      });

      // Build ordered list
      const orderedSessions: string[] = [];
      sessionsByRepo.forEach((repoSessions) => {
        const supervisor = repoSessions.find((s) => s.branch === 'supervisor');
        const branches = repoSessions
          .filter((s) => s.branch !== 'supervisor')
          .sort((a, b) => a.branch.localeCompare(b.branch));

        if (supervisor) orderedSessions.push(supervisor.sessionName);
        branches.forEach((s) => orderedSessions.push(s.sessionName));
      });

      const index = parseInt(target);
      if (index >= 0 && index < orderedSessions.length) {
        sessionName = orderedSessions[index] ?? '';
      } else {
        console.error(`Error: No session at index ${target}`);
        return;
      }
    } catch {
      console.error('Error finding session');
      return;
    }
  } else {
    // Switch by branch name - need to find the full session name
    try {
      const sessions = execSync('tmux ls 2>/dev/null || true', { encoding: 'utf-8' })
        .split('\n')
        .filter((line) => line.includes(SESSION_PREFIX))
        .map((line) => line.split(':')[0] ?? '')
        .filter((name) => name.endsWith(`-${target}`));

      if (sessions.length === 0) {
        console.error(`Error: No session found for branch '${target}'`);
        return;
      } else if (sessions.length > 1) {
        console.error(
          `Error: Multiple sessions found for branch '${target}'. Please use the full session name.`,
        );
        return;
      }

      sessionName = sessions[0] ?? '';
    } catch {
      console.error('Error finding session');
      return;
    }
  }

  try {
    execSync(`tmux switch-client -t "${sessionName}"`, { stdio: 'inherit' });
  } catch {
    console.error(`Error: Session '${sessionName}' not found`);
  }
}

function showStatus(): void {
  try {
    const currentSession = execSync('tmux display-message -p "#S" 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    if (currentSession.startsWith(SESSION_PREFIX)) {
      // Parse cgwt-${REPO}-${branch} format
      const parts = currentSession.split('-');
      if (parts.length >= 3) {
        const repo = parts.slice(1, -1).join('-');
        const branch = parts[parts.length - 1] ?? '';
        const projectName = parts.slice(1, -1).join('-');

        console.log(chalk.bold('\n🔷 Claude GWT Status\n'));

        // Current session info
        console.log(chalk.cyan('Current Session:'));
        console.log(`  Repository: ${chalk.white(repo)}`);
        console.log(`  Branch: ${chalk.white(branch)}`);
        console.log(`  Directory: ${chalk.white(process.cwd())}`);

        // Git status
        try {
          const gitBranch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
            encoding: 'utf-8',
          }).trim();
          const gitChanges = execSync('git status --porcelain 2>/dev/null | wc -l', {
            encoding: 'utf-8',
          }).trim();
          const ahead = execSync('git rev-list --count @{u}..HEAD 2>/dev/null', {
            encoding: 'utf-8',
          }).trim();
          const behind = execSync('git rev-list --count HEAD..@{u} 2>/dev/null', {
            encoding: 'utf-8',
          }).trim();

          console.log(chalk.cyan('\nGit Status:'));
          console.log(`  Branch: ${chalk.white(gitBranch)}`);
          console.log(
            `  Changes: ${gitChanges === '0' ? chalk.green('✓ Clean') : chalk.yellow(`${gitChanges} uncommitted`)}`,
          );
          if (ahead !== '0' || behind !== '0') {
            console.log(
              `  Remote: ${ahead !== '0' ? chalk.yellow(`↑${ahead}`) : ''} ${behind !== '0' ? chalk.yellow(`↓${behind}`) : ''}`,
            );
          }
        } catch {
          // Git commands failed
        }

        // All sessions for this project
        try {
          const allSessions = execSync('tmux ls 2>/dev/null', { encoding: 'utf-8' })
            .split('\n')
            .filter((line) => line.includes(`cgwt-${projectName}`))
            .map((line) => {
              const sessionName = line.split(':')[0] ?? '';
              const windows = line.match(/(\d+) windows?/)?.[1] ?? '0';
              const attached = line.includes('(attached)');
              const branchName = sessionName.split('-').pop() ?? '';
              return { branchName, windows, attached };
            });

          console.log(chalk.cyan('\nActive Sessions:'));
          allSessions.forEach(({ branchName, windows, attached }) => {
            const status = attached ? chalk.green(' [current]') : '';
            console.log(`  ${branchName}: ${windows} window(s)${status}`);
          });

          // System resources
          const memUsage = execSync(
            'ps aux | grep claude | awk \'{sum += $6} END {printf "%.0f", sum/1024}\'',
            { encoding: 'utf-8' },
          ).trim();
          console.log(chalk.cyan('\nResources:'));
          console.log(`  Claude Memory: ${chalk.white(memUsage ?? '0')}MB`);
          console.log(`  Total Sessions: ${chalk.white(allSessions.length)}`);
        } catch {
          // Session list failed
        }

        // Tips
        console.log(chalk.dim('\nTips:'));
        console.log(chalk.dim('  • cgwt l       - List all sessions'));
        console.log(chalk.dim('  • cgwt compare - Compare branches side-by-side'));
        console.log(chalk.dim('  • cgwt sync    - Synchronize input across panes'));
      } else {
        console.log(`Current session: ${chalk.cyan(currentSession)}`);
      }
    } else {
      console.log('Not in a Claude GWT session');
    }
  } catch {
    console.log('Not in a tmux session');
  }
}

function showTokenUsage(args: string[]): void {
  const reporter = new TokenReporter();
  const tracker = TokenTracker.getInstance();

  // Parse arguments
  const hasToday = args.includes('--today');
  const hasWeek = args.includes('--week');
  const hasMonth = args.includes('--month');
  const hasByBranch = args.includes('--by-branch');
  const hasCost = args.includes('--cost');
  const hasExport = args.includes('--export');

  // Handle export
  if (hasExport) {
    const exportIndex = args.indexOf('--export');
    const format = args[exportIndex + 1];
    const filename =
      args[exportIndex + 2] ?? `claude-usage-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      tracker.exportToCSV(`${filename}.csv`);
      console.log(chalk.green(`✓ Exported usage data to ${filename}.csv`));
    } else if (format === 'json') {
      tracker.exportToJSON(`${filename}.json`);
      console.log(chalk.green(`✓ Exported usage data to ${filename}.json`));
    } else {
      console.log(chalk.red('Error: Export format must be "csv" or "json"'));
    }
    return;
  }

  // Show current session by default if no flags
  if (!hasToday && !hasWeek && !hasMonth && !hasByBranch && args.length === 0) {
    reporter.showCurrentSession();
    return;
  }

  // Show time-based stats
  if (hasToday) {
    const stats = tracker.getTodayStats();
    reporter.showStats(stats, "Today's Usage");
  } else if (hasWeek) {
    const stats = tracker.getWeekStats();
    reporter.showStats(stats, "This Week's Usage");
  } else if (hasMonth) {
    const stats = tracker.getMonthStats();
    reporter.showStats(stats, "This Month's Usage");
  }

  // Show branch breakdown
  if (hasByBranch) {
    const branchIndex = args.indexOf('--by-branch');
    const branch = args[branchIndex + 1];
    reporter.showBranchStats(branch);
  }

  // Show comparison view
  if (hasCost || (!hasToday && !hasWeek && !hasMonth && !hasByBranch)) {
    reporter.showComparison();
  }
}

function showHelp(): void {
  console.log(chalk.bold('cgwt - Claude GWT session switcher'));
  console.log('Usage:');
  console.log('  cgwt config [init|edit|show]    - Manage configuration');
  console.log('  cgwt l            - List sessions');
  console.log('  cgwt s <id>       - Switch by index or branch name');
  console.log('  cgwt <index>      - Quick switch by index');
  console.log('  cgwt ?            - Show status');
  console.log('  cgwt compare      - Create comparison layout');
  console.log('  cgwt sync         - Toggle synchronized panes');
  console.log('  cgwt dashboard    - Show branch dashboard');
  console.log('  cgwt layouts      - Show predefined layouts');
  console.log('');
  console.log(chalk.bold('Token Tracking:'));
  console.log('  cgwt tokens                     - Show current session usage');
  console.log("  cgwt tokens --today             - Today's usage");
  console.log("  cgwt tokens --week              - This week's usage");
  console.log("  cgwt tokens --month             - This month's usage");
  console.log('  cgwt tokens --by-branch [name]  - Usage by branch');
  console.log('  cgwt tokens --cost              - Show cost analysis');
  console.log('  cgwt tokens --export csv|json   - Export usage data');
  console.log('');
  console.log(chalk.bold('Configuration:'));
  console.log('  cgwt config init  - Initialize config with defaults');
  console.log('  cgwt config edit  - Open config in editor');
  console.log('  cgwt config show  - Display current configuration');
}

function killAllSessions(): void {
  try {
    const sessions = execSync('tmux ls 2>/dev/null || true', { encoding: 'utf-8' })
      .split('\n')
      .filter((line) => line.includes(SESSION_PREFIX))
      .map((line) => line.split(':')[0])
      .filter((name) => name);

    if (sessions.length === 0) {
      console.log('No Claude GWT sessions to kill');
      return;
    }

    console.log(`Killing ${sessions.length} Claude GWT sessions...`);
    sessions.forEach((session) => {
      try {
        execSync(`tmux kill-session -t ${session}`);
        console.log(`  Killed: ${session}`);
      } catch {
        // Session might already be gone
      }
    });
    console.log('Done!');
  } catch (error) {
    console.error('Error killing sessions:', error);
  }
}

async function createComparisonLayout(branch1?: string, branch2?: string): Promise<void> {
  try {
    // Get current session
    const currentSession = execSync('tmux display-message -p "#S" 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    if (!currentSession.startsWith(SESSION_PREFIX)) {
      console.error('Not in a Claude GWT session');
      return;
    }

    // Extract project name from current session
    const sessionParts = currentSession.split('-');
    if (sessionParts.length < 3) {
      console.error('Invalid session name format');
      return;
    }
    const projectName = sessionParts.slice(1, -1).join('-');

    // Find worktree base directory
    const detector = new GitDetector(process.cwd());
    const state = await detector.detectState();

    let worktreeBase: string;
    if (state.type === 'git-worktree') {
      worktreeBase = path.dirname(process.cwd());
    } else if (state.type === 'claude-gwt-parent') {
      worktreeBase = process.cwd();
    } else {
      console.error('Not in a git worktree environment');
      return;
    }

    // Get available branches
    const worktreeManager = new WorktreeManager(worktreeBase);
    const worktrees = await worktreeManager.listWorktrees();
    const availableBranches = worktrees.map((wt) => wt.branch ?? 'detached');

    let branchesToCompare: string[];

    if (branch1 && branch2) {
      // User specified both branches
      branchesToCompare = [branch1, branch2];
    } else if (branch1) {
      // One branch specified, use current + specified
      const currentBranch = sessionParts[sessionParts.length - 1] ?? 'unknown';
      branchesToCompare = [currentBranch, branch1];
    } else {
      // No branches specified, show all available (up to 4)
      branchesToCompare = availableBranches.slice(0, 4);
    }

    if (branchesToCompare.length < 2) {
      console.error('Need at least 2 branches for comparison');
      return;
    }

    // Check if all branch sessions exist
    const missingSessions: string[] = [];
    branchesToCompare.forEach((branch) => {
      const sessionName = `cgwt-${projectName}-${branch}`;
      try {
        execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
      } catch {
        missingSessions.push(branch);
      }
    });

    if (missingSessions.length > 0) {
      console.error(`Claude sessions not found for branches: ${missingSessions.join(', ')}`);
      console.log('Tip: Run claude-gwt to create all branch sessions first');
      return;
    }

    console.log(`Creating comparison layout for: ${branchesToCompare.join(', ')}...`);
    TmuxManager.createComparisonLayout(currentSession, branchesToCompare, projectName);
    console.log(chalk.green('✓ Comparison layout created'));
    console.log(chalk.yellow('\nTips:'));
    console.log('- Use Ctrl+b followed by arrow keys to navigate between panes');
    console.log('- Use "cgwt sync" to type in all panes simultaneously');
    console.log('- Close comparison window with Ctrl+b &');
  } catch (error) {
    console.error('Error creating comparison layout:', error);
  }
}

function toggleSyncPanes(): void {
  try {
    const currentSession = execSync('tmux display-message -p "#S" 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    if (!currentSession.startsWith(SESSION_PREFIX)) {
      console.error('Not in a Claude GWT session');
      return;
    }

    const isSync = TmuxManager.toggleSynchronizedPanes(currentSession);
    console.log(chalk.green(`✓ Synchronized panes: ${isSync ? 'ON' : 'OFF'}`));
  } catch (error) {
    console.error('Error toggling synchronized panes:', error);
  }
}

async function createDashboard(): Promise<void> {
  try {
    const currentSession = execSync('tmux display-message -p "#S" 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    if (!currentSession.startsWith(SESSION_PREFIX)) {
      console.error('Not in a Claude GWT session');
      return;
    }

    // Find worktree base directory
    const detector = new GitDetector(process.cwd());
    const state = await detector.detectState();

    let worktreeBase: string;
    if (state.type === 'git-worktree') {
      worktreeBase = path.dirname(process.cwd());
    } else if (state.type === 'claude-gwt-parent') {
      worktreeBase = process.cwd();
    } else {
      console.error('Not in a git worktree environment');
      return;
    }

    // Get available branches
    const worktreeManager = new WorktreeManager(worktreeBase);
    const worktrees = await worktreeManager.listWorktrees();
    const branches = worktrees.map((wt) => wt.branch || 'detached');

    console.log('Creating dashboard...');
    TmuxManager.createDashboard(currentSession, branches, worktreeBase);
    console.log(chalk.green('✓ Dashboard created'));
  } catch (error) {
    console.error('Error creating dashboard:', error);
  }
}

function showLayouts(): void {
  const layouts = TmuxManager.getPredefinedLayouts();
  console.log(chalk.bold('Predefined tmux layouts:'));
  layouts.forEach((layout) => {
    console.log(`\n${chalk.cyan(layout.name)}`);
    console.log(`  ${layout.description}`);
    console.log(`  Branches: ${layout.branches.join(', ')}`);
    console.log(`  Layout: ${layout.layout}`);
  });
}

// Main
const command = process.argv[2];
const arg = process.argv[3];

function handleConfig(args: string[]): void {
  const configManager = ConfigManager.getInstance();
  const subCommand = args[0];

  switch (subCommand) {
    case 'init':
      configManager.initializeUserConfig();
      break;
    case 'edit': {
      const configPath = configManager.getConfigDir();
      console.log(`Opening configuration directory: ${configPath}`);
      try {
        // Try to open with system editor
        execSync(`${process.env['EDITOR'] ?? 'nano'} ${path.join(configPath, 'config.json')}`, {
          stdio: 'inherit',
        });
      } catch {
        console.log(`\nConfiguration files are located at: ${configPath}`);
        console.log('You can edit them with your preferred editor.');
      }
      break;
    }
    case 'show': {
      const config = configManager.get('context');
      console.log(chalk.bold('\nCurrent Configuration:\n'));
      console.log(JSON.stringify(config, null, 2));
      break;
    }
    default:
      console.log(chalk.bold('\nConfiguration Management\n'));
      console.log('Usage: cgwt config [command]\n');
      console.log('Commands:');
      console.log('  init    Initialize configuration with defaults');
      console.log('  edit    Open configuration in editor');
      console.log('  show    Display current configuration');
      console.log(`\nConfig location: ${configManager.getConfigDir()}`);
  }
}

// Async main function to handle async commands
async function main(): Promise<void> {
  // Check if command is a number (direct index switch)
  if (command && /^\d+$/.test(command)) {
    switchSession(command);
  } else {
    switch (command) {
      case 'config':
        handleConfig(process.argv.slice(3));
        break;
      case 'l':
      case 'list':
        listSessions();
        break;
      case 's':
      case 'switch':
        if (!arg) {
          console.error('Usage: cgwt s <branch_name|index>');
          process.exit(1);
        }
        switchSession(arg);
        break;
      case '?':
      case 'status':
        showStatus();
        break;
      case 'killall':
        killAllSessions();
        break;
      case 'compare': {
        // Support: cgwt compare [branch1] [branch2]
        const branch1 = process.argv[3];
        const branch2 = process.argv[4];
        await createComparisonLayout(branch1, branch2);
        break;
      }
      case 'sync':
        toggleSyncPanes();
        break;
      case 'dashboard':
        await createDashboard();
        break;
      case 'layouts':
        showLayouts();
        break;
      case 'tokens': {
        // Get all args after 'tokens'
        const tokenArgs = process.argv.slice(3);
        showTokenUsage(tokenArgs);
        break;
      }
      default:
        showHelp();
    }
  }
}

// Run main
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
