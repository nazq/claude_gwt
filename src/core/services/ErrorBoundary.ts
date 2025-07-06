/**
 * Error boundary for handling and logging errors consistently
 */

import type { IErrorBoundary, ILogger } from './interfaces.js';
import { Logger } from '../utils/logger.js';

export class ErrorBoundary implements IErrorBoundary {
  constructor(private readonly logger: ILogger = Logger) {}

  /**
   * Handle async operations with error boundary
   */
  async handle<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context);
      throw error; // Re-throw after logging
    }
  }

  /**
   * Handle synchronous operations with error boundary
   */
  handleSync<T>(operation: () => T, context?: string): T {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, context);
      throw error; // Re-throw after logging
    }
  }

  /**
   * Handle errors with proper logging and context
   */
  private handleError(error: unknown, context?: string): void {
    const errorMessage = this.extractErrorMessage(error);
    const errorContext = context ? `[${context}]` : '[Unknown Context]';

    this.logger.error(`${errorContext} ${errorMessage}`, error);

    // Additional error tracking could be added here
    // e.g., sending to error tracking service, metrics, etc.
  }

  /**
   * Extract a meaningful error message from any error type
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Unknown error occurred';
  }

  /**
   * Create a wrapped version of a function with error boundary
   */
  wrap<TArgs extends readonly unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    context?: string,
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      return this.handle(() => fn(...args), context);
    };
  }

  /**
   * Create a wrapped version of a synchronous function with error boundary
   */
  wrapSync<TArgs extends readonly unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn,
    context?: string,
  ): (...args: TArgs) => TReturn {
    return (...args: TArgs): TReturn => {
      return this.handleSync(() => fn(...args), context);
    };
  }

  /**
   * Create an error boundary for a specific context
   */
  forContext(context: string): IErrorBoundary {
    return {
      handle: <T>(operation: () => Promise<T>): Promise<T> => this.handle(operation, context),
      handleSync: <T>(operation: () => T): T => this.handleSync(operation, context),
    };
  }
}

// Default error boundary instance
export const errorBoundary = new ErrorBoundary();
