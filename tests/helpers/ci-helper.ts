/**
 * Helper utilities for running tests in CI environment
 */

export const isCI = process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true';

/**
 * Skip test in CI environment
 */
export function skipInCI(reason = 'Skipping in CI environment') {
  if (isCI) {
    console.log(reason);
    return true;
  }
  return false;
}

/**
 * Conditionally run test based on environment
 */
export const itSkipCI = isCI ? it.skip : it;

/**
 * Run test only in CI
 */
export const itOnlyCI = isCI ? it : it.skip;
