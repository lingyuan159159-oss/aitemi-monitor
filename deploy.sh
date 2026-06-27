#!/bin/bash
set -e
cd ~/Claude/aitemi-monitor

echo "=== 1. Git Status ==="
git status --short

echo ""
echo "=== 2. Stage Changes ==="
git add scripts/intelligence.py scripts/collect_all.py scripts/notify.py scripts/competitor.py tests/ frontend/src/ frontend/src/index.css

echo ""
echo "=== 3. Commit ==="
git commit -m "$(cat <<'EOF'
refactor: ponytail 精简 + cami-design UI 审计改进

后端（-206行）:
- 合并 ai_report + ai_insight → intelligence.py
- collect_all.py 内联7个单次函数，health_score 简化
- notify.py 删除5个死缓存函数，中等异常改为立即推送
- competitor.py 删除 requests 兼容层，统一用 urllib
- 新增 tests/ 目录（35个单元测试）

前端（cami-design 16条改进）:
- A1-A3: 健康分环形图+连续色阶+等级标签
- B2: 柱状图分段间距
- C1: 骨架屏替换旋转加载
- C3: 错误Alert加重试按钮
- D1-D3: 指标卡百分比diff+宽列+icon背景加深
- E1: Tab切换淡入动画
- E2: 刷新成功toast反馈
- F1: 更新时间改为tooltip
- F2: 底部tab从5减到4

Co-Authored-By: claude-sonnet-4-6[1m] <noreply@anthropic.com>
EOF
)"

echo ""
echo "=== 4. Push to GitHub ==="
git push origin main

echo ""
echo "=== 5. Deploy Frontend to Server ==="
scp -r frontend/dist/* ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/frontend-dist/ 2>/dev/null || \
sshpass -p "$(cat ~/.ssh/aitemi_pass 2>/dev/null || echo '')" scp -r frontend/dist/* ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/frontend-dist/

echo ""
echo "=== 6. Deploy Backend Scripts to Server ==="
scp scripts/intelligence.py scripts/collect_all.py scripts/notify.py scripts/competitor.py ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/scripts/ 2>/dev/null || \
sshpass -p "$(cat ~/.ssh/aitemi_pass 2>/dev/null || echo '')" scp scripts/intelligence.py scripts/collect_all.py scripts/notify.py scripts/competitor.py ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/scripts/

echo ""
echo "=== Done! ==="
