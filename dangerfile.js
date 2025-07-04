const { danger, warn, fail, message } = require('danger');

// Check PR size
const bigPRThreshold = 600;
if (danger.github.pr.additions + danger.github.pr.deletions > bigPRThreshold) {
  warn(`This PR is quite large (${danger.github.pr.additions + danger.github.pr.deletions} lines). Consider breaking it into smaller PRs.`);
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
  const content = danger.github.utils.fileContents(file);
  if (content && content.includes('console.log')) {
    warn(`Found console.log in ${file}. Consider using the Logger utility instead.`);
  }
}

// Encourage documentation updates
const hasDocsChanges = danger.git.modified_files.some(f => f.includes('docs/') || f.includes('README'));
if (!hasDocsChanges && danger.github.pr.additions > 100) {
  message('Consider updating documentation if this PR introduces new features or changes behavior.');
}

// Success message
message('Thanks for the PR! 🎉');