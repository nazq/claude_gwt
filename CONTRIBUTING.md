# Contributing to Claude GWT

Thank you for your interest in contributing to Claude GWT! We welcome contributions from the community.

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/nazq/claude-gwt.git
   cd claude-gwt
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a new branch:
   ```bash
   git checkout -b your-feature-name
   ```

## 🛠️ Development Workflow

### Running the Project

```bash
# Development mode with hot reload
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Code Style

We use ESLint and Prettier to maintain code quality:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Type Checking

```bash
npm run typecheck
```

## 📝 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `chore:` Maintenance tasks

### Examples

```bash
feat: add fuzzy search to branch selection
fix: resolve token tracking memory leak
docs: update README with Docker instructions
```

## 🧪 Testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# With coverage
npm run test:coverage
```

### Writing Tests

- Place unit tests next to the source files: `src/module.ts` → `src/module.test.ts`
- Integration tests go in `tests/integration/`
- E2E tests go in `tests/e2e/`
- Aim for 100% code coverage

## 📚 Documentation

- Update the README.md if you change functionality
- Add JSDoc comments to all public APIs
- Include examples in your documentation
- Update the changelog

## 🔄 Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass
   - Run linting and formatting
   - Update documentation
   - Add tests for new features

2. **PR Title:**
   - Use conventional commit format
   - Be descriptive but concise

3. **PR Description:**
   - Describe what changes you made
   - Explain why these changes are needed
   - Reference any related issues

4. **Review Process:**
   - PRs require at least one approval
   - Address review comments promptly
   - Keep PRs focused and small when possible

## 🏗️ Project Structure

```
claude-gwt/
├── src/
│   ├── cli/            # CLI application
│   ├── core/           # Core business logic
│   ├── mcp/            # MCP server implementation
│   ├── sessions/       # Tmux session management
│   └── types/          # TypeScript types
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/            # End-to-end tests
└── docs/               # Additional documentation
```

## 🐛 Reporting Issues

### Bug Reports

Include:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Node version, etc.)
- Error messages or logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative solutions considered
- Mockups or examples (if applicable)

## 💡 Development Tips

### Debugging

```bash
# Enable debug logging
export DEBUG=claude-gwt:*

# Run with verbose output
claude-gwt -v
claude-gwt -vv
claude-gwt -vvv
```

### Local Testing

```bash
# Build and link locally
npm run build
npm link

# Test in another directory
cd /tmp/test-project
claude-gwt
```

### Performance

- Use async/await for all asynchronous operations
- Batch file system operations when possible
- Implement proper error boundaries
- Add loading states for long operations

## 📦 Release Process

Maintainers handle releases:

1. Update version: `npm version patch|minor|major`
2. Push tags: `git push --tags`
3. GitHub Actions handles the rest

## 🙏 Recognition

Contributors are recognized in:
- The project README
- Release notes
- Our contributors page

## 📞 Getting Help

- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/claude-gwt/issues)

Thank you for contributing to Claude GWT! 🎉