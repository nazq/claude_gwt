/**
 * Interface for handling application errors in a testable way
 */
export interface IErrorHandler {
  /**
   * Handle a fatal error that should terminate the application
   */
  handleFatalError(error: unknown, context?: string): never;

  /**
   * Handle a recoverable error with logging
   */
  handleError(error: unknown, context?: string): void;

  /**
   * Format an error for display to the user
   */
  formatError(error: unknown): string;
}

/**
 * Production error handler that exits the process on fatal errors
 */
export class ProductionErrorHandler implements IErrorHandler {
  handleFatalError(error: unknown, context?: string): never {
    const message = this.formatError(error);

    if (context) {
      console.error(`\n✖ Error in ${context}:`, message);
    } else {
      console.error('\n✖ Error:', message);
    }

    console.error('\nCheck logs at: .claude-gwt.log');
    process.exit(1);
  }

  handleError(error: unknown, context?: string): void {
    const message = this.formatError(error);

    if (context) {
      console.error(`Error in ${context}:`, message);
    } else {
      console.error('Error:', message);
    }
  }

  formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error === null || error === undefined) {
      return 'Unknown error';
    }
    return String(error);
  }
}

/**
 * Test error handler that throws instead of exiting
 */
export class TestErrorHandler implements IErrorHandler {
  public readonly errors: Array<{ error: unknown; context?: string }> = [];

  handleFatalError(error: unknown, context?: string): never {
    this.errors.push({ error, context });
    throw new Error(`Fatal error: ${this.formatError(error)}`);
  }

  handleError(error: unknown, context?: string): void {
    this.errors.push({ error, context });
  }

  formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error === null || error === undefined) {
      return 'Unknown error';
    }
    return String(error);
  }
}
