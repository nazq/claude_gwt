import ora, { type Ora } from 'ora';
import { theme } from './theme.js';

export class Spinner {
  private spinner: Ora;

  constructor(text: string) {
    this.spinner = ora({
      text,
      spinner: {
        interval: 80,
        frames: theme.icons.spinner,
      },
      color: 'cyan',
    });
  }

  start(text?: string): void {
    if (text) this.spinner.text = text;
    this.spinner.start();
  }

  succeed(text?: string): void {
    this.spinner.succeed(text ? theme.success(text) : undefined);
  }

  fail(text?: string): void {
    this.spinner.fail(text ? theme.error(text) : undefined);
  }

  warn(text?: string): void {
    this.spinner.warn(text ? theme.warning(text) : undefined);
  }

  info(text?: string): void {
    this.spinner.info(text ? theme.info(text) : undefined);
  }

  stop(): void {
    this.spinner.stop();
  }

  setText(text: string): void {
    this.spinner.text = text;
  }
}
