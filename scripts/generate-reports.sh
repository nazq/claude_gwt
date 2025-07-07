#!/bin/bash

# Generate comprehensive code quality reports for claude-gwt

echo "🔍 Generating Code Quality Reports..."

# Create reports directory
mkdir -p reports/{coverage,lint,tests,complexity}

# 1. Test Coverage Report
echo "📊 Generating test coverage report..."
npm run test:coverage
# Copy coverage report to reports directory
cp -r coverage/* reports/coverage/ 2>/dev/null || true

# 2. ESLint Report
echo "🔧 Generating lint report..."
npx eslint src/**/*.ts tests/**/*.ts --format html --output-file reports/lint/eslint-report.html || true

# 3. ESLint Statistics (if eslint-stats is available)
echo "📈 Generating lint statistics..."
if command -v eslint-stats &> /dev/null || npx eslint-stats --help &> /dev/null 2>&1; then
    npx eslint src/**/*.ts tests/**/*.ts --format json | npx eslint-stats --format html > reports/lint/eslint-stats.html || true
else
    echo "   Skipping: Install eslint-stats for statistics (npm install -g eslint-stats)"
fi

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
if [ ! -d "dist" ]; then
    echo "   Building project for bundle analysis..."
    npm run build:clean > /dev/null 2>&1 || true
fi

if [ -d "dist" ]; then
    echo "Bundle Size Analysis" > reports/complexity/bundle-sizes.txt
    echo "===================" >> reports/complexity/bundle-sizes.txt
    echo "" >> reports/complexity/bundle-sizes.txt
    echo "Total sizes by directory:" >> reports/complexity/bundle-sizes.txt
    du -sh dist/* | sort -hr >> reports/complexity/bundle-sizes.txt
    echo "" >> reports/complexity/bundle-sizes.txt
    echo "Individual file sizes:" >> reports/complexity/bundle-sizes.txt
    find dist -name "*.js" -exec du -sh {} \; | sort -hr >> reports/complexity/bundle-sizes.txt
    
    echo "Line counts for JavaScript files:" > reports/complexity/line-counts.txt
    find dist -name "*.js" -exec wc -l {} + | sort -rn >> reports/complexity/line-counts.txt
else
    echo "No dist directory found after build attempt" > reports/complexity/bundle-sizes.txt
fi

# Also create empty placeholder files for missing reports
touch reports/complexity/circular-deps.txt 2>/dev/null || true
echo "Install madge to generate dependency graphs: npm install -g madge" > reports/complexity/dependencies.txt

# 8. Test Execution Summary
echo "⏱️ Generating test execution summary..."
npm test -- --reporter=json --outputFile=reports/tests/test-results.json || true

# 9. Mutation Testing (if requested)
if [ "$1" == "--with-mutation" ]; then
    echo "🧬 Running mutation testing (this may take several minutes)..."
    npm run test:mutation:quick || true
    echo "   Full mutation report: reports/mutation/index.html"
fi

# Generate HTML viewers for text reports
echo "📄 Generating HTML viewers for text reports..."
./scripts/generate-text-viewer.sh

# Generate beautiful index page
echo "🎨 Generating report index..."
./scripts/generate-report-index.sh

# Summary
echo ""
echo "✅ Reports generated in ./reports/"
echo ""
echo "📁 Available reports:"
echo "   - reports/index.html                → 🌟 Main Dashboard (start here!)"
echo "   - reports/coverage/index.html       → Interactive coverage report"
echo "   - reports/lint/eslint-report.html   → ESLint issues"
echo "   - reports/lint/eslint-stats.html    → Lint statistics"
echo "   - reports/complexity/dependencies.svg → Dependency graph"
echo "   - reports/tests/test-results.json   → Test execution data"
echo ""
echo "🎯 Quick access:"
echo "   npm run reports:serve    → Open in browser with live server"
echo "   open reports/index.html  → Open directly"