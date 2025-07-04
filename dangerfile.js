const { danger, warn, fail, message, markdown } = require('danger');

// Async function to check file contents
async function checkFileContents() {
  const results = [];
  
  // Check PR size
  const bigPRThreshold = 600;
  const totalChanges = danger.github.pr.additions + danger.github.pr.deletions;
  if (totalChanges > bigPRThreshold) {
    warn(`This PR is quite large (${totalChanges} lines). Consider breaking it into smaller PRs.`);
  }

  // Check for tests
  const hasTests = danger.git.modified_files.some(f => f.includes('.test.') || f.includes('.spec.'));
  const hasSourceChanges = danger.git.modified_files.some(f => f.includes('src/') && !f.includes('.test.'));

  if (hasSourceChanges && !hasTests) {
    warn('This PR modifies source files but does not include tests. Please consider adding tests.');
  }

  // Check for console.log statements
  const jsFiles = danger.git.modified_files.filter(path => path.endsWith('.ts') || path.endsWith('.js'));
  
  for (const file of jsFiles) {
    try {
      const content = await danger.github.utils.fileContents(file);
      if (content && content.includes && content.includes('console.log')) {
        // Skip test files and specific allowed files
        if (!file.includes('.test.') && !file.includes('.spec.') && !file.includes('dangerfile.js')) {
          warn(`Found console.log in ${file}. Consider using the Logger utility instead.`);
        }
      }
    } catch (error) {
      // File might not be accessible, skip it
      console.error(`Could not read file ${file}:`, error.message);
    }
  }

  // Check for TypeScript 'any' types in new code
  const tsFiles = danger.git.modified_files.filter(path => path.endsWith('.ts') && !path.endsWith('.d.ts'));
  for (const file of tsFiles) {
    try {
      const content = await danger.github.utils.fileContents(file);
      if (content && content.includes && content.includes(': any')) {
        message(`Found 'any' type in ${file}. Consider using more specific types for better type safety.`);
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  // Encourage documentation updates
  const hasDocsChanges = danger.git.modified_files.some(f => 
    f.includes('docs/') || 
    f.includes('README') || 
    f.includes('CHANGELOG') ||
    f.includes('.md')
  );
  
  if (!hasDocsChanges && danger.github.pr.additions > 100) {
    message('Consider updating documentation if this PR introduces new features or changes behavior.');
  }

  // Check package-lock.json is updated with package.json
  const hasPackageChanges = danger.git.modified_files.includes('package.json');
  const hasLockChanges = danger.git.modified_files.includes('package-lock.json');
  
  if (hasPackageChanges && !hasLockChanges) {
    fail('package.json was modified but package-lock.json was not. Please run `npm install` to update the lock file.');
  }

  // PR description check
  if (danger.github.pr.body.length < 50) {
    warn('PR description is quite short. Please provide more context about the changes.');
  }

  // Success message with PR stats
  const testFiles = danger.git.modified_files.filter(f => f.includes('.test.') || f.includes('.spec.')).length;
  const srcFiles = danger.git.modified_files.filter(f => f.includes('src/') && !f.includes('.test.')).length;
  
  markdown(`### PR Statistics
  - 📝 Files changed: ${danger.git.modified_files.length}
  - ➕ Lines added: ${danger.github.pr.additions}
  - ➖ Lines deleted: ${danger.github.pr.deletions}
  - 🧪 Test files: ${testFiles}
  - 📦 Source files: ${srcFiles}
  `);

  message('Thanks for the PR! 🎉');
}

// Run the async checks
checkFileContents().catch(error => {
  fail(`Danger encountered an error: ${error.message}`);
});