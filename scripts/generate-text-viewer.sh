#!/bin/bash

# Generate HTML viewer for text reports

create_html_viewer() {
    local input_file=$1
    local output_file=$2
    local title=$3
    
    # Read the content and escape HTML entities
    local content=$(cat "$input_file" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')
    
    cat > "$output_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$title - Claude GWT</title>
    <style>
        :root {
            --primary: #00ADD8;
            --secondary: #00C7B7;
            --dark: #1a1a2e;
            --bg: #f5f7fa;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: #333;
        }
        
        .header {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 2rem;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            margin: 0;
            font-size: 2rem;
        }
        
        .header p {
            margin: 0.5rem 0 0 0;
            opacity: 0.9;
        }
        
        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        
        .content-box {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        
        .content-box h2 {
            margin-top: 0;
            color: var(--dark);
            border-bottom: 2px solid #eee;
            padding-bottom: 0.5rem;
        }
        
        pre {
            background: #f8f8f8;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 1.5rem;
            overflow-x: auto;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9rem;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .nav {
            margin-bottom: 2rem;
            text-align: center;
        }
        
        .nav a {
            display: inline-block;
            padding: 0.5rem 1.5rem;
            background: var(--primary);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: all 0.2s ease;
            margin: 0 0.5rem;
        }
        
        .nav a:hover {
            background: var(--secondary);
            transform: translateY(-2px);
        }
        
        .footer {
            text-align: center;
            margin: 3rem 0;
            color: #666;
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 0 1rem;
            }
            
            .content-box {
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌳 $title</h1>
        <p>Claude GWT Code Quality Report</p>
    </div>
    
    <div class="container">
        <div class="nav">
            <a href="../index.html">← Back to Dashboard</a>
            <a href="#" onclick="window.location.reload()">🔄 Refresh</a>
        </div>
        
        <div class="content-box">
            <h2>Report Content</h2>
            <pre>$content</pre>
        </div>
        
        <div class="footer">
            <p>Generated on $(date)</p>
        </div>
    </div>
</body>
</html>
EOF
}

# Create HTML viewers for text reports if they exist
if [ -f "reports/complexity/bundle-sizes.txt" ]; then
    create_html_viewer "reports/complexity/bundle-sizes.txt" "reports/complexity/bundle-sizes.html" "Bundle Size Analysis"
fi

if [ -f "reports/complexity/dependencies.txt" ]; then
    create_html_viewer "reports/complexity/dependencies.txt" "reports/complexity/dependencies.html" "Dependencies"
fi

if [ -f "reports/complexity/circular-deps.txt" ]; then
    create_html_viewer "reports/complexity/circular-deps.txt" "reports/complexity/circular-deps.html" "Circular Dependencies"
fi

if [ -f "reports/lint/typescript-diagnostics.txt" ]; then
    create_html_viewer "reports/lint/typescript-diagnostics.txt" "reports/lint/typescript-diagnostics.html" "TypeScript Diagnostics"
fi

echo "📄 Generated HTML viewers for text reports"