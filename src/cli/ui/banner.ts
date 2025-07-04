import figlet from 'figlet';
import { theme } from './theme';
import { createBox } from './boxen-wrapper';

export async function showBanner(): Promise<void> {
  const banner = figlet.textSync('Claude GWT', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  const subtitle = 'Git Branch Manager with Claude Code Orchestration';
  const version = 'v1.0.0';

  const content = `${theme.primary(banner)}\n\n${theme.muted(subtitle)}\n${theme.dim(version)}`;

  const boxedBanner = await createBox(content, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    align: 'center',
  });

  console.log(boxedBanner);
}
