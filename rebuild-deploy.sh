#!/bin/bash
set -e
cd ~/Claude/aitemi-monitor/frontend
npm run build
sshpass -p 'lingyuan@1314' scp -r dist/* ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/frontend-dist/
echo "=== Frontend deployed ==="
