#!/bin/bash
set -e
REPO="/Users/lijiang/Claude/aitemi-monitor"
export GIT_DIR="$REPO/.git"
export GIT_WORK_TREE="$REPO"
export CI=true DEBIAN_FRONTEND=noninteractive GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never HOMEBREW_NO_AUTO_UPDATE=1 GIT_EDITOR=: EDITOR=: VISUAL='' GIT_SEQUENCE_EDITOR=: GIT_MERGE_AUTOEDIT=no GIT_PAGER=cat PAGER=cat npm_config_yes=true PIP_NO_INPUT=1 YARN_ENABLE_IMMUTABLE_INSTALLS=false

echo "=== Step 1: git status ==="
git status
echo ""
echo "=== Step 1: git diff --stat ==="
git diff --stat
echo ""
echo "=== Step 2: git log --oneline -5 ==="
git log --oneline -5
