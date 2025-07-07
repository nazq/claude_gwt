#!/bin/bash

# Generate comprehensive code quality reports for claude-gwt

echo "🔍 Generating Code Quality Reports..."

# Create reports directory
mkdir -p reports/{coverage,lint,tests,complexity}

# 1. Test Coverage Report
echo "📊 Generating test coverage report..."
npm run test:coverage

# 2. ESLint Report
echo "🔧 Generating lint report..."
npx eslint src/**/*.ts tests/**/*.ts --format html --output-file reports/lint/eslint-report.html || true

# 3. ESLint Statistics
echo "📈 Generating lint statistics..."
npx eslint src/**/*.ts tests/**/*.ts --format json | npx eslint-stats --format html > reports/lint/eslint-stats.html || true

# 4. Test Report with Vitest UI
echo "🧪 Test report available via: npm run test -- --ui"

# 5. Dependency Analysis
echo "🕸️ Generating dependency graph..."
if command -v madge &> /dev/null; then
    madge --image reports/complexity/dependencies.svg src/
    madge --circular src/ > reports/complexity/circular-deps.txt
else
    echo "   Install madge for dependency graphs: npm install -g madge"
fi

# 6. TypeScript Compiler Diagnostics
echo "📝 Generating TypeScript diagnostics..."
npx tsc --noEmit --pretty --skipLibCheck > reports/lint/typescript-diagnostics.txt 2>&1 || true

# 7. Bundle Size Analysis (for CLI)
echo "📦 Analyzing bundle size..."
if [ -d "dist" ]; then
    du -sh dist/* > reports/complexity/bundle-sizes.txt
    find dist -name "*.js" -exec wc -l {} + | sort -rn > reports/complexity/line-counts.txt
fi

# 8. Test Execution Summary
echo "⏱️ Generating test execution summary..."
npm test -- --reporter=json --outputFile=reports/tests/test-results.json || true

# 9. Mutation Testing (if requested)
if [ "$1" == "--with-mutation" ]; then
    echo "🧬 Running mutation testing (this may take several minutes)..."
    npm run test:mutation:quick || true
    echo "   Full mutation report: reports/mutation/index.html"
fi

# Summary
echo ""
echo "✅ Reports generated in ./reports/"
echo ""
echo "📁 Available reports:"
echo "   - reports/coverage/index.html       → Interactive coverage report"
echo "   - reports/lint/eslint-report.html   → ESLint issues"
echo "   - reports/lint/eslint-stats.html    → Lint statistics"
echo "   - reports/complexity/dependencies.svg → Dependency graph"
echo "   - reports/tests/test-results.json   → Test execution data"
echo ""
echo "🎯 Quick access:"
echo "   open reports/coverage/index.html"
echo "   open reports/lint/eslint-report.html"