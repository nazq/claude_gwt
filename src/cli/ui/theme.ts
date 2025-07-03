import chalk from 'chalk';

export const theme = {
  primary: chalk.hex('#00D9FF'),
  secondary: chalk.hex('#FF6B35'),
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  bold: chalk.bold,
  dim: chalk.dim,
  
  // Semantic colors
  git: chalk.hex('#F05032'),
  claude: chalk.hex('#8B5CF6'),
  branch: chalk.hex('#00D9FF'),
  
  // Status indicators
  statusActive: chalk.green('●'),
  statusProcessing: chalk.yellow('◐'),
  statusIdle: chalk.gray('○'),
  statusError: chalk.red('✗'),
  
  // Icons
  icons: {
    folder: '📁',
    branch: '🌳',
    robot: '🤖',
    check: '✅',
    cross: '❌',
    arrow: '→',
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
};