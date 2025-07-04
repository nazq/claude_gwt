import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './utils/logger';

export interface TokenUsage {
  id: string;
  sessionId: string;
  projectName: string;
  branch: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  conversationId?: string;
}

export interface SessionData {
  sessionId: string;
  projectName: string;
  branch: string;
  startTime: Date;
  endTime?: Date;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  conversationCount: number;
  isActive: boolean;
}

export interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  sessionCount: number;
  conversationCount: number;
  byBranch: { [branch: string]: TokenStats };
  byProject: { [project: string]: TokenStats };
}

// Claude pricing per 1K tokens (as of 2024)
const PRICING = {
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-2.1': { input: 0.008, output: 0.024 },
  'claude-2.0': { input: 0.008, output: 0.024 },
  'claude-instant': { input: 0.0008, output: 0.0024 },
  // Default for unknown models
  default: { input: 0.003, output: 0.015 },
};

export class TokenTracker {
  private static instance: TokenTracker;
  private dataDir: string;
  private currentSessionFile: string;
  private usageFile: string;
  private currentSession: SessionData | null = null;
  private pendingWrites: Map<string, unknown> = new Map();
  private writeTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.dataDir = path.join(os.homedir(), '.claude-gwt', 'usage');
    this.currentSessionFile = path.join(this.dataDir, 'current-session.json');
    this.usageFile = path.join(this.dataDir, 'usage.json');
    this.initializeDataDir();
  }

  static getInstance(): TokenTracker {
    if (!TokenTracker.instance) {
      TokenTracker.instance = new TokenTracker();
    }
    return TokenTracker.instance;
  }

  private initializeDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      Logger.info('Created token tracking directory', { dir: this.dataDir });
    }

    // Initialize usage file if it doesn't exist
    if (!fs.existsSync(this.usageFile)) {
      this.saveUsageData([]);
    }
  }

  /**
   * Start tracking a new session
   */
  startSession(projectName: string, branch: string): string {
    const sessionId = `${projectName}-${branch}-${Date.now()}`;

    this.currentSession = {
      sessionId,
      projectName,
      branch,
      startTime: new Date(),
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      conversationCount: 0,
      isActive: true,
    };

    this.saveCurrentSession();
    Logger.info('Started token tracking session', { sessionId, projectName, branch });
    return sessionId;
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession.isActive = false;
      this.saveCurrentSession();

      // Archive session to session history
      const sessionHistory = this.loadSessionHistory();
      sessionHistory.push(this.currentSession);
      this.saveSessionHistory(sessionHistory);

      Logger.info('Ended token tracking session', {
        sessionId: this.currentSession.sessionId,
        totalTokens: this.currentSession.totalInputTokens + this.currentSession.totalOutputTokens,
        totalCost: this.currentSession.totalCost,
      });

      this.currentSession = null;

      // Clear current session file
      if (fs.existsSync(this.currentSessionFile)) {
        fs.unlinkSync(this.currentSessionFile);
      }
    }
  }

  /**
   * Track token usage for a conversation
   */
  trackUsage(
    inputTokens: number,
    outputTokens: number,
    model: string = 'claude-3-sonnet',
    conversationId?: string,
  ): void {
    if (!this.currentSession) {
      Logger.warn('No active session for token tracking');
      return;
    }

    const pricing = PRICING[model as keyof typeof PRICING] || PRICING.default;
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    const usage: TokenUsage = {
      id: `${this.currentSession.sessionId}-${Date.now()}`,
      sessionId: this.currentSession.sessionId,
      projectName: this.currentSession.projectName,
      branch: this.currentSession.branch,
      timestamp: new Date(),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: totalCost,
      model,
      conversationId,
    };

    // Update current session
    this.currentSession.totalInputTokens += inputTokens;
    this.currentSession.totalOutputTokens += outputTokens;
    this.currentSession.totalCost += totalCost;
    this.currentSession.conversationCount++;

    // Batch writes for performance
    this.scheduleWrite('session', this.currentSession);
    this.scheduleWrite('usage', usage);

    Logger.verbose('Tracked token usage', {
      inputTokens,
      outputTokens,
      cost: totalCost.toFixed(4),
      model,
    });
  }

  /**
   * Get current session usage
   */
  getCurrentSessionUsage(): SessionData | null {
    if (this.currentSession) {
      return { ...this.currentSession };
    }

    // Try to load from file
    if (fs.existsSync(this.currentSessionFile)) {
      try {
        const data = fs.readFileSync(this.currentSessionFile, 'utf-8');
        this.currentSession = JSON.parse(data) as SessionData;
        return this.currentSession;
      } catch (error) {
        Logger.error('Failed to load current session', error);
      }
    }

    return null;
  }

  /**
   * Get usage statistics for a time period
   */
  getStats(filter?: {
    startDate?: Date;
    endDate?: Date;
    branch?: string;
    project?: string;
  }): TokenStats {
    const sessions = this.loadSessionHistory();

    // Filter data based on criteria
    let filteredSessions = sessions;
    if (filter) {
      filteredSessions = sessions.filter((session) => {
        if (filter.startDate && new Date(session.startTime) < filter.startDate) return false;
        if (filter.endDate && new Date(session.startTime) > filter.endDate) return false;
        if (filter.branch && session.branch !== filter.branch) return false;
        if (filter.project && session.projectName !== filter.project) return false;
        return true;
      });
    }

    // Calculate stats
    const stats: TokenStats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      sessionCount: filteredSessions.length,
      conversationCount: 0,
      byBranch: {},
      byProject: {},
    };

    filteredSessions.forEach((session) => {
      stats.totalInputTokens += session.totalInputTokens;
      stats.totalOutputTokens += session.totalOutputTokens;
      stats.totalCost += session.totalCost;
      stats.conversationCount += session.conversationCount;

      // By branch
      if (!stats.byBranch[session.branch]) {
        stats.byBranch[session.branch] = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          sessionCount: 0,
          conversationCount: 0,
          byBranch: {},
          byProject: {},
        };
      }
      const branchStats = stats.byBranch[session.branch];
      if (branchStats) {
        branchStats.totalInputTokens += session.totalInputTokens;
        branchStats.totalOutputTokens += session.totalOutputTokens;
        branchStats.totalCost += session.totalCost;
        branchStats.sessionCount++;
        branchStats.conversationCount += session.conversationCount;
      }

      // By project
      if (!stats.byProject[session.projectName]) {
        stats.byProject[session.projectName] = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          sessionCount: 0,
          conversationCount: 0,
          byBranch: {},
          byProject: {},
        };
      }
      const projectStats = stats.byProject[session.projectName];
      if (projectStats) {
        projectStats.totalInputTokens += session.totalInputTokens;
        projectStats.totalOutputTokens += session.totalOutputTokens;
        projectStats.totalCost += session.totalCost;
        projectStats.sessionCount++;
        projectStats.conversationCount += session.conversationCount;
      }
    });

    stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;

    // Update totals for branches and projects
    Object.values(stats.byBranch).forEach((branchStats) => {
      branchStats.totalTokens = branchStats.totalInputTokens + branchStats.totalOutputTokens;
    });
    Object.values(stats.byProject).forEach((projectStats) => {
      projectStats.totalTokens = projectStats.totalInputTokens + projectStats.totalOutputTokens;
    });

    return stats;
  }

  /**
   * Get today's usage
   */
  getTodayStats(): TokenStats {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.getStats({ startDate: startOfDay });
  }

  /**
   * Get this week's usage
   */
  getWeekStats(): TokenStats {
    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return this.getStats({ startDate: startOfWeek });
  }

  /**
   * Get this month's usage
   */
  getMonthStats(): TokenStats {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return this.getStats({ startDate: startOfMonth });
  }

  /**
   * Export usage data to CSV
   */
  exportToCSV(
    outputPath: string,
    filter?: {
      startDate?: Date;
      endDate?: Date;
      branch?: string;
      project?: string;
    },
  ): void {
    const sessions = this.loadSessionHistory();
    let filteredSessions = sessions;

    if (filter) {
      filteredSessions = sessions.filter((session) => {
        if (filter.startDate && new Date(session.startTime) < filter.startDate) return false;
        if (filter.endDate && new Date(session.startTime) > filter.endDate) return false;
        if (filter.branch && session.branch !== filter.branch) return false;
        if (filter.project && session.projectName !== filter.project) return false;
        return true;
      });
    }

    const csv = [
      'Session ID,Project,Branch,Start Time,End Time,Input Tokens,Output Tokens,Total Tokens,Cost,Conversations',
      ...filteredSessions.map(
        (session) =>
          `"${session.sessionId}","${session.projectName}","${session.branch}","${String(session.startTime)}","${session.endTime ? String(session.endTime) : ''}",${session.totalInputTokens},${session.totalOutputTokens},${session.totalInputTokens + session.totalOutputTokens},${session.totalCost.toFixed(4)},${session.conversationCount}`,
      ),
    ].join('\n');

    fs.writeFileSync(outputPath, csv);
    Logger.info('Exported usage data to CSV', {
      path: outputPath,
      sessions: filteredSessions.length,
    });
  }

  /**
   * Export usage data to JSON
   */
  exportToJSON(
    outputPath: string,
    filter?: {
      startDate?: Date;
      endDate?: Date;
      branch?: string;
      project?: string;
    },
  ): void {
    const stats = this.getStats(filter);
    const sessions = this.loadSessionHistory();

    let filteredSessions = sessions;
    if (filter) {
      filteredSessions = sessions.filter((session) => {
        if (filter.startDate && new Date(session.startTime) < filter.startDate) return false;
        if (filter.endDate && new Date(session.startTime) > filter.endDate) return false;
        if (filter.branch && session.branch !== filter.branch) return false;
        if (filter.project && session.projectName !== filter.project) return false;
        return true;
      });
    }

    const exportData = {
      generated: new Date().toISOString(),
      filter,
      summary: stats,
      sessions: filteredSessions,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    Logger.info('Exported usage data to JSON', {
      path: outputPath,
      sessions: filteredSessions.length,
    });
  }

  /**
   * Parse Claude's output to count tokens (estimation)
   */
  estimateTokensFromText(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    // This is a simplified approach - in production, you'd want to use
    // the actual tokenizer or Claude's API to get exact counts
    return Math.ceil(text.length / 4);
  }

  /**
   * Monitor Claude process output for token counting
   */
  monitorClaudeOutput(sessionId: string, projectName: string, branch: string): void {
    // This would integrate with the tmux session to capture Claude's output
    // and extract token counts from the Claude UI or API responses
    Logger.info('Token monitoring started', { sessionId, projectName, branch });

    // Start session tracking
    this.startSession(projectName, branch);
  }

  // Private helper methods

  private scheduleWrite(type: string, data: unknown): void {
    this.pendingWrites.set(type, data);

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }

    this.writeTimer = setTimeout(() => {
      this.flushWrites();
    }, 1000); // Batch writes every second
  }

  private flushWrites(): void {
    this.pendingWrites.forEach((data, type) => {
      if (type === 'session') {
        this.saveCurrentSession();
      } else if (type === 'usage') {
        const usage = this.loadUsageData();
        usage.push(data as TokenUsage);
        this.saveUsageData(usage);
      }
    });

    this.pendingWrites.clear();
    this.writeTimer = null;
  }

  private saveCurrentSession(): void {
    if (this.currentSession) {
      fs.writeFileSync(this.currentSessionFile, JSON.stringify(this.currentSession, null, 2));
    }
  }

  private loadUsageData(): TokenUsage[] {
    try {
      const data = fs.readFileSync(this.usageFile, 'utf-8');
      return JSON.parse(data) as TokenUsage[];
    } catch {
      return [];
    }
  }

  private saveUsageData(usage: TokenUsage[]): void {
    fs.writeFileSync(this.usageFile, JSON.stringify(usage, null, 2));
  }

  private loadSessionHistory(): SessionData[] {
    const sessionFile = path.join(this.dataDir, 'sessions.json');
    try {
      const data = fs.readFileSync(sessionFile, 'utf-8');
      return JSON.parse(data) as SessionData[];
    } catch {
      // Fallback to loading from usage data for backwards compatibility
      const usage = this.loadUsageData();
      const sessionsMap = new Map<string, SessionData>();

      // Build sessions from usage data
      usage.forEach((entry) => {
        if (!sessionsMap.has(entry.sessionId)) {
          sessionsMap.set(entry.sessionId, {
            sessionId: entry.sessionId,
            projectName: entry.projectName,
            branch: entry.branch,
            startTime: entry.timestamp,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCost: 0,
            conversationCount: 0,
            isActive: false,
          });
        }

        const session = sessionsMap.get(entry.sessionId)!;
        session.totalInputTokens += entry.inputTokens;
        session.totalOutputTokens += entry.outputTokens;
        session.totalCost += entry.cost;
        session.conversationCount++;

        // Update end time to latest entry
        if (!session.endTime || new Date(entry.timestamp) > new Date(session.endTime)) {
          session.endTime = entry.timestamp;
        }
      });

      return Array.from(sessionsMap.values());
    }
  }

  private saveSessionHistory(sessions: SessionData[]): void {
    const sessionFile = path.join(this.dataDir, 'sessions.json');
    fs.writeFileSync(sessionFile, JSON.stringify(sessions, null, 2));
  }
}
