#!/bin/bash

# Generate a beautiful HTML index for all reports

cat > reports/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude GWT - Code Quality Reports</title>
    <style>
        :root {
            --primary: #00ADD8;
            --secondary: #00C7B7;
            --dark: #1a1a2e;
            --darker: #0f0f23;
            --light: #f5f5f5;
            --shadow: rgba(0, 0, 0, 0.1);
            --card-bg: #ffffff;
            --text: #333333;
            --success: #4caf50;
            --warning: #ff9800;
            --error: #f44336;
            --info: #2196f3;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            color: var(--text);
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        header {
            text-align: center;
            margin-bottom: 3rem;
            animation: fadeInDown 0.8s ease-out;
        }

        h1 {
            font-size: 3rem;
            color: var(--dark);
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px var(--shadow);
        }

        .subtitle {
            color: #666;
            font-size: 1.2rem;
        }

        .logo {
            font-size: 4rem;
            margin-bottom: 1rem;
        }

        .timestamp {
            color: #999;
            font-size: 0.9rem;
            margin-top: 1rem;
        }

        .report-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }

        .report-card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 8px 32px var(--shadow);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            animation: fadeInUp 0.8s ease-out;
            animation-fill-mode: both;
        }

        .report-card:nth-child(1) { animation-delay: 0.1s; }
        .report-card:nth-child(2) { animation-delay: 0.2s; }
        .report-card:nth-child(3) { animation-delay: 0.3s; }
        .report-card:nth-child(4) { animation-delay: 0.4s; }
        .report-card:nth-child(5) { animation-delay: 0.5s; }
        .report-card:nth-child(6) { animation-delay: 0.6s; }

        .report-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }

        .report-card::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
        }

        .report-card.coverage::before { background: var(--success); }
        .report-card.lint::before { background: var(--warning); }
        .report-card.tests::before { background: var(--primary); }
        .report-card.complexity::before { background: var(--secondary); }
        .report-card.typescript::before { background: #3178c6; }
        .report-card.mutation::before { background: #9c27b0; }

        .report-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
        }

        .report-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            color: var(--dark);
        }

        .report-description {
            color: #666;
            margin-bottom: 1.5rem;
            font-size: 0.95rem;
        }

        .report-links {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .report-link {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--primary);
            text-decoration: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            background: rgba(0, 173, 216, 0.1);
            transition: all 0.2s ease;
        }

        .report-link:hover {
            background: rgba(0, 173, 216, 0.2);
            transform: translateX(5px);
        }

        .report-link.unavailable {
            color: #999;
            background: rgba(0, 0, 0, 0.05);
            cursor: not-allowed;
            opacity: 0.6;
        }

        .report-link.unavailable:hover {
            transform: none;
            background: rgba(0, 0, 0, 0.05);
        }

        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 1rem;
        }

        .status-badge.success {
            background: rgba(76, 175, 80, 0.2);
            color: var(--success);
        }

        .status-badge.warning {
            background: rgba(255, 152, 0, 0.2);
            color: var(--warning);
        }

        .status-badge.error {
            background: rgba(244, 67, 54, 0.2);
            color: var(--error);
        }

        .status-badge.pending {
            background: rgba(158, 158, 158, 0.2);
            color: #666;
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .quick-stats {
            display: flex;
            justify-content: center;
            gap: 3rem;
            margin: 2rem 0;
            flex-wrap: wrap;
        }

        .stat-item {
            text-align: center;
            animation: fadeInUp 0.8s ease-out;
            background: white;
            padding: 1.5rem 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .stat-value {
            font-size: 2.5rem;
            font-weight: bold;
            color: var(--primary);
        }

        .stat-label {
            color: #666;
            font-size: 0.9rem;
        }

        @media (max-width: 768px) {
            h1 { font-size: 2rem; }
            .report-grid { grid-template-columns: 1fr; }
            .quick-stats { gap: 1.5rem; }
        }

        /* Modal styles for JSON viewer */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.6);
            animation: fadeIn 0.3s ease-out;
        }

        .modal-content {
            background-color: #fefefe;
            margin: 5% auto;
            padding: 0;
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        }

        .modal-header {
            padding: 1.5rem;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-body {
            padding: 2rem;
            max-height: 70vh;
            overflow-y: auto;
        }

        .close {
            color: white;
            font-size: 2rem;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s ease;
        }

        .close:hover {
            transform: scale(1.2);
        }

        .json-content {
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 8px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9rem;
            overflow-x: auto;
        }

        .test-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .test-stat {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .test-stat-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }

        .test-stat-label {
            color: #666;
            font-size: 0.85rem;
        }

        .test-stat.success .test-stat-value { color: var(--success); }
        .test-stat.warning .test-stat-value { color: var(--warning); }
        .test-stat.error .test-stat-value { color: var(--error); }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from {
                transform: translateY(-50px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        .info-box {
            background: rgba(33, 150, 243, 0.1);
            border-left: 4px solid var(--info);
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
        }

        .info-box h3 {
            color: var(--info);
            margin-bottom: 0.5rem;
        }
    </style>
    <script>
        // Global variables for report data
        let testResults = null;
        let coverageData = null;

        // Check which reports are available
        async function checkReportAvailability() {
            const reports = [
                { id: 'coverage-link', path: 'coverage/index.html' },
                { id: 'eslint-link', path: 'lint/eslint-report.html' },
                { id: 'eslint-stats-link', path: 'lint/eslint-stats.html' },
                { id: 'test-results-link', path: 'tests/test-results.json' },
                { id: 'deps-link', path: 'complexity/dependencies.html' },
                { id: 'circular-link', path: 'complexity/circular-deps.html' },
                { id: 'bundle-link', path: 'complexity/bundle-sizes.html' },
                { id: 'typescript-link', path: 'lint/typescript-diagnostics.html' },
                { id: 'mutation-link', path: 'mutation/index.html' }
            ];

            for (const report of reports) {
                try {
                    const response = await fetch(report.path, { method: 'HEAD' });
                    const link = document.getElementById(report.id);
                    if (link) {
                        if (!response.ok) {
                            link.classList.add('unavailable');
                            link.title = 'Report not available - run npm run reports to generate';
                            link.onclick = (e) => {
                                e.preventDefault();
                                alert('This report has not been generated yet.\\n\\nRun: npm run reports');
                            };
                        }
                    }
                } catch (e) {
                    // File doesn't exist
                    const link = document.getElementById(report.id);
                    if (link) {
                        link.classList.add('unavailable');
                        link.title = 'Report not available - run npm run reports to generate';
                        link.onclick = (e) => {
                            e.preventDefault();
                            alert('This report has not been generated yet.\\n\\nRun: npm run reports');
                        };
                    }
                }
            }

            // Load test results for stats
            try {
                const response = await fetch('tests/test-results.json');
                if (response.ok) {
                    testResults = await response.json();
                    updateTestStats();
                }
            } catch (e) {
                console.error('Failed to load test results:', e);
            }

            // Try to load coverage data
            try {
                const response = await fetch('coverage/coverage-summary.json');
                if (response.ok) {
                    coverageData = await response.json();
                    updateCoverageStats();
                }
            } catch (e) {
                // Coverage summary might not exist
            }
        }

        function updateTestStats() {
            if (!testResults) return;

            document.getElementById('total-tests').textContent = testResults.numTotalTests || '800+';
            document.getElementById('test-duration').textContent = 
                testResults.testResults ? Math.round(testResults.testResults.reduce((acc, t) => acc + (t.endTime - t.startTime), 0) / 1000) + 's' : 'N/A';
            
            // Update test badge
            const testBadge = document.querySelector('.report-card.tests .status-badge');
            if (testBadge) {
                if (testResults.numFailedTests > 0) {
                    testBadge.textContent = `${testResults.numFailedTests} Failed`;
                    testBadge.className = 'status-badge error';
                } else {
                    testBadge.textContent = 'All Passing';
                    testBadge.className = 'status-badge success';
                }
            }
        }

        function updateCoverageStats() {
            if (!coverageData || !coverageData.total) return;

            const coverage = Math.round(coverageData.total.lines.pct || 0);
            document.getElementById('coverage-percent').textContent = coverage + '%';
            
            // Update coverage badge
            const coverageBadge = document.querySelector('.report-card.coverage .status-badge');
            if (coverageBadge) {
                if (coverage === 100) {
                    coverageBadge.textContent = '100% Coverage';
                    coverageBadge.className = 'status-badge success';
                } else if (coverage >= 80) {
                    coverageBadge.textContent = coverage + '% Coverage';
                    coverageBadge.className = 'status-badge warning';
                } else {
                    coverageBadge.textContent = coverage + '% Coverage';
                    coverageBadge.className = 'status-badge error';
                }
            }
        }

        function showTestResults() {
            if (!testResults) {
                window.location.href = 'tests/test-results.json';
                return;
            }

            const modal = document.getElementById('jsonModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');

            modalTitle.textContent = 'Test Results Summary';
            
            let html = '<div class="test-summary">';
            html += `<div class="test-stat success">
                        <div class="test-stat-value">${testResults.numPassedTests || 0}</div>
                        <div class="test-stat-label">Passed Tests</div>
                     </div>`;
            html += `<div class="test-stat ${testResults.numFailedTests > 0 ? 'error' : 'success'}">
                        <div class="test-stat-value">${testResults.numFailedTests || 0}</div>
                        <div class="test-stat-label">Failed Tests</div>
                     </div>`;
            html += `<div class="test-stat">
                        <div class="test-stat-value">${testResults.numTotalTestSuites || 0}</div>
                        <div class="test-stat-label">Test Suites</div>
                     </div>`;
            html += `<div class="test-stat">
                        <div class="test-stat-value">${Math.round((testResults.testResults || []).reduce((acc, t) => acc + (t.endTime - t.startTime), 0) / 1000)}s</div>
                        <div class="test-stat-label">Total Duration</div>
                     </div>`;
            html += '</div>';

            html += '<div class="info-box"><h3>Full JSON Data</h3><p>Click the link below to view the complete test results JSON file.</p></div>';
            html += '<div class="json-content"><pre>' + JSON.stringify(testResults, null, 2).substring(0, 1000) + '...</pre></div>';
            html += '<br><a href="tests/test-results.json" class="report-link" style="display:inline-block">📄 View Full JSON File</a>';

            modalBody.innerHTML = html;
            modal.style.display = 'block';
        }

        function closeModal() {
            document.getElementById('jsonModal').style.display = 'none';
        }

        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('jsonModal');
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }

        window.onload = checkReportAvailability;
    </script>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">🌳</div>
            <h1>Claude GWT Code Quality Dashboard</h1>
            <p class="subtitle">Comprehensive code analysis and metrics</p>
            <p class="timestamp">Generated on: <script>document.write(new Date().toLocaleString());</script></p>
        </header>

        <div class="quick-stats">
            <div class="stat-item">
                <div class="stat-value" id="total-tests">800+</div>
                <div class="stat-label">Tests</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="coverage-percent">86%</div>
                <div class="stat-label">Coverage</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="test-duration">~24s</div>
                <div class="stat-label">Test Duration</div>
            </div>
        </div>

        <div class="report-grid">
            <div class="report-card coverage">
                <span class="report-icon">📊</span>
                <h2 class="report-title">Test Coverage</h2>
                <p class="report-description">
                    Interactive code coverage report with detailed line, branch, function, and statement metrics
                </p>
                <div class="report-links">
                    <a href="coverage/index.html" class="report-link" id="coverage-link">
                        📈 View Interactive Report
                    </a>
                </div>
                <span class="status-badge success">86% Coverage</span>
            </div>

            <div class="report-card lint">
                <span class="report-icon">🔧</span>
                <h2 class="report-title">ESLint Analysis</h2>
                <p class="report-description">
                    Code quality issues, style violations, and best practice recommendations
                </p>
                <div class="report-links">
                    <a href="lint/eslint-report.html" class="report-link" id="eslint-link">
                        📋 ESLint Report
                    </a>
                    <a href="lint/eslint-stats.html" class="report-link" id="eslint-stats-link">
                        📊 Lint Statistics
                    </a>
                </div>
                <span class="status-badge warning">26 Issues</span>
            </div>

            <div class="report-card tests">
                <span class="report-icon">🧪</span>
                <h2 class="report-title">Test Results</h2>
                <p class="report-description">
                    Detailed test execution results with timing and performance metrics
                </p>
                <div class="report-links">
                    <a href="#" onclick="showTestResults(); return false;" class="report-link" id="test-results-link">
                        📄 View Test Summary
                    </a>
                </div>
                <span class="status-badge success">All Passing</span>
            </div>

            <div class="report-card complexity">
                <span class="report-icon">🕸️</span>
                <h2 class="report-title">Code Complexity</h2>
                <p class="report-description">
                    Bundle size analysis, dependency information, and circular dependency detection
                </p>
                <div class="report-links">
                    <a href="complexity/bundle-sizes.html" class="report-link" id="bundle-link">
                        📦 Bundle Analysis
                    </a>
                    <a href="complexity/dependencies.html" class="report-link" id="deps-link">
                        🗺️ Dependencies
                    </a>
                    <a href="complexity/circular-deps.html" class="report-link" id="circular-link">
                        🔄 Circular Deps
                    </a>
                </div>
                <span class="status-badge pending">868K Total</span>
            </div>

            <div class="report-card typescript">
                <span class="report-icon">📝</span>
                <h2 class="report-title">TypeScript</h2>
                <p class="report-description">
                    TypeScript compiler diagnostics and type checking results
                </p>
                <div class="report-links">
                    <a href="lint/typescript-diagnostics.html" class="report-link" id="typescript-link">
                        🔍 Type Diagnostics
                    </a>
                </div>
                <span class="status-badge success">No Errors</span>
            </div>

            <div class="report-card mutation">
                <span class="report-icon">🧬</span>
                <h2 class="report-title">Mutation Testing</h2>
                <p class="report-description">
                    Test quality analysis through code mutation (when available)
                </p>
                <div class="report-links">
                    <a href="mutation/index.html" class="report-link" id="mutation-link">
                        🧬 Mutation Report
                    </a>
                </div>
                <span class="status-badge warning">Optional</span>
            </div>
        </div>
    </div>

    <!-- Modal for JSON viewer -->
    <div id="jsonModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Report Viewer</h2>
                <span class="close" onclick="closeModal()">&times;</span>
            </div>
            <div class="modal-body" id="modalBody">
                <!-- Content will be inserted here -->
            </div>
        </div>
    </div>
</body>
</html>
EOF

echo "📄 Generated reports index: reports/index.html"