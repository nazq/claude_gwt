#!/bin/bash

echo "Testing Claude GWT Token Tracking System"
echo "======================================="

# Build the project first
echo "Building project..."
npm run build

# Test token tracking commands
echo -e "\n1. Testing current session (no active session expected):"
node dist/src/cli/cgwt.js tokens

echo -e "\n2. Testing today's usage:"
node dist/src/cli/cgwt.js tokens --today

echo -e "\n3. Testing weekly usage:"
node dist/src/cli/cgwt.js tokens --week

echo -e "\n4. Testing monthly usage:"
node dist/src/cli/cgwt.js tokens --month

echo -e "\n5. Testing branch breakdown:"
node dist/src/cli/cgwt.js tokens --by-branch

echo -e "\n6. Testing cost analysis:"
node dist/src/cli/cgwt.js tokens --cost

echo -e "\n7. Testing export functionality:"
node dist/src/cli/cgwt.js tokens --export csv test-export
echo "   - Created test-export.csv"

node dist/src/cli/cgwt.js tokens --export json test-export
echo "   - Created test-export.json"

echo -e "\n8. Testing standalone token reporter:"
node dist/src/cli/token-report.js --help

echo -e "\nToken tracking test complete!"
echo "============================================"
echo ""
echo "Integration with tmux sessions:"
echo "- Token tracking starts automatically when creating Claude sessions"
echo "- Status bar shows real-time token usage"
echo "- Use 'cgwt tokens' to view detailed reports"
echo ""
echo "Next steps:"
echo "1. Run 'claude-gwt' to create a session"
echo "2. Token tracking will start automatically"
echo "3. Check tmux status bar for real-time updates"
echo "4. Use 'cgwt tokens' commands to view reports"