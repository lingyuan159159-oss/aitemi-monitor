/**
 * 艾特米监控平台 - 前端应用 (完整重写)
 */
const App = (() => {
    const DATA_URL = 'data/latest.json';
    const CONFIG_URL = 'data/config.json';
    const HISTORY_URL = 'data/history.json';
    const PASSWORD_HASH = '';

    let _data = null, _config = null, _history = null;
    let _refreshTimer = null, _charts = {};
    let _refreshInterval = parseInt(localStorage.getItem('refresh_interval') || '300', 10);
    let _prevSummary = null;
    let _toastTimer = null;

    // ===== 工具函数 =====
    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function badgeCls(sev) {
        return { HIGH: 'badge-high', MED: 'badge-med', LOW: 'badge-low', WARN: 'badge-warn' }[sev] || 'badge-warn';
    }

    function sevLabel(sev) {
        return { HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告' }[sev] || sev || '未知';
    }

    function areaCls(a) {
        if (!a) return '';
        if (a.includes('饭堂') || a.includes('航天')) return 'canteen';
        if (a.includes('商业')) return 'street';
        return '';
    }

    function _toMs(ts) {
        if (!ts) return 0;
        let s = String(ts);
        if (s.length === 16) s += ':00';
        if (!s.includes('+') && !s.includes('Z')) s += '+08:00';
        return new Date(s).getTime();
    }

    function fmtRel(ts) {
        const ms = _toMs(ts);
        if (!ms) return '--';
        const s = Math.floor((Date.now() - ms) / 1000);
        if (s < 0) return '刚刚';
        if (s < 60) return s + '秒';
        if (s < 3600) return Math.floor(s / 60) + '分钟';
        if (s < 86400) return Math.floor(s / 3600) + '小时';
        return Math.floor(s / 86400) + '天';
    }

    function fmtTime(ts) {
        if (!ts) return '--';
        try {
            const d = new Date(_toMs(ts));
            return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
                d.getHours().toString().padStart(2, '0') + ':' +
                d.getMinutes().toString().padStart(2, '0');
        } catch (e) { return ts; }
    }

    function fmtFullTime(ts) {
        if (!ts) return '--';
        try {
            const d = new Date(_toMs(ts));
            return d.getFullYear() + '-' +
                (d.getMonth() + 1).toString().padStart(2, '0') + '-' +
                d.getDate().toString().padStart(2, '0') + ' ' +
                d.getHours().toString().padStart(2, '0') + ':' +
                d.getMinutes().toString().padStart(2, '0') + ':' +
                d.getSeconds().toString().padStart(2, '0');
        } catch (e) { return ts; }
    }

    function empty(t) {
        return '<div class="empty-state">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" fill="none">' +
            '<rect x="6" y="8" width="28" height="24" rx="3" stroke="#86868b" stroke-width="1.5" fill="none"/>' +
            '<line x1="12" y1="16" x2="28" y2="16" stroke="#86868b" stroke-width="1.5" stroke-linecap="round"/>' +
            '<line x1="12" y1="22" x2="22" y2="22" stroke="#86868b" stroke-width="1.5" stroke-linecap="round"/>' +
            '<line x1="12" y1="28" x2="18" y2="28" stroke="#86868b" stroke-width="1.5" stroke-linecap="round"/>' +
            '</svg><p>' + esc(t) + '</p></div>';
    }

    function chartEmpty(t) {
        return '<div class="chart-empty">' +
            '<svg width="32" height="32" viewBox="0 0 32 32" fill="none">' +
            '<rect x="4" y="14" width="6" height="14" rx="1.5" stroke="#aeaeb2" stroke-width="1.2"/>' +
            '<rect x="13" y="8" width="6" height="20" rx="1.5" stroke="#aeaeb2" stroke-width="1.2"/>' +
            '<rect x="22" y="4" width="6" height="24" rx="1.5" stroke="#aeaeb2" stroke-width="1.2"/>' +
            '</svg><p>' + esc(t) + '</p></div>';
    }

    function trendArrow(cur, prev) {
        if (prev == null || prev === cur) return '';
        const d = cur - prev;
        if (d > 0) return '<span class="metric-trend up">+' + d + '</span>';
        return '<span class="metric-trend down">' + d + '</span>';
    }

    // ===== Toast =====
    function _showToast(msg) {
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        if (_toastTimer) clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => { t.classList.remove('show'); }, 2500);
    }

    // ===== 登录 =====
    async function sha256(s) {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }

    function checkPassword() {
        const v = document.getElementById('gate-input').value;
        if (!v) return;
        if (!PASSWORD_HASH) {
            _saveLogin(v);
            _enter();
            return;
        }
        sha256(v).then(h => {
            if (h === PASSWORD_HASH) {
                _saveLogin(v);
                _enter();
            } else {
                const e = document.getElementById('gate-error');
                e.style.display = 'block';
                e.textContent = '密码错误';
            }
        });
    }

    function _saveLogin(pwd) {
        sha256(pwd).then(h => {
            localStorage.setItem('aitemi_auth', h);
        });
    }

    function _checkSavedLogin() {
        if (!PASSWORD_HASH) return true;
        const saved = localStorage.getItem('aitemi_auth');
        return saved === PASSWORD_HASH;
    }

    function _enter() {
        document.getElementById('gate').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        _loadAll();
        _startRefresh();
    }

    // ===== 数据加载 =====
    async function _loadAll() {
        try {
            const [dr, cr] = await Promise.all([
                fetch(DATA_URL + '?t=' + Date.now()),
                fetch(CONFIG_URL)
            ]);
            if (dr.ok) _data = await dr.json();
            else { _showErr('数据加载失败'); _setStatus('error', '加载失败'); return; }
            if (cr.ok) _config = await cr.json();
            if (_data?.config?.fetch_interval && !localStorage.getItem('refresh_interval')) {
                _refreshInterval = _data.config.fetch_interval;
            }
            _hideErr();
            _updateStatus();
            _render();
        } catch (e) {
            console.error(e);
            _showErr('网络连接失败');
            _setStatus('error', '连接失败');
        }
        fetch(HISTORY_URL + '?t=' + Date.now())
            .then(r => r.ok ? r.json() : [])
            .then(h => { _history = Array.isArray(h) ? h : []; _render(); })
            .catch(() => { _history = []; });
    }

    function _showErr(m) {
        const e = document.getElementById('data-error');
        const t = document.getElementById('data-error-text');
        if (e) { if (t) t.textContent = m; e.style.display = 'flex'; }
    }

    function _hideErr() {
        const e = document.getElementById('data-error');
        if (e) e.style.display = 'none';
    }

    function _updateStatus() {
        if (!_data) { _setStatus('error', '无数据'); return; }
        const ok = _data.session_valid;
        _setStatus(ok ? 'ok' : 'warn', ok ? '在线' : 'Session 已过期');
        const em = document.getElementById('session-expired-modal');
        if (em) em.style.display = ok ? 'none' : 'flex';
        if (_data.updated_at) {
            document.getElementById('last-update').textContent = fmtRel(_data.updated_at) + '前更新';
        }
    }

    function _setStatus(t, s) {
        document.getElementById('status-badge').className = 'status-badge ' + t;
        document.getElementById('status-text').textContent = s;
    }

    function refreshData() {
        _showToast('正在采集...');
        fetch('/api/collect').then(r => r.json()).then(d => {
            if (d.status === 'ok') {
                _showToast('采集完成，正在刷新数据');
                setTimeout(_loadAll, 1000);
            } else {
                _showToast('采集失败，刷新页面数据');
                _loadAll();
            }
        }).catch(() => {
            _showToast('API 不可用，刷新页面数据');
            _loadAll();
        });
    }

    function _startRefresh() {
        _stopRefresh();
        if (_refreshInterval > 0) _refreshTimer = setInterval(_loadAll, _refreshInterval * 1000);
    }

    function _stopRefresh() {
        if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
    }

    // ===== Tab =====
    function switchTab(t) {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelector('.tab[data-tab="' + t + '"]').classList.add('active');
        document.getElementById('panel-' + t).classList.add('active');
        _render();
    }

    function _curTab() {
        const a = document.querySelector('.tab.active');
        return a ? a.dataset.tab : 'overview';
    }

    function _render() {
        if (!_data) return;
        switch (_curTab()) {
            case 'overview': _renderOverview(); break;
            case 'anomalies': _renderAnomalies(); break;
            case 'riders': _renderRiders(); break;
            case 'skipscan': _renderSkipScan(); break;
            case 'competitor': _renderCompetitor(); break;
            case 'history': _renderHistory(); break;
        }
    }

    // ===== 总览 =====
    function _renderOverview() {
        const s = _data.summary || {}, p = _prevSummary;
        const mg = document.getElementById('metrics-grid');
        mg.innerHTML = [
            _mCard('总订单', s.total_orders || 0, 'blue', p ? p.total_orders : null),
            _mCard('配送中', s.delivering || 0, 'green', p ? p.delivering : null, 'delivering'),
            _mCard('异常', s.anomaly_count || 0, s.anomaly_count > 0 ? 'red' : 'green', p ? p.anomaly_count : null, 'anomalies'),
            _mCard('跳扫码', s.skip_scan_count || 0, s.skip_scan_count > 0 ? 'orange' : 'green', p ? p.skip_scan_count : null, 'skipscans'),
            _mCard('售后', s.aftersale || 0, 'orange', null, 'aftersale'),
            _mCard('已完成', s.completed || 0, 'green', null, 'completed'),
        ].join('');

        // 采集时间总结
        var ci = document.getElementById('collect-info');
        if (ci && _data.updated_at) {
            var upd = new Date(_toMs(_data.updated_at));
            var nxt = new Date(upd.getTime() + 5 * 60000);
            var fmt = function(d) {
                return (d.getMonth()+1) + '/' + d.getDate() + ' ' +
                    d.getHours().toString().padStart(2,'0') + ':' +
                    d.getMinutes().toString().padStart(2,'0');
            };
            ci.innerHTML =
                '<span><span class="dot green"></span>本次采集: ' + fmt(upd) + '</span>' +
                '<span><span class="dot blue"></span>下次采集: ' + fmt(nxt) + '</span>';
        }

        _prevSummary = { ...s };
        _renderTrendCharts();
        _renderDistChart();
        _renderDeliveringTable();
    }

    function _mCard(l, v, c, prev, clickType) {
        const cls = clickType ? 'clickable' : '';
        const onclick = clickType ? ' onclick="App.showOrders(\'' + clickType + '\')"' : '';
        const icons = {
            '总订单': '<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
            '配送中': '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/><polyline points="8,4 8,8 11,10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            '异常': '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2L1 14h14L8 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.6" fill="currentColor"/></svg>',
            '跳扫码': '<svg viewBox="0 0 16 16" fill="none"><path d="M2 12L6 4 10 9 14 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            '售后': '<svg viewBox="0 0 16 16" fill="none"><path d="M8 3C4.7 3 2 5.2 2 8c0 1.7 1 3.2 2.5 4M8 3c3.3 0 6 2.2 6 5 0 1.7-1 3.2-2.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6 13h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
            '已完成': '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/><polyline points="5.5,8 7.5,10 10.5,6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        };
        const icon = icons[l] || '';
        return '<div class="metric-card ' + c + ' ' + cls + '"' + onclick + '>' +
            (icon ? '<div class="metric-icon ' + c + '">' + icon + '</div>' : '') +
            '<div class="metric-label">' + esc(l) + '</div>' +
            '<div class="metric-value">' + v + '</div>' +
            '<div class="metric-sub">' + trendArrow(v, prev) + '</div></div>';
    }

    // ===== 趋势图 =====
    function _renderTrendCharts() {
        const oc = document.getElementById('chart-orders-trend');
        const ac = document.getElementById('chart-anomaly-trend');
        if (!oc || !ac) return;

        if (!_history || _history.length < 2) {
            // 不替换 canvas，只在 canvas 上方显示提示
            if (!oc.parentElement.querySelector('.chart-empty-overlay')) {
                oc.insertAdjacentHTML('afterend', '<div class="chart-empty-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#aeaeb2;font-size:13px;pointer-events:none;">暂无历史数据，等待采集...</div>');
                oc.parentElement.style.position = 'relative';
            }
            if (!ac.parentElement.querySelector('.chart-empty-overlay')) {
                ac.insertAdjacentHTML('afterend', '<div class="chart-empty-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#aeaeb2;font-size:13px;pointer-events:none;">暂无历史数据，等待采集...</div>');
                ac.parentElement.style.position = 'relative';
            }
            return;
        }

        // 有数据了，移除空状态提示
        document.querySelectorAll('.chart-empty-overlay').forEach(el => el.remove());

        const labels = _history.map(h => {
            const d = new Date(h.time);
            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        });
        _lineChart('chart-orders-trend', 'ot', labels, [
            { label: '总订单', data: _history.map(h => h.orders), color: '#0071e3' },
            { label: '配送中', data: _history.map(h => h.delivering), color: '#34c759' }
        ]);
        _lineChart('chart-anomaly-trend', 'at', labels, [
            { label: '异常', data: _history.map(h => h.anomalies || 0), color: '#ff3b30' },
            { label: '跳扫码', data: _history.map(h => h.skip_scans || 0), color: '#ff9500' }
        ]);
    }

    function _lineChart(id, key, labels, datasets) {
        const ctx = document.getElementById(id);
        if (!ctx) return;
        if (_charts[key]) _charts[key].destroy();
        const c = ctx.getContext('2d');
        _charts[key] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets.map(d => {
                    const grad = c.createLinearGradient(0, 0, 0, ctx.parentElement.clientHeight || 220);
                    grad.addColorStop(0, d.color + '30');
                    grad.addColorStop(1, d.color + '02');
                    return {
                        label: d.label, data: d.data, borderColor: d.color,
                        backgroundColor: grad, borderWidth: 2,
                        pointRadius: 0, pointHoverRadius: 4, fill: true, tension: .35
                    };
                })
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: datasets.length > 1, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f2f2f7' }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 8, maxRotation: 0 } }
                }
            }
        });
    }

    // ===== 分布图 =====
    function _renderDistChart() {
        const a = _data.anomalies || [];
        const ctx = document.getElementById('chart-dist');
        if (!ctx) return;
        if (_charts.dist) _charts.dist.destroy();
        if (!a.length) {
            ctx.parentElement.innerHTML = '<div class="chart-wrap">' + chartEmpty('暂无异常数据') + '</div>';
            return;
        }
        const by = { '分拣超时': 0, '投餐超时': 0, '配送超时': 0, '压单': 0 };
        a.forEach(x => { by[x.type] = (by[x.type] || 0) + 1; });
        _charts.dist = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['分拣超时', '投餐超时', '配送超时', '压单'],
                datasets: [{
                    label: '数量',
                    data: [by['分拣超时'], by['投餐超时'], by['配送超时'], by['压单']],
                    backgroundColor: ['#ff3b30', '#ff9500', '#ffcc00', '#8e8e93'],
                    borderRadius: 6, borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f2f2f7' } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                }
            }
        });
    }

    // ===== 当前异常表格 =====
    function _renderDeliveringTable() {
        const a = _data.anomalies || [];
        const c = document.getElementById('delivering-table');
        if (!a.length) { c.innerHTML = empty('当前没有异常'); return; }
        c.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr>' +
            '<th>严重度</th><th>配送单号</th><th>订单号</th><th>店名</th><th>耗时</th><th>骑手</th><th>弹簧指标</th><th>详情</th>' +
            '</tr></thead><tbody>' +
            a.slice(0, 20).map((x, i) => {
                return '<tr class="clickable" data-idx="' + i + '" data-src="anomalies">' +
                    '<td><span class="badge ' + badgeCls(x.severity) + '">' + sevLabel(x.severity) + '</span></td>' +
                    '<td><strong>' + esc(String(x.delivery_seq || '--')) + '</strong></td>' +
                    '<td>' + esc(x.oid) + '</td>' +
                    '<td><strong>' + esc(x.shop || '--') + '</strong></td>' +
                    '<td>' + esc(String(x.elapsed_min)) + '分钟</td>' +
                    '<td>' + esc(x.rider || '--') + '</td>' +
                    '<td><span class="spring-data"><strong>基线' + esc(String(x.baseline || '--')) + '</strong> 斜率' + (x.slope != null ? (x.slope >= 0 ? '+' : '') + esc(String(x.slope)) : '--') + '</span></td>' +
                    '<td>' +
                    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="#86868b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                    '</td></tr>';
            }).join('') +
            '</tbody></table></div>';
        c.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => _showDetailFromRow(tr)));
    }

    // ===== 订单详情弹窗 (底部抽屉) =====
    function _showDetailFromRow(tr) {
        const idx = parseInt(tr.dataset.idx);
        const src = tr.dataset.src;
        const list = _data[src] || [];
        const item = list[idx];
        if (!item) return;
        _openDetailModal(item, src === 'skip_scans' ? '跳扫码' : '异常');
    }

    function _openDetailModal(item, cat) {
        const title = document.getElementById('order-modal-title');
        const content = document.getElementById('order-modal-content');
        title.textContent = cat + '详情';

        const stages = [];
        if (item.sort_min != null) stages.push({ label: '分拣', value: item.sort_min });
        if (item.stay_min != null) stages.push({ label: '投餐', value: item.stay_min });
        if (item.deliver_min != null) stages.push({ label: '送达', value: item.deliver_min });

        let html = '';

        // 基本信息
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">订单信息</div>';
        html += _detailRow('订单号', item.oid || '--');
        html += _detailRow('店铺', item.shop || '--');
        html += _detailRow('所属饭堂', area || '--');
        if (item.order_time) html += _detailRow('下单时间', fmtFullTime(item.order_time));
        if (item.expect_time) html += _detailRow('期望送达', fmtFullTime(item.expect_time));
        html += '</div>';

        // 配送信息
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">配送信息</div>';
        html += _detailRow('骑手', item.rider || '--');
        html += _detailRow('配送号', item.delivery_no || item.dorm || '--');
        html += _detailRow('耗时', item.elapsed_min != null ? item.elapsed_min + '分钟' : (item.gap_seconds != null ? item.gap_seconds + '秒' : '--'));
        html += _detailRow('阈值', item.threshold != null ? item.threshold + (item.elapsed_min != null ? '分钟' : '秒') : '--');
        html += _detailRow('严重度', '<span class="badge ' + badgeCls(item.severity) + '">' + sevLabel(item.severity) + '</span>');
        html += '</div>';

        // 各阶段耗时
        if (stages.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">各阶段耗时</div>';
            html += '<div class="detail-stages">';
            stages.forEach(st => {
                const isOver = st.value > 10;
                html += '<div class="detail-stage">' +
                    '<div class="detail-stage-label">' + esc(st.label) + '</div>' +
                    '<div class="detail-stage-value' + (isOver ? ' over' : '') + '">' + esc(String(st.value)) + '分</div>' +
                    '</div>';
            });
            html += '</div></div>';
        }

        // 弹簧数据
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">弹簧数据</div>';
        html += _detailRow('基线值', item.baseline != null ? item.baseline + '分钟' : '--');
        html += _detailRow('趋势斜率', item.slope != null ? (item.slope >= 0 ? '+' : '') + item.slope : '--');
        if (item.severity_reason) {
            html += '</div>';
            html += '<div class="detail-reason">' + esc(item.severity_reason) + '</div>';
        } else {
            html += '</div>';
        }

        // 详情文字
        if (item.detail) {
            html += '<div class="detail-detail-text">' + esc(item.detail) + '</div>';
        }

        content.innerHTML = html;
        document.getElementById('order-modal').style.display = 'flex';
    }

    function _detailRow(label, value) {
        return '<div class="detail-row">' +
            '<span class="detail-row-label">' + esc(label) + '</span>' +
            '<span class="detail-row-value">' + value + '</span></div>';
    }

    function showOrderDetail(oid, type) {
        const all = [...(_data.anomalies || []), ...(_data.skip_scans || [])];
        const item = all.find(x => String(x.oid) === String(oid));
        if (item) _openDetailModal(item, type);
    }

    function closeOrderModal() {
        document.getElementById('order-modal').style.display = 'none';
    }

    // ===== 指标卡片点击 -> 列表弹窗 =====
    function showOrders(type) {
        if (type === 'anomalies') {
            switchTab('anomalies');
            return;
        }
        if (type === 'skipscans') {
            switchTab('skipscan');
            return;
        }

        let items = [], title = '';
        const s = _data.summary || {};

        if (type === 'delivering') {
            items = (_data.anomalies || []).map(x => ({ ...x, _type: x.type, _elapsed: x.elapsed_min + '分钟' }));
            title = '配送中订单 (' + (s.delivering || 0) + ')';
        } else if (type === 'aftersale') {
            items = [];
            title = '售后订单 (' + (s.aftersale || 0) + ')';
        } else if (type === 'completed') {
            items = [];
            title = '今日已完成 (' + (s.completed || 0) + ')';
        } else {
            return;
        }

        const tm = document.getElementById('list-modal-title');
        const tc = document.getElementById('list-modal-content');
        tm.textContent = title;

        if (!items.length) {
            tc.innerHTML = empty('暂无订单数据');
            document.getElementById('list-modal').style.display = 'flex';
            return;
        }

        tc.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr>' +
            '<th>严重度</th><th>订单号</th><th>店名</th><th>耗时</th><th>骑手</th><th>弹簧指标</th>' +
            '</tr></thead><tbody>' +
            items.map(x => {
                return '<tr>' +
                    '<td><span class="badge ' + badgeCls(x.severity) + '">' + sevLabel(x.severity) + '</span></td>' +
                    '<td><strong>' + esc(String(x.delivery_seq || '--')) + '</strong></td>' +
                    '<td>' + esc(x.oid) + '</td>' +
                    '<td><strong>' + esc(x.shop || '--') + '</strong></td>' +
                    '<td>' + esc(x._elapsed) + '</td>' +
                    '<td>' + esc(x.rider || '--') + '</td>' +
                    '<td><span class="spring-data"><strong>基线' + esc(String(x.baseline || '--')) + '</strong> 斜率' + (x.slope != null ? (x.slope >= 0 ? '+' : '') + esc(String(x.slope)) : '--') + '</span></td>' +
                    '</tr>';
            }).join('') +
            '</tbody></table></div>';

        document.getElementById('list-modal').style.display = 'flex';
    }

    function closeListModal() {
        document.getElementById('list-modal').style.display = 'none';
    }

    // ===== 异常告警 =====
    function _renderAnomalies() {
        const a = _data.anomalies || [];
        const sm = document.getElementById('anomaly-summary');
        const gr = document.getElementById('anomaly-groups');
        const ci = document.getElementById('collect-info');

        // 采集时间显示
        if (ci && _data.updated_at) {
            var upd2 = new Date(_toMs(_data.updated_at));
            var nxt2 = new Date(upd2.getTime() + 5 * 60000);
            var fmt2 = function(d) {
                return (d.getMonth()+1) + '/' + d.getDate() + ' ' +
                    d.getHours().toString().padStart(2,'0') + ':' +
                    d.getMinutes().toString().padStart(2,'0');
            };
            ci.innerHTML =
                '<span><span class="dot green"></span>本次采集: ' + fmt2(upd2) + '</span>' +
                '<span><span class="dot blue"></span>下次采集: ' + fmt2(nxt2) + '</span>';
        }

        // 摘要 badges
        const cnt = { HIGH: 0, MED: 0, LOW: 0, WARN: 0 };
        a.forEach(x => { cnt[x.severity] = (cnt[x.severity] || 0) + 1; });
        sm.innerHTML = [
            ['严重', cnt.HIGH, 'badge-high'],
            ['中等', cnt.MED, 'badge-med'],
            ['轻微', cnt.LOW, 'badge-low'],
            ['警告', cnt.WARN, 'badge-warn']
        ].filter(([, n]) => n).map(([l, n, c]) => '<span class="badge ' + c + '">' + l + ': ' + n + '</span>').join('');

        // 分组展示
        const types = [
            {name: '分拣超时', cls: 'type-sort'},
            {name: '投餐超时', cls: 'type-stay'},
            {name: '配送超时', cls: 'type-deliver'},
            {name: '压单', cls: 'type-backlog'}
        ];
        gr.innerHTML = types.map(tp => {
            const t = tp.name;
            const items = a.filter(x => x.type === t);
            if (!items.length) return '';
            return '<div class="anomaly-group ' + tp.cls + '"><div class="anomaly-group-title">' +
                esc(t) + '<span class="anomaly-count">' + items.length + '</span></div>' +
                '<div class="table-scroll"><table class="data-table"><thead><tr>' +
                '<th>严重度</th><th>配送单号</th><th>订单号</th><th>店名</th><th>耗时</th><th>骑手</th><th>弹簧指标</th><th>详情</th>' +
                '</tr></thead><tbody>' +
                items.map(x => {
                    const idx = a.indexOf(x);
                    return '<tr class="clickable" data-idx="' + idx + '" data-src="anomalies">' +
                        '<td><span class="badge ' + badgeCls(x.severity) + '">' + sevLabel(x.severity) + '</span></td>' +
                        '<td><strong>' + esc(String(x.delivery_seq || '--')) + '</strong></td>' +
                        '<td>' + esc(x.oid) + '</td>' +
                        '<td><strong>' + esc(x.shop || '--') + '</strong></td>' +
                        '<td>' + esc(String(x.elapsed_min)) + '分钟</td>' +
                        '<td>' + esc(x.rider || '--') + '</td>' +
                        '<td><span class="spring-data"><strong>基线' + esc(String(x.baseline || '--')) + '</strong> 斜率' + (x.slope != null ? (x.slope >= 0 ? '+' : '') + esc(String(x.slope)) : '--') + '</span></td>' +
                        '<td>' +
                        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="#86868b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '</td></tr>';
                }).join('') +
                '</tbody></table></div></div>';
        }).join('');

        if (!a.length) gr.innerHTML = empty('暂无异常');
        gr.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => _showDetailFromRow(tr)));
    }

    // ===== 骑手 =====
    function _renderRiders() {
        const r = _data.riders || [];
        const c = document.getElementById('rider-groups');
        if (!r.length) { c.innerHTML = empty('暂无骑手数据'); _renderRiderChart([]); return; }
        const by = {};
        r.forEach(x => { if (!by[x.area]) by[x.area] = []; by[x.area].push(x); });
        c.innerHTML = Object.entries(by).map(([area, list]) => {
            return '<div class="rider-area-group"><div class="rider-area-title">' + esc(area) + '</div>' +
                list.map(r => {
                    const dims = [
                        { l: '分拣', d: r.sort },
                        { l: '停留', d: r.stay },
                        { l: '配送', d: r.deliver }
                    ];
                    return '<div class="rider-card"><div class="rider-name">' + esc(r.name) + '</div>' +
                        '<div class="rider-dims">' + dims.map(d =>
                            '<div class="rider-dim ' + (d.d.rate > 20 ? 'high' : '') + '">' +
                            '<div class="rider-dim-label">' + esc(d.l) + '</div>' +
                            '<div class="rider-dim-value">' + d.d.rate + '%</div>' +
                            '<div class="rider-dim-sub">' + d.d.overtime + '/' + d.d.total + ' 超时 | 均' + d.d.avg + '分</div></div>'
                        ).join('') + '</div></div>';
                }).join('') + '</div>';
        }).join('');
        _renderRiderChart(r);
    }

    function _renderRiderChart(riders) {
        const ctx = document.getElementById('chart-riders');
        if (!ctx) return;
        if (_charts.riders) _charts.riders.destroy();
        const sorted = [...riders].sort((a, b) =>
            (b.sort.total + b.stay.total + b.deliver.total) - (a.sort.total + a.stay.total + a.deliver.total)
        ).slice(0, 10);
        _charts.riders = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(r => r.name),
                datasets: [
                    { label: '分拣', data: sorted.map(r => r.sort.rate), backgroundColor: '#ff3b30', borderRadius: 4 },
                    { label: '停留', data: sorted.map(r => r.stay.rate), backgroundColor: '#ff9500', borderRadius: 4 },
                    { label: '配送', data: sorted.map(r => r.deliver.rate), backgroundColor: '#ffcc00', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', font: { size: 9 } }, grid: { color: '#f2f2f7' } },
                    x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
                }
            }
        });
    }

    // ===== 跳扫码 =====
    function _renderSkipScan() {
        const sc = _data.skip_scans || [];
        const rd = _data.skip_scan_riders || [];
        const th = (_data.config || {}).skip_scan_threshold || 60;
        const se = document.getElementById('skip-rider-summary');
        se.innerHTML = rd.length ?
            '<div class="skip-rider-cards">' + rd.map(r =>
                '<div class="skip-rider-card ' + (r.high_risk ? 'high-risk' : '') + '">' +
                '<div class="skip-rider-name">' + esc(r.name) + '</div>' +
                '<div class="skip-rider-count">' + r.count + '</div>' +
                '<div class="metric-sub">' + (r.high_risk ? '高风险' : '次疑似') + '</div></div>'
            ).join('') + '</div>' : '';

        const de = document.getElementById('skip-detail-table');
        if (!sc.length) { de.innerHTML = empty('暂无跳扫码记录'); return; }
        de.innerHTML = '<div class="table-card"><h3>全部记录 (阈值: ' + th + '秒)</h3>' +
            '<div class="table-scroll"><table class="data-table"><thead><tr>' +
            '<th>严重度</th><th>骑手</th><th>订单号</th><th>投餐</th><th>送达</th><th>间隔</th><th>详情</th>' +
            '</tr></thead><tbody>' +
            sc.map((s, i) => {
                return '<tr class="clickable" data-idx="' + i + '" data-src="skip_scans">' +
                    '<td><span class="badge ' + badgeCls(s.severity) + '">' + sevLabel(s.severity) + '</span></td>' +
                    '<td>' + esc(s.rider) + '</td>' +
                    '<td>' + esc(s.oid) + '</td>' +
                    '<td>' + esc(s.place_time) + '</td>' +
                    '<td>' + esc(s.deliver_time) + '</td>' +
                    '<td><strong>' + esc(String(s.gap_seconds)) + '秒</strong></td>' +
                    '<td>' +
                    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="#86868b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                    '</td></tr>';
            }).join('') +
            '</tbody></table></div></div>';
        de.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => _showDetailFromRow(tr)));
    }

    // ===== 竞品 =====
    function _renderCompetitor() {
        const cp = _data.competitor;
        if (!cp || !cp.stores || !cp.stores.length) {
            document.getElementById('competitor-metrics').innerHTML = empty('暂无竞品数据');
            return;
        }
        document.getElementById('competitor-date').textContent = '数据日期: ' + (cp.date || '--');
        document.getElementById('competitor-metrics').innerHTML = [
            _mCard('当日销量', cp.total_daily || 0, 'blue', null),
            _mCard('累计销量', cp.total_cumul || 0, 'green', null),
            _mCard('活跃店铺', cp.active_stores || 0, 'green', null),
            _mCard('总店铺数', cp.total_stores || 0, '', null)
        ].join('');

        const stores = cp.stores || [];
        const top15 = stores.slice(0, 15);
        const ctx = document.getElementById('chart-competitor');
        if (ctx) {
            if (_charts.comp) _charts.comp.destroy();
            _charts.comp = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top15.map(s => s.name.length > 7 ? s.name.slice(0, 7) + '..' : s.name),
                    datasets: [{
                        label: '当日销量', data: top15.map(s => s.daily),
                        backgroundColor: '#0071e3', borderRadius: 6, borderSkipped: false
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, grid: { color: '#f2f2f7' }, ticks: { font: { size: 9 } } },
                        y: { grid: { display: false }, ticks: { font: { size: 9 } } }
                    }
                }
            });
        }

        const te = document.getElementById('competitor-table');
        te.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr>' +
            '<th>#</th><th>店铺</th><th>当日</th><th>累计</th><th>昨日</th><th>评分</th>' +
            '</tr></thead><tbody>' +
            stores.map((s, i) =>
                '<tr' + (s.daily === 0 ? ' style="opacity:.45"' : '') + '>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + esc(s.name) + '</td>' +
                '<td><strong>' + s.daily + '</strong></td>' +
                '<td>' + s.total + '</td>' +
                '<td>' + s.yesterday_total + '</td>' +
                '<td>' + esc(String(s.score || '--')) + '</td></tr>'
            ).join('') +
            '</tbody></table></div>';
    }

    // ===== 历史曲线 =====
    function _renderHistory() {
        if (!_history || _history.length < 2) {
            ['chart-hist-orders', 'chart-hist-anomalies', 'chart-hist-delivering', 'chart-hist-skipscans'].forEach(id => {
                const ctx = document.getElementById(id);
                if (!ctx) return;
                if (_charts['h_' + id]) _charts['h_' + id].destroy();
                ctx.parentElement.innerHTML = '<div class="chart-wrap">' + chartEmpty('暂无历史数据') + '</div>';
            });
            return;
        }
        const labels = _history.map(h => {
            const d = new Date(h.time);
            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        });
        _lineChart('chart-hist-orders', 'ho', labels, [
            { label: '总订单', data: _history.map(h => h.orders), color: '#0071e3' },
            { label: '配送中', data: _history.map(h => h.delivering), color: '#34c759' }
        ]);
        _lineChart('chart-hist-anomalies', 'ha', labels, [
            { label: '异常', data: _history.map(h => h.anomalies), color: '#ff3b30' }
        ]);
        _lineChart('chart-hist-delivering', 'hd', labels, [
            { label: '配送中', data: _history.map(h => h.delivering), color: '#34c759' }
        ]);
        _lineChart('chart-hist-skipscans', 'hs', labels, [
            { label: '跳扫码', data: _history.map(h => h.skip_scans), color: '#ff9500' }
        ]);
    }

    // ===== 设置 =====
    function openSettings() {
        document.getElementById('settings-modal').style.display = 'flex';
        document.getElementById('setting-refresh').value = String(_refreshInterval);
    }

    function closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    function updateRefresh() {
        _refreshInterval = parseInt(document.getElementById('setting-refresh').value, 10);
        localStorage.setItem('refresh_interval', String(_refreshInterval));
        _startRefresh();
        _showToast(_refreshInterval > 0 ? '刷新间隔已更新' : '自动刷新已关闭');
    }

    // ===== 初始化 =====
    document.getElementById('gate-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') checkPassword();
    });

    // 检查登录状态
    if (!PASSWORD_HASH || _checkSavedLogin()) {
        document.getElementById('gate').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        _loadAll();
        _startRefresh();
    }

    return {
        checkPassword, refreshData, switchTab,
        openSettings, closeSettings, updateRefresh,
        showOrderDetail, closeOrderModal,
        showOrders, closeListModal
    };
})();
