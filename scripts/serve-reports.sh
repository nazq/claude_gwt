#!/bin/bash

PORT=${1:-8080}

echo "🌐 Starting report server..."

# Check if reports directory exists
if [ ! -d "reports" ]; then
    echo "❌ No reports directory found. Run 'npm run reports' first."
    exit 1
fi

# Try different servers in order of preference
if command -v python3 &> /dev/null; then
    echo "📊 Serving reports at http://localhost:$PORT"
    echo "📁 Press Ctrl+C to stop the server"
    cd reports && python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    echo "📊 Serving reports at http://localhost:$PORT"
    echo "📁 Press Ctrl+C to stop the server"
    cd reports && python -m SimpleHTTPServer $PORT
elif command -v npx &> /dev/null; then
    echo "📊 Using npx http-server..."
    npx http-server reports -p $PORT -o
else
    echo "❌ No suitable HTTP server found."
    echo "   Install Python 3 or run: npm install -g http-server"
    exit 1
fi