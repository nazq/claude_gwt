// Mock for UI theme
const mockTheme = (text) => text;

const theme = {
  primary: mockTheme,
  secondary: mockTheme,
  success: mockTheme,
  error: mockTheme,
  warning: mockTheme,
  info: mockTheme,
  muted: mockTheme,
  bold: mockTheme,
  dim: mockTheme,
  git: mockTheme,
  claude: mockTheme,
  branch: mockTheme,
  statusActive: '●',
  statusProcessing: '◐',
  statusIdle: '○',
  statusError: '✗',
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

export { theme };
