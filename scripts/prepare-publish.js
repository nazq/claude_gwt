#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing claude-gwt for npm publish...\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: package.json not found. Run this script from the project root.');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log(`📦 Package: ${packageJson.name}@${packageJson.version}`);

// Check if dist exists
if (!fs.existsSync('dist')) {
  console.log('🔨 Building project...');
  execSync('npm run build:clean', { stdio: 'inherit' });
} else {
  console.log('✅ Build directory exists');
}

// Verify CLI entry point
const cliPath = path.join('dist', 'src', 'cli', 'index.js');
if (!fs.existsSync(cliPath)) {
  console.error('❌ Error: CLI entry point not found at', cliPath);
  process.exit(1);
}

// Check if file is executable
try {
  fs.accessSync(cliPath, fs.constants.X_OK);
  console.log('✅ CLI entry point is executable');
} catch (err) {
  console.log('🔧 Making CLI entry point executable...');
  fs.chmodSync(cliPath, '755');
}

// Verify shebang in built file
const cliContent = fs.readFileSync(cliPath, 'utf8');
if (!cliContent.startsWith('#!/usr/bin/env node')) {
  console.log('🔧 Adding shebang to CLI entry point...');
  fs.writeFileSync(cliPath, '#!/usr/bin/env node\n' + cliContent);
}

// Check required files
const requiredFiles = ['README.md', 'LICENSE', 'CLAUDE.md'];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
  console.error('❌ Error: Missing required files:', missingFiles.join(', '));
  process.exit(1);
}
console.log('✅ All required files present');

// Run tests
console.log('\n🧪 Running tests...');
try {
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ All tests passed');
} catch (err) {
  console.error('❌ Tests failed. Fix failing tests before publishing.');
  process.exit(1);
}

// Check npm login status
console.log('\n🔐 Checking npm authentication...');
try {
  const whoami = execSync('npm whoami', { encoding: 'utf8' }).trim();
  console.log(`✅ Logged in as: ${whoami}`);
} catch (err) {
  console.log('⚠️  Warning: Not logged in to npm. Run "npm login" before publishing.');
}

// Dry run
console.log('\n📋 Package contents (dry run):');
execSync('npm pack --dry-run', { stdio: 'inherit' });

console.log('\n✨ Package is ready for publishing!');
console.log('\nTo publish:');
console.log('  npm publish');
console.log('\nTo publish with a tag:');
console.log('  npm publish --tag next');
console.log('  npm publish --tag beta');