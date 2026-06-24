# Aitemi Monitor

艾特米外卖系统监控仪表盘。

零成本部署：GitHub Actions 定时采集数据 + GitHub Pages 展示。

## 功能

- **总览**：订单统计卡片 + 异常分布图 + 配送中订单列表
- **异常告警**：分拣超时、投餐超时、配送超时、压单检测
- **骑手统计**：按区域分组，超时率、平均耗时
- **跳扫码检测**：投餐到送达间隔 < 60 秒
- **竞品监控**：一技生活圈店铺销量排名

## 部署步骤

### 1. 创建 GitHub 仓库

在 GitHub 上创建一个新仓库。

> **必须设为公开仓库**（Public）。免费账户的私有仓库无法启用 GitHub Pages。公开仓库的 GitHub Actions 不限分钟数。

### 2. 推送代码

```bash
cd aitemi-monitor
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/aitemi-monitor.git
git push -u origin main
```

### 3. 配置 Secrets

进入仓库 Settings > Secrets and variables > Actions，添加：

| Secret 名 | 值 |
|-----------|-----|
| `AITEMI_PHPSESSID` | 艾特米后台的 PHPSESSID cookie |
| `AITEMI_ADMINSESSION` | 艾特米后台的 adminsession cookie |
| `COMPETITOR_SESSION` | 一技生活圈的 PHPSESSID |

**获取 cookie 的方法：**

1. 用浏览器登录艾特米后台
2. 按 F12 打开开发者工具
3. 点击顶部的「Application」（应用程序）标签
4. 左侧找到「Cookies」，点击后台网址
5. 找到 `PHPSESSID` 和 `adminsession`，分别复制它们的 Value 值

### 4. 开启 GitHub Pages

Settings > Pages > Source 选 `main` 分支 > 保存。

等待 1-2 分钟，访问 `https://你的用户名.github.io/aitemi-monitor/`

### 5. 手动触发首次采集

Actions > Collect Aitemi Data > Run workflow > 点击绿色按钮。

首次采集完成后页面才能正常显示数据。

### 6. 设置密码（可选）

编辑 `app.js`，把 `PASSWORD_HASH` 设为你密码的 SHA-256 值：

```bash
echo -n "你的密码" | shasum -a 256
```

把输出的哈希值粘贴到 `app.js` 的 `PASSWORD_HASH` 变量里。

## Session 保活

- GitHub Actions 每 30 分钟自动采集 = 自动保活
- 正常情况下不需要手动更新 cookie
- 如果网页显示「Session 已过期」，重新获取 cookie 更新到 Secrets

## 本地测试

```bash
# 先采集数据（需要设置环境变量）
export AITEMI_PHPSESSID="你的值"
export AITEMI_ADMINSESSION="你的值"
export COMPETITOR_SESSION="你的值"
pip install requests
python scripts/collect_all.py

# 启动本地服务器查看页面
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 文件结构

```
├── .github/workflows/collect.yml   定时采集任务
├── scripts/
│   ├── collect_all.py              主入口
│   ├── aitemi_api.py               艾特米 API 交互
│   ├── detectors.py                异常检测 + 跳扫码 + 骑手统计
│   └── competitor.py               竞品数据采集
├── data/
│   ├── config.json                 配置（阈值、店铺映射）
│   ├── latest.json                 最新数据（自动生成）
│   └── status.json                 运行状态
├── index.html                      页面
├── style.css                       样式
└── app.js                          前端逻辑
```

## 自定义配置

编辑 `data/config.json` 可以调整：

- **阈值**：各区域的分拣/停留/配送超时阈值（分钟）
- **跳扫码阈值**：投餐到送达间隔判定（秒，默认 60）
- **压单阈值**：分拣到投餐间隔判定（分钟，默认 30）
- **排除店铺**：不参与检测的店铺
- **自配送店铺**：跳过配送超时检测的店铺
- **抓取频率**：`fetch_interval`（秒，默认 1800 = 30 分钟）
