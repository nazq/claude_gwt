/**
 * Utility for retrying operations with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw error; // Throw the original error
      }

      if (onRetry) {
        const errorForRetry = error instanceof Error ? error : new Error(String(error));
        onRetry(errorForRetry, attempt);
      }

      const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Git-related transient errors
  if (
    message.includes('unable to access') ||
    message.includes('could not read') ||
    message.includes('cannot lock ref') ||
    message.includes('resource temporarily unavailable') ||
    message.includes('device or resource busy')
  ) {
    return true;
  }

  // File system errors
  if (message.includes('ebusy') || message.includes('enotempty') || message.includes('eagain')) {
    return true;
  }

  return false;
}
