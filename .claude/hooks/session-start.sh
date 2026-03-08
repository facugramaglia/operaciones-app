#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== Operaciones App — Session Start ==="
echo ""

# Project info
echo "📁 Project files:"
wc -l /home/user/operaciones-app/index.html /home/user/operaciones-app/Code.gs 2>/dev/null || true
echo ""

# Git status
echo "🌿 Branch: $(git -C "${CLAUDE_PROJECT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
echo "📝 Last commit: $(git -C "${CLAUDE_PROJECT_DIR}" log -1 --oneline 2>/dev/null || echo 'none')"
echo ""

# Validate HTML is parseable
echo "🔍 Checking index.html syntax..."
python3 -c "
import html.parser, sys
class Validator(html.parser.HTMLParser):
    def handle_error(self, message):
        print('Warning:', message)

with open('${CLAUDE_PROJECT_DIR}/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

parser = Validator()
parser.feed(content)
print('index.html: OK')
"

echo ""
echo "✅ Session ready. No dependencies to install (Google Apps Script project)."
echo "   To deploy backend changes, use Google Apps Script Editor."
