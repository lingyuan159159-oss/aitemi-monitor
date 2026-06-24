/**
 * Aitemi Monitor - 前端应用
 *
 * 从 data/latest.json 加载数据，渲染五个 Tab 的仪表盘。
 * 纯 Vanilla JS，无框架依赖。
 */

const App = (() => {
    // ===== 配置 =====
    const DATA_URL = 'data/latest.json';
    const CONFIG_URL = 'data/config.json';
    const PASSWORD_HASH = ''; // 由部署时设置（SHA-256）

    let _data = null;
    let _config = null;
    let _refreshTimer = null;
    let _charts = {};
    let _refreshInterval = parseInt(localStorage.getItem('refresh_interval') || '1800', 10);

    // ===== 工具函数 =====

    function _escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _badgeClass(sev) {
        const map = { HIGH: 'badge-high', MED: 'badge-med', LOW: 'badge-low', WARN: 'badge-warn' };
        return map[sev] || 'badge-warn';
    }

    function _sevLabel(sev) {
        const map = { HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告' };
        return map[sev] || sev || '未知';
    }

    function _areaClass(area) {
        if (!area) return '';
        if (area.includes('饭堂') || area.includes('航天')) return 'canteen';
        if (area.includes('商业')) return 'street';
        return '';
    }

    function _getThreshold(area, key) {
        // 优先从后端 latest.json 的完整 config 读取
        const source = (_data && _data.config) ? _data.config.thresholds : (_config ? _config.thresholds : {});
        if (!source) return 20;
        return (source[area] || source['_default'] || {})[key] || 20;
    }

    function _formatRelative(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return diff + '秒';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时';
        return Math.floor(diff / 86400) + '天';
    }

    function _emptyState(text) {
        return `<div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="#86868b" stroke-width="1.5"/>
                <path d="M14 20h12" stroke="#86868b" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <p>${_escapeHtml(text)}</p>
        </div>`;
    }

    // ===== 密码验证 =====

    async function _sha256(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function checkPassword() {
        const input = document.getElementById('gate-input').value;
        if (!input) return;
        if (!PASSWORD_HASH) { _enterApp(); return; }
        _sha256(input).then(hash => {
            if (hash === PASSWORD_HASH) {
                _enterApp();
            } else {
                const err = document.getElementById('gate-error');
                err.style.display = 'block';
                err.textContent = '密码错误';
            }
        });
    }

    function _enterApp() {
        document.getElementById('gate').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        _loadData();
        _startAutoRefresh();
    }

    // ===== 数据加载 =====

    async function _loadData() {
        try {
            const [dataResp, configResp] = await Promise.all([
                fetch(DATA_URL + '?t=' + Date.now()),
                fetch(CONFIG_URL),
            ]);

            if (dataResp.ok) {
                _data = await dataResp.json();
            } else {
                _showError('数据加载失败: HTTP ' + dataResp.status);
                _setStatus('error', '加载失败');
                return;
            }
            if (configResp.ok) {
                _config = await configResp.json();
            }

            // 从后端数据同步刷新间隔
            if (_data && _data.config && _data.config.fetch_interval) {
                // 只在用户没有手动设置过时才同步
                if (!localStorage.getItem('refresh_interval')) {
                    _refreshInterval = _data.config.fetch_interval;
                }
            }

            _hideError();
            _updateStatus();
            _renderCurrentTab();
        } catch (e) {
            console.error('加载失败:', e);
            _showError('网络连接失败，请检查网络后刷新页面');
            _setStatus('error', '连接失败');
        }
    }

    function _showError(msg) {
        const el = document.getElementById('data-error');
        const textEl = document.getElementById('data-error-text');
        if (el) {
            if (textEl) textEl.textContent = msg;
            el.style.display = 'flex';
        }
    }

    function _hideError() {
        const el = document.getElementById('data-error');
        if (el) el.style.display = 'none';
    }

    function _updateStatus() {
        if (!_data) {
            _setStatus('error', '无数据');
            return;
        }
        const valid = _data.session_valid;
        const updated = _data.updated_at;

        if (valid) {
            _setStatus('ok', '在线');
        } else {
            _setStatus('warn', 'Session 已过期');
        }

        const warn = document.getElementById('session-warning');
        warn.style.display = valid ? 'none' : 'flex';

        if (updated) {
            const d = new Date(updated);
            document.getElementById('last-update').textContent =
                _formatRelative(d) + ' 前更新';
        }
    }

    function _setStatus(type, text) {
        const badge = document.getElementById('status-badge');
        badge.className = 'status-badge ' + type;
        document.getElementById('status-text').textContent = text;
    }

    function refreshData() {
        _loadData();
    }

    // ===== 自动刷新 =====

    function _startAutoRefresh() {
        _stopAutoRefresh();
        if (_refreshInterval > 0) {
            _refreshTimer = setInterval(_loadData, _refreshInterval * 1000);
        }
    }

    function _stopAutoRefresh() {
        if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
    }

    // ===== Tab 切换 =====

    function switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
        document.getElementById('panel-' + tab).classList.add('active');
        _renderCurrentTab();
    }

    function _currentTab() {
        const active = document.querySelector('.tab.active');
        return active ? active.dataset.tab : 'overview';
    }

    function _renderCurrentTab() {
        if (!_data) return;
        switch (_currentTab()) {
            case 'overview': _renderOverview(); break;
            case 'anomalies': _renderAnomalies(); break;
            case 'riders': _renderRiders(); break;
            case 'skipscan': _renderSkipScan(); break;
            case 'competitor': _renderCompetitor(); break;
        }
    }

    // ===== 总览 Tab =====

    function _renderOverview() {
        const s = _data.summary || {};
        const metrics = document.getElementById('metrics-grid');
        metrics.innerHTML = [
            _metricCard('总订单', s.total_orders || 0, 'blue'),
            _metricCard('配送中', s.delivering || 0, 'green'),
            _metricCard('异常', s.anomaly_count || 0, s.anomaly_count > 0 ? 'red' : 'green'),
            _metricCard('跳扫码', s.skip_scan_count || 0, s.skip_scan_count > 0 ? 'orange' : 'green'),
            _metricCard('售后', s.aftersale || 0, 'orange'),
            _metricCard('已完成', s.completed || 0, 'green'),
        ].join('');

        _renderTrendChart();
        _renderDeliveringTable();
    }

    function _metricCard(label, value, color) {
        return `<div class="metric-card ${color}">
            <div class="metric-label">${_escapeHtml(label)}</div>
            <div class="metric-value">${_escapeHtml(String(value))}</div>
        </div>`;
    }

    function _renderTrendChart() {
        const anomalies = _data.anomalies || [];
        const byType = { '分拣超时': 0, '投餐超时': 0, '配送超时': 0, '压单': 0 };
        anomalies.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });

        const ctx = document.getElementById('chart-trend');
        if (!ctx) return;
        if (_charts.trend) _charts.trend.destroy();

        _charts.trend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['分拣超时', '投餐超时', '配送超时', '压单'],
                datasets: [{
                    label: '数量',
                    data: [byType['分拣超时'], byType['投餐超时'], byType['配送超时'], byType['压单']],
                    backgroundColor: ['#ff3b30', '#ff9500', '#ffcc00', '#8e8e93'],
                    borderRadius: 6,
                    borderSkipped: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f2f2f7' } },
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                },
            },
        });
    }

    function _renderDeliveringTable() {
        const anomalies = _data.anomalies || [];
        const container = document.getElementById('delivering-table');

        if (anomalies.length === 0) {
            container.innerHTML = _emptyState('当前没有异常');
            return;
        }

        const rows = anomalies.slice(0, 20).map(a => `
            <tr>
                <td><span class="badge ${_badgeClass(a.severity)}">${_sevLabel(a.severity)}</span></td>
                <td>${_escapeHtml(a.type)}</td>
                <td>${_escapeHtml(a.shop)}</td>
                <td><span class="area-tag ${_areaClass(a.area)}">${_escapeHtml(a.area)}</span></td>
                <td>${_escapeHtml(String(a.elapsed_min))}分钟</td>
                <td>${_escapeHtml(a.detail)}</td>
            </tr>
        `).join('');

        container.innerHTML = `<div class="table-scroll"><table class="data-table">
            <thead><tr>
                <th>严重度</th><th>类型</th><th>店铺</th><th>区域</th><th>耗时</th><th>详情</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;
    }

    // ===== 异常告警 Tab =====

    function _renderAnomalies() {
        const anomalies = _data.anomalies || [];
        const summary = document.getElementById('anomaly-summary');
        const groups = document.getElementById('anomaly-groups');

        const counts = { HIGH: 0, MED: 0, LOW: 0, WARN: 0 };
        anomalies.forEach(a => { counts[a.severity] = (counts[a.severity] || 0) + 1; });

        summary.innerHTML = [
            _summaryPill('严重', counts.HIGH, 'badge-high'),
            _summaryPill('中等', counts.MED, 'badge-med'),
            _summaryPill('轻微', counts.LOW, 'badge-low'),
            _summaryPill('警告', counts.WARN, 'badge-warn'),
        ].join('');

        const types = ['分拣超时', '投餐超时', '配送超时', '压单'];

        groups.innerHTML = types.map(type => {
            const items = anomalies.filter(a => a.type === type);
            if (items.length === 0) return '';

            const rows = items.map(a => `
                <tr>
                    <td><span class="badge ${_badgeClass(a.severity)}">${_sevLabel(a.severity)}</span></td>
                    <td>${_escapeHtml(a.oid)}</td>
                    <td>${_escapeHtml(a.shop)}</td>
                    <td><span class="area-tag ${_areaClass(a.area)}">${_escapeHtml(a.area)}</span></td>
                    <td>${_escapeHtml(String(a.elapsed_min))}分钟</td>
                    <td>${_escapeHtml(String(a.threshold || '--'))}分钟</td>
                    <td>${_escapeHtml(a.detail)}</td>
                </tr>
            `).join('');

            return `<div class="anomaly-group">
                <div class="anomaly-group-title">
                    ${_escapeHtml(type)}
                    <span class="anomaly-count">${items.length}</span>
                </div>
                <div class="table-scroll"><table class="data-table">
                    <thead><tr>
                        <th>严重度</th><th>订单号</th><th>店铺</th><th>区域</th>
                        <th>耗时</th><th>阈值</th><th>详情</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>
            </div>`;
        }).join('');

        if (anomalies.length === 0) {
            groups.innerHTML = _emptyState('暂无异常');
        }
    }

    function _summaryPill(label, count, cls) {
        if (count === 0) return '';
        return `<span class="badge ${cls}">${_escapeHtml(label)}: ${count}</span>`;
    }

    // ===== 骑手统计 Tab =====

    function _renderRiders() {
        const riders = _data.riders || [];
        const container = document.getElementById('rider-groups');

        if (riders.length === 0) {
            container.innerHTML = _emptyState('暂无骑手数据');
            _renderRiderChart([]);
            return;
        }

        const byArea = {};
        riders.forEach(r => {
            if (!byArea[r.area]) byArea[r.area] = [];
            byArea[r.area].push(r);
        });

        container.innerHTML = Object.entries(byArea).map(([area, list]) => {
            const cards = list.map(r => {
                const dims = [
                    { label: '分拣', data: r.sort, th: _getThreshold(area, 'sort') },
                    { label: '停留', data: r.stay, th: _getThreshold(area, 'stay') },
                    { label: '配送', data: r.deliver, th: _getThreshold(area, 'deliver') },
                ];
                return `<div class="rider-card">
                    <div class="rider-name">${_escapeHtml(r.name)}</div>
                    <div class="rider-dims">
                        ${dims.map(d => `<div class="rider-dim ${d.data.rate > 20 ? 'high' : ''}">
                            <div class="rider-dim-label">${_escapeHtml(d.label)}</div>
                            <div class="rider-dim-value">${_escapeHtml(String(d.data.rate))}%</div>
                            <div class="rider-dim-sub">${d.data.overtime}/${d.data.total} 超时 | 均${d.data.avg}分钟</div>
                        </div>`).join('')}
                    </div>
                </div>`;
            }).join('');

            return `<div class="rider-area-group">
                <div class="rider-area-title">${_escapeHtml(area)}</div>
                ${cards}
            </div>`;
        }).join('');

        _renderRiderChart(riders);
    }

    function _renderRiderChart(riders) {
        const ctx = document.getElementById('chart-riders');
        if (!ctx) return;
        if (_charts.riders) _charts.riders.destroy();

        const sorted = [...riders].sort((a, b) => {
            const ta = a.sort.total + a.stay.total + a.deliver.total;
            const tb = b.sort.total + b.stay.total + b.deliver.total;
            return tb - ta;
        }).slice(0, 10);

        _charts.riders = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(r => r.name),
                datasets: [
                    { label: '分拣超时率', data: sorted.map(r => r.sort.rate), backgroundColor: '#ff3b30', borderRadius: 4 },
                    { label: '停留超时率', data: sorted.map(r => r.stay.rate), backgroundColor: '#ff9500', borderRadius: 4 },
                    { label: '配送超时率', data: sorted.map(r => r.deliver.rate), backgroundColor: '#ffcc00', borderRadius: 4 },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', font: { size: 10 } }, grid: { color: '#f2f2f7' } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
                },
            },
        });
    }

    // ===== 跳扫码 Tab =====

    function _renderSkipScan() {
        const scans = _data.skip_scans || [];
        const riders = _data.skip_scan_riders || [];
        const threshold = (_data.config || {}).skip_scan_threshold || 60;

        const summaryEl = document.getElementById('skip-rider-summary');
        if (riders.length > 0) {
            summaryEl.innerHTML = `<div class="skip-rider-cards">
                ${riders.map(r => `<div class="skip-rider-card ${r.high_risk ? 'high-risk' : ''}">
                    <div class="skip-rider-name">${_escapeHtml(r.name)}</div>
                    <div class="skip-rider-count">${r.count}</div>
                    <div class="metric-sub">${r.high_risk ? '高风险' : '次疑似'}</div>
                </div>`).join('')}
            </div>`;
        } else {
            summaryEl.innerHTML = '';
        }

        const detailEl = document.getElementById('skip-detail-table');
        if (scans.length === 0) {
            detailEl.innerHTML = _emptyState('暂无跳扫码记录');
            return;
        }

        const rows = scans.map(s => `
            <tr>
                <td><span class="badge ${_badgeClass(s.severity)}">${_sevLabel(s.severity)}</span></td>
                <td>${_escapeHtml(s.rider)}</td>
                <td>${_escapeHtml(s.oid)}</td>
                <td>${_escapeHtml(s.shop)}</td>
                <td>${_escapeHtml(s.place_time)}</td>
                <td>${_escapeHtml(s.deliver_time)}</td>
                <td><strong>${_escapeHtml(String(s.gap_seconds))}秒</strong></td>
            </tr>
        `).join('');

        detailEl.innerHTML = `<div class="table-section">
            <h3>全部记录（阈值: ${threshold}秒）</h3>
            <div class="table-scroll"><table class="data-table">
                <thead><tr>
                    <th>严重度</th><th>骑手</th><th>订单号</th><th>店铺</th>
                    <th>投餐时间</th><th>送达时间</th><th>间隔</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
        </div>`;
    }

    // ===== 竞品监控 Tab =====

    function _renderCompetitor() {
        const comp = _data.competitor;
        if (!comp || !comp.stores) {
            document.getElementById('competitor-metrics').innerHTML = _emptyState('暂无竞品数据');
            return;
        }

        document.getElementById('competitor-date').textContent = '数据日期: ' + (comp.date || '--');

        const metrics = document.getElementById('competitor-metrics');
        metrics.innerHTML = [
            _metricCard('当日销量', comp.total_daily || 0, 'blue'),
            _metricCard('累计销量', comp.total_cumul || 0, 'green'),
            _metricCard('活跃店铺', comp.active_stores || 0, 'green'),
            _metricCard('总店铺数', comp.total_stores || 0, ''),
        ].join('');

        const stores = comp.stores || [];
        const top15 = stores.slice(0, 15);

        const ctx = document.getElementById('chart-competitor');
        if (ctx) {
            if (_charts.competitor) _charts.competitor.destroy();
            _charts.competitor = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top15.map(s => s.name.length > 8 ? s.name.slice(0, 8) + '...' : s.name),
                    datasets: [{
                        label: '当日销量',
                        data: top15.map(s => s.daily),
                        backgroundColor: '#0071e3',
                        borderRadius: 6,
                        borderSkipped: false,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, grid: { color: '#f2f2f7' }, ticks: { font: { size: 10 } } },
                        y: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    },
                },
            });
        }

        const tableEl = document.getElementById('competitor-table');
        const rows = stores.map((s, i) => `
            <tr ${s.daily === 0 ? 'style="opacity:0.5"' : ''}>
                <td>${i + 1}</td>
                <td>${_escapeHtml(s.name)}</td>
                <td><strong>${s.daily}</strong></td>
                <td>${s.total}</td>
                <td>${s.yesterday_total}</td>
                <td>${_escapeHtml(String(s.score || '--'))}</td>
            </tr>
        `).join('');

        tableEl.innerHTML = `<div class="table-scroll"><table class="data-table">
            <thead><tr>
                <th>#</th><th>店铺</th><th>当日</th><th>累计</th><th>昨日累计</th><th>评分</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;
    }

    // ===== 设置 =====

    function openSettings() {
        document.getElementById('settings-modal').style.display = 'flex';
        document.getElementById('setting-interval').value = String(_refreshInterval);
    }

    function closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    function updateInterval() {
        _refreshInterval = parseInt(document.getElementById('setting-interval').value, 10);
        localStorage.setItem('refresh_interval', String(_refreshInterval));
        _startAutoRefresh();
    }

    // ===== 初始化 =====

    document.getElementById('gate-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkPassword();
    });

    if (!PASSWORD_HASH) {
        document.getElementById('gate').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        _loadData();
        _startAutoRefresh();
    }

    return { checkPassword, refreshData, switchTab, openSettings, closeSettings, updateInterval };
})();
