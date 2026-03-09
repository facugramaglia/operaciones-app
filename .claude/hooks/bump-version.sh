#!/bin/bash
# PostToolUse hook: bumps APP_VERSION in index.html whenever
# index.html or Code.gs is edited via Edit or Write tools.
set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_name', ''))
")

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null || echo "")

# Only act on Edit or Write tool calls
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# Only act on frontend or backend files
if [[ "$BASENAME" != "index.html" && "$BASENAME" != "Code.gs" ]]; then
  exit 0
fi

INDEX_HTML="${CLAUDE_PROJECT_DIR}/index.html"
if [ ! -f "$INDEX_HTML" ]; then
  exit 0
fi

python3 << 'PYEOF'
import re, os, sys

index_path = os.environ['CLAUDE_PROJECT_DIR'] + '/index.html'

with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

def bump(m):
    major = int(m.group(1))
    minor = int(m.group(2))
    return f"const APP_VERSION = 'v{major}.{minor + 1}'"

new_content = re.sub(
    r"const APP_VERSION = 'v(\d+)\.(\d+)'",
    bump,
    content
)

if new_content == content:
    sys.exit(0)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

m = re.search(r"const APP_VERSION = '(v[\d.]+)'", new_content)
if m:
    print(f"🔖 Version bumped to {m.group(1)}", flush=True)
PYEOF
