#!/usr/bin/env bash
# Manual security audit script for TokenForGood sandbox.
# Runs the real Claude Code binary inside the sandbox to verify isolation.
# NOT for CI — requires Docker, Claude Code installed, and a real GitHub token.
#
# Usage:
#   GITHUB_TOKEN=ghp_... ./scripts/security-audit.sh <task-id>

set -euo pipefail

TASK_ID="${1:?Usage: security-audit.sh <task-id>}"
GITHUB_TOKEN="${GITHUB_TOKEN:?Set GITHUB_TOKEN environment variable}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_DIR="$(dirname "${SCRIPT_DIR}")"

echo "=== TokenForGood Security Audit ==="
echo "Task: ${TASK_ID}"
echo "Date: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

# Check prerequisites
echo "--- Prerequisites ---"

if ! command -v docker &>/dev/null; then
  echo "FAIL: Docker not installed"
  exit 1
fi
echo "OK: Docker installed ($(docker --version))"

if ! docker info &>/dev/null; then
  echo "FAIL: Docker daemon not running"
  exit 1
fi
echo "OK: Docker daemon running"

CLAUDE_PATH="$(which claude 2>/dev/null || echo "")"
if [ -z "${CLAUDE_PATH}" ]; then
  echo "FAIL: Claude Code binary not found"
  exit 1
fi
echo "OK: Claude Code at ${CLAUDE_PATH}"
echo ""

# Run the sandbox with real Claude Code
echo "--- Running Sandbox ---"
echo "Starting sandboxed task with real Claude Code..."
echo "Monitor with: docker logs -f \$(docker ps -q --filter name=tfg-)"
echo ""

cd "${CLI_DIR}"
node dist/index.js run "${TASK_ID}" \
  --github-token "${GITHUB_TOKEN}" \
  --verbose

AUDIT_EXIT=$?

echo ""
echo "--- Audit Results ---"
if [ ${AUDIT_EXIT} -eq 0 ]; then
  echo "PASS: Sandbox completed successfully"
else
  echo "FAIL: Sandbox exited with code ${AUDIT_EXIT}"
fi

# Check for execution log
if [ -f "execution.jsonl" ]; then
  LINES=$(wc -l < execution.jsonl)
  SIZE=$(du -h execution.jsonl | cut -f1)
  echo "OK: Execution log exported (${LINES} entries, ${SIZE})"
else
  echo "WARNING: No execution log found"
fi

echo ""
echo "=== Audit Complete ==="
exit ${AUDIT_EXIT}
