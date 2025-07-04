import { showBanner } from '../../../../src/cli/ui/banner';
import figlet from 'figlet';

// Mock dependencies
jest.mock('figlet');
jest.mock('../../../../src/cli/ui/boxen-wrapper', () => ({
  createBox: jest
    .fn()
    .mockImplementation(async (content: string) => `[BOXED]\n${content}\n[/BOXED]`),
}));

describe('showBanner', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should display a banner with correct styling', async () => {
    const mockBannerText = 'CLAUDE GWT';
    (figlet.textSync as jest.Mock).mockReturnValue(mockBannerText);

    await showBanner();

    // Check figlet was called with correct options
    expect(figlet.textSync).toHaveBeenCalledWith('Claude GWT', {
      font: 'Standard',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    });

    // Check console.log was called with boxed content
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[BOXED]'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(mockBannerText));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[/BOXED]'));
  });

  it('should include subtitle and version in the banner', async () => {
    const mockBannerText = 'CLAUDE GWT';
    (figlet.textSync as jest.Mock).mockReturnValue(mockBannerText);

    await showBanner();

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('Git Branch Manager with Claude Code Orchestration');
    expect(output).toContain('v1.0.0');
  });
});
