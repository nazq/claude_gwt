import { showBanner } from '../../../../src/cli/ui/banner';
import figlet from 'figlet';
import boxen from 'boxen';
import { theme } from '../../../../src/cli/ui/theme';

jest.mock('figlet');
jest.mock('boxen');
// Mock chalk comprehensively
jest.mock('chalk', () => ({
  hex: jest.fn(() => jest.fn((text: string) => text)),
  green: jest.fn((text: string) => text),
  red: jest.fn((text: string) => text),
  yellow: jest.fn((text: string) => text),
  blue: jest.fn((text: string) => text),
  gray: jest.fn((text: string) => text),
  bold: jest.fn((text: string) => text),
  dim: jest.fn((text: string) => text),
}));

jest.mock('../../../../src/cli/ui/theme', () => ({
  theme: {
    primary: jest.fn((text) => `primary:${text}`),
    muted: jest.fn((text) => `muted:${text}`),
    dim: jest.fn((text) => `dim:${text}`),
  },
}));

describe('banner', () => {
  const mockFiglet = figlet as jest.Mocked<typeof figlet>;
  const mockBoxen = boxen as jest.MockedFunction<typeof boxen>;
  const mockTheme = theme as jest.Mocked<typeof theme>;
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showBanner', () => {
    it('should display a formatted banner with figlet text and boxen styling', () => {
      // Mock figlet return value
      const mockFigletText = 'ASCII ART BANNER';
      mockFiglet.textSync.mockReturnValue(mockFigletText);

      // Mock boxen return value
      const mockBoxedOutput = '┌─ BOXED BANNER ─┐\n│     CONTENT    │\n└────────────────┘';
      mockBoxen.mockReturnValue(mockBoxedOutput);

      showBanner();

      // Verify figlet was called with correct parameters
      expect(mockFiglet.textSync).toHaveBeenCalledWith('Claude GWT', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      });

      // Verify boxen was called (content will be themed)
      expect(mockBoxen).toHaveBeenCalledWith(
        expect.stringContaining('ASCII ART BANNER'),
        expect.objectContaining({
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
          align: 'center',
        }),
      );

      // Verify console.log was called
      expect(mockConsoleLog).toHaveBeenCalledWith(mockBoxedOutput);
    });

    it('should handle different figlet outputs', () => {
      const customFigletText = 'CUSTOM ASCII ART';
      mockFiglet.textSync.mockReturnValue(customFigletText);

      const mockBoxedOutput = 'CUSTOM BOXED OUTPUT';
      mockBoxen.mockReturnValue(mockBoxedOutput);

      showBanner();

      expect(mockFiglet.textSync).toHaveBeenCalledWith('Claude GWT', expect.any(Object));
      expect(mockBoxen).toHaveBeenCalledWith(
        expect.stringContaining('CUSTOM ASCII ART'),
        expect.any(Object),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(mockBoxedOutput);
    });

    it('should use correct subtitle and version', () => {
      mockFiglet.textSync.mockReturnValue('ASCII');
      mockBoxen.mockReturnValue('BOXED');

      showBanner();

      // Verify that boxen is called with content containing the subtitle and version
      expect(mockBoxen).toHaveBeenCalledWith(
        expect.stringContaining('Git Branch Manager with Claude Code Orchestration'),
        expect.any(Object),
      );
      expect(mockBoxen).toHaveBeenCalledWith(expect.stringContaining('v1.0.0'), expect.any(Object));
    });

    it('should apply correct boxen styling options', () => {
      mockFiglet.textSync.mockReturnValue('ASCII');
      (mockTheme.primary as unknown as jest.Mock).mockReturnValue('THEMED');
      (mockTheme.muted as unknown as jest.Mock).mockReturnValue('THEMED');
      (mockTheme.dim as unknown as jest.Mock).mockReturnValue('THEMED');
      mockBoxen.mockReturnValue('BOXED');

      showBanner();

      expect(mockBoxen).toHaveBeenCalledWith(expect.any(String), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        align: 'center',
      });
    });

    it('should call console.log exactly once', () => {
      mockFiglet.textSync.mockReturnValue('ASCII');
      (mockTheme.primary as unknown as jest.Mock).mockReturnValue('THEMED');
      (mockTheme.muted as unknown as jest.Mock).mockReturnValue('THEMED');
      (mockTheme.dim as unknown as jest.Mock).mockReturnValue('THEMED');
      const expectedOutput = 'FINAL BOXED BANNER';
      mockBoxen.mockReturnValue(expectedOutput);

      showBanner();

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expectedOutput);
    });
  });
});
