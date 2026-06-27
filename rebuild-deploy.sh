#!/bin/bash
set -e

if [ -z "$DEPLOY_SSH_PASSWORD" ]; then
  echo "ERROR: 请设置 DEPLOY_SSH_PASSWORD 环境变量"
  exit 1
fi

cd ~/Claude/aitemi-monitor/frontend
npm run build
sshpass -p "$DEPLOY_SSH_PASSWORD" scp -r dist/* ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/frontend-dist/
echo "=== Frontend deployed ==="
