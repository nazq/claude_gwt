#!/bin/bash
# Retry ESLint commands up to 3 times to handle segfaults

MAX_RETRIES=3
RETRY_COUNT=0
EXIT_CODE=1

# Get the ESLint command and arguments
ESLINT_CMD="$@"

echo "Running: eslint $ESLINT_CMD"

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ $EXIT_CODE -ne 0 ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        echo "Retry attempt $RETRY_COUNT of $MAX_RETRIES..."
        sleep 1  # Brief pause between retries
    fi
    
    # Run ESLint with the provided arguments
    eslint $ESLINT_CMD
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "ESLint completed successfully"
        exit 0
    elif [ $EXIT_CODE -eq 139 ]; then
        # Segmentation fault
        echo "ESLint segfaulted (exit code 139)"
        RETRY_COUNT=$((RETRY_COUNT + 1))
    else
        # Other error - don't retry
        echo "ESLint failed with exit code $EXIT_CODE"
        exit $EXIT_CODE
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ESLint failed after $MAX_RETRIES attempts"
    exit 1
fi