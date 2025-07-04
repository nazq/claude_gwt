# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Runtime stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    tmux \
    bash \
    openssh-client

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create symlinks for CLI commands
RUN ln -s /app/dist/src/cli/index.js /usr/local/bin/claude-gwt && \
    ln -s /app/dist/src/cli/cgwt.js /usr/local/bin/cgwt && \
    chmod +x /app/dist/src/cli/index.js && \
    chmod +x /app/dist/src/cli/cgwt.js

# Create non-root user
RUN addgroup -g 1000 claude && \
    adduser -D -u 1000 -G claude claude && \
    mkdir -p /home/claude/.config/claude-gwt && \
    chown -R claude:claude /home/claude

USER claude
WORKDIR /home/claude

# Set up Git config
RUN git config --global user.email "claude@example.com" && \
    git config --global user.name "Claude GWT"

# Default command
CMD ["claude-gwt"]