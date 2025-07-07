/**
 * Result of a tmux operation for better testability
 */
export interface TmuxOperationResult {
  success: boolean;
  operation: string;
  error?: Error;
  details?: Record<string, unknown>;
}

export interface TmuxEnhancerResult {
  copyModeResult: TmuxOperationResult;
  statusBarResult: TmuxOperationResult;
  keyBindingsResult: TmuxOperationResult;
  sessionGroupsResult: TmuxOperationResult;
  overallSuccess: boolean;
}
