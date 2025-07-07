import chalk from 'chalk';

export class TipsCommand {
  /**
   * Display tips and keyboard shortcuts
   * EXACT output preserved from original implementation
   */
  static execute(): void {
    console.log(chalk.cyan('\n🎯 Claude GWT Tips & Tricks\n'));

    console.log(chalk.yellow('Quick Navigation:'));
    console.log('  cgwt -l           List all projects');
    console.log('  cgwt -la          List only active sessions');
    console.log('  cgwt -a 1         Attach to session 1');
    console.log('  cgwt -a 2.1       Attach to project 2, branch 1');
    console.log('');

    console.log(chalk.yellow('Pane Splitting:'));
    console.log('  cgwt split        Split current pane with bash');
    console.log('  cgwt split main   Split and launch main branch');
    console.log('  cgwt split -h     Split horizontally (top/bottom)');
    console.log('  cgwt split -p 30  Split with 30% size');
    console.log('');

    console.log(chalk.yellow('Tmux Keyboard Shortcuts:'));
    console.log(chalk.dim('  (After pressing Ctrl+B)'));
    console.log('  |                 Split vertically');
    console.log('  -                 Split horizontally');
    console.log('  h/j/k/l           Navigate panes (vim-style)');
    console.log('  H/J/K/L           Resize panes (hold to repeat)');
    console.log('  S                 Choose session from tree');
    console.log('  x                 Close current pane');
    console.log('  z                 Toggle pane zoom');
    console.log('  [                 Enter copy mode (vi keys)');
    console.log('');

    console.log(chalk.yellow('Quick Pane Splits (no prefix):'));
    console.log('  Alt+\\             Split vertically');
    console.log('  Alt+-             Split horizontally');
    console.log('');

    console.log(chalk.yellow('Inside Claude:'));
    console.log('  !<command>        Execute shell commands');
    console.log('  !cgwt -l          List sessions from Claude');
    console.log('  !cgwt split       Split pane from Claude');
    console.log('');

    console.log(chalk.dim('Pro tip: Run "cgwt split" from within Claude to quickly'));
    console.log(chalk.dim('open another branch for comparison or reference!\n'));
  }
}
