# Claude GWT Token Tracking System

A comprehensive token tracking and cost analysis system for Claude GWT that monitors API usage across sessions, branches, and projects.

## Features

### 1. **Automatic Token Tracking**
- Starts automatically when Claude sessions are created
- Tracks input and output tokens separately
- Associates usage with specific branches and projects
- Stores data persistently in `~/.claude-gwt/usage/`

### 2. **Real-time Status Bar**
- Live token count in tmux status bar
- Visual indicators for usage levels:
  - 🟢 Normal usage (< $5)
  - 🟡 Moderate usage ($5-$10)
  - 🔴 High usage (> $10)
- Updates every 5 seconds

### 3. **Comprehensive CLI Commands**

#### Basic Usage
```bash
# Show current session usage
cgwt tokens

# Show today's usage
cgwt tokens --today

# Show this week's usage
cgwt tokens --week

# Show this month's usage
cgwt tokens --month
```

#### Advanced Analytics
```bash
# Usage by branch
cgwt tokens --by-branch
cgwt tokens --by-branch feature-xyz

# Cost analysis and projections
cgwt tokens --cost

# Export data
cgwt tokens --export csv my-usage
cgwt tokens --export json my-usage
```

### 4. **Visual Reports**
- Terminal-based charts and graphs
- Token distribution visualizations
- Branch and project breakdowns
- Cost projections

### 5. **Cost Tracking**
- Accurate pricing based on Claude model tiers
- Per-session cost calculation
- Monthly and yearly projections
- Cost warnings for high usage

## Architecture

### Core Components

1. **TokenTracker** (`src/core/TokenTracker.ts`)
   - Manages token counting and storage
   - Calculates costs based on model pricing
   - Provides data aggregation methods

2. **TokenReporter** (`src/core/TokenReporter.ts`)
   - Generates visual reports
   - Creates terminal-based charts
   - Formats usage statistics

3. **TokenStatusBar** (`src/core/TokenStatusBar.ts`)
   - Updates tmux status bar
   - Provides real-time usage display
   - Generates warning messages

4. **TokenMonitor** (`src/core/TokenMonitor.ts`)
   - Monitors Claude process output
   - Extracts token information
   - Wrapper script for automatic tracking

## Data Storage

Token usage data is stored in JSON format at:
- `~/.claude-gwt/usage/usage.json` - Historical usage data
- `~/.claude-gwt/usage/current-session.json` - Active session data
- `~/.claude-gwt/usage/status.txt` - Current status for tmux

## Integration with Claude GWT

### Automatic Session Tracking
When you start a Claude session through `claude-gwt`:
1. Token tracking begins automatically
2. Session is associated with current branch/project
3. Real-time updates appear in tmux status bar
4. Data is saved for historical analysis

### Tmux Status Bar Format
```
[Role] [Project] [Branch] | 🟢 📊 1.2K 💰 $0.45 ⚡ 3 chats | [Git] | [Time]
```

## Usage Examples

### Daily Workflow
```bash
# Start your day - check yesterday's usage
cgwt tokens --today

# Start working on a feature branch
claude-gwt  # Token tracking starts automatically

# Check current session usage anytime
cgwt tokens

# End of day - review costs
cgwt tokens --cost
```

### Weekly Review
```bash
# Check weekly usage breakdown
cgwt tokens --week

# See which branches used most tokens
cgwt tokens --by-branch

# Export data for reporting
cgwt tokens --export csv weekly-report
```

### Cost Management
```bash
# Monitor current costs
cgwt tokens --cost

# Set up alerts (in tmux status bar)
# 🔴 appears when session > $10

# Review monthly projections
cgwt tokens --month
```

## Token Estimation

The system uses multiple methods to track tokens:
1. **Direct API Response Parsing** - Extracts from Claude's output
2. **Pattern Matching** - Identifies token counts in responses
3. **Text Estimation** - Fallback character-based estimation

## Pricing Model

Default pricing (per 1K tokens):
- Claude 3 Opus: $0.015 input / $0.075 output
- Claude 3 Sonnet: $0.003 input / $0.015 output
- Claude 3 Haiku: $0.00025 input / $0.00125 output

## Troubleshooting

### No Token Data Showing
1. Check if `~/.claude-gwt/usage/` directory exists
2. Ensure tmux status bar is enabled
3. Verify Claude session is active

### Incorrect Token Counts
- Token counting relies on Claude's output format
- Some estimates may be approximate
- Use export feature for detailed analysis

### Status Bar Not Updating
```bash
# Manually refresh tmux status
tmux refresh-client -S

# Check status file
cat ~/.claude-gwt/usage/status.txt
```

## Future Enhancements

- [ ] Integration with Claude API for exact token counts
- [ ] Budget alerts and limits
- [ ] Team usage aggregation
- [ ] Historical trend analysis
- [ ] Custom pricing models
- [ ] Webhook notifications for high usage

## Contributing

Token tracking improvements welcome! Key areas:
- Better token extraction patterns
- More accurate estimation algorithms
- Enhanced visualization options
- Additional export formats