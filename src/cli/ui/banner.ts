import figlet from 'figlet';
import boxen from 'boxen';
import { theme } from './theme.js';
import { logger } from '../../core/utils/logger.js';

export function showBanner(): void {
  logger.debug('Showing banner');
  const banner = figlet.textSync('Claude GWT', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  const subtitle = 'Git Branch Manager with Claude Code Orchestration';
  const version = 'v1.0.0';

  const content = `${theme.primary(banner)}\n\n${theme.muted(subtitle)}\n${theme.dim(version)}`;
  logger.debug('Banner content prepared', { subtitle, version });

  const boxedBanner = boxen(content, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    align: 'center',
  });

  // Banner is visual output meant for user display
  console.log(boxedBanner);
  logger.info('Banner displayed');
}
