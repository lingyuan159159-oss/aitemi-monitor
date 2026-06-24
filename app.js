/**
 * 艾特米监控平台 - 前端应用
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

    // ===== 工具 =====
    function esc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function badgeCls(sev) { return {HIGH:'badge-high',MED:'badge-med',LOW:'badge-low',WARN:'badge-warn'}[sev]||'badge-warn'; }
    function sevLabel(sev) { return {HIGH:'严重',MED:'中等',LOW:'轻微',WARN:'警告'}[sev]||sev||'未知'; }
    function areaCls(a) { if(!a)return''; if(a.includes('饭堂')||a.includes('航天'))return'canteen'; if(a.includes('商业'))return'street'; return''; }
    function getTh(area,key) { const s=(_data&&_data.config)?_data.config.thresholds:(_config?_config.thresholds:{}); if(!s)return 20; return(s[area]||s['_default']||{})[key]||20; }
    function fmtRel(d){const n=Date.now(),s=Math.floor((n-d)/1000);if(s<60)return s+'秒';if(s<3600)return Math.floor(s/60)+'分钟';if(s<86400)return Math.floor(s/3600)+'小时';return Math.floor(s/86400)+'天';}
    function empty(t){return`<div class="empty-state"><svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="14" stroke="#86868b" stroke-width="1.5"/><path d="M12 18h12" stroke="#86868b" stroke-width="1.5" stroke-linecap="round"/></svg><p>${esc(t)}</p></div>`;}
    function trendArrow(cur,prev){if(prev==null||prev===cur)return'';const d=cur-prev;if(d>0)return`<span class="metric-trend up">+${d}</span>`;if(d<0)return`<span class="metric-trend down">${d}</span>`;return`<span class="metric-trend flat">0</span>`;}

    // ===== 密码 =====
    async function sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
    function checkPassword(){
        const v=document.getElementById('gate-input').value; if(!v)return;
        if(!PASSWORD_HASH){_enter();return;}
        sha256(v).then(h=>{if(h===PASSWORD_HASH)_enter();else{const e=document.getElementById('gate-error');e.style.display='block';e.textContent='密码错误';}});
    }
    function _enter(){document.getElementById('gate').style.display='none';document.getElementById('app').style.display='block';_loadAll();_startRefresh();}

    // ===== 数据加载 =====
    async function _loadAll(){
        try{
            const[dr,cr]=await Promise.all([fetch(DATA_URL+'?t='+Date.now()),fetch(CONFIG_URL)]);
            if(dr.ok)_data=await dr.json();else{_showErr('数据加载失败');_setStatus('error','加载失败');return;}
            if(cr.ok)_config=await cr.json();
            if(_data?.config?.fetch_interval&&!localStorage.getItem('refresh_interval'))_refreshInterval=_data.config.fetch_interval;
            _hideErr();_updateStatus();_render();
        }catch(e){console.error(e);_showErr('网络连接失败');_setStatus('error','连接失败');}
        // 加载历史（不阻塞）
        fetch(HISTORY_URL+'?t='+Date.now()).then(r=>r.ok?r.json():[]).then(h=>{_history=h;_render();}).catch(()=>{});
    }
    function _showErr(m){const e=document.getElementById('data-error');const t=document.getElementById('data-error-text');if(e){if(t)t.textContent=m;e.style.display='flex';}}
    function _hideErr(){const e=document.getElementById('data-error');if(e)e.style.display='none';}
    function _updateStatus(){
        if(!_data){_setStatus('error','无数据');return;}
        const ok=_data.session_valid;
        _setStatus(ok?'ok':'warn',ok?'在线':'Session 已过期');
        const em=document.getElementById('session-expired-modal');if(em)em.style.display=ok?'none':'flex';
        const sw=document.getElementById('session-warning');if(sw)sw.style.display=ok?'none':'flex';
        if(_data.updated_at){const d=new Date(_data.updated_at);document.getElementById('last-update').textContent=fmtRel(d)+'前更新';}
    }
    function _setStatus(t,s){document.getElementById('status-badge').className='status-badge '+t;document.getElementById('status-text').textContent=s;}
    function refreshData(){_loadAll();}
    function _startRefresh(){_stopRefresh();if(_refreshInterval>0)_refreshTimer=setInterval(_loadAll,_refreshInterval*1000);}
    function _stopRefresh(){if(_refreshTimer){clearInterval(_refreshTimer);_refreshTimer=null;}}

    // ===== Tab =====
    function switchTab(t){document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.querySelector(`.tab[data-tab="${t}"]`).classList.add('active');document.getElementById('panel-'+t).classList.add('active');_render();}
    function _curTab(){const a=document.querySelector('.tab.active');return a?a.dataset.tab:'overview';}
    function _render(){if(!_data)return;switch(_curTab()){case'overview':_renderOverview();break;case'anomalies':_renderAnomalies();break;case'riders':_renderRiders();break;case'skipscan':_renderSkipScan();break;case'competitor':_renderCompetitor();break;}}

    // ===== 总览 =====
    function _renderOverview(){
        const s=_data.summary||{},p=_prevSummary;
        const mg=document.getElementById('metrics-grid');
        mg.innerHTML=[
            _mCard('总订单',s.total_orders||0,'blue',p?p.total_orders:null),
            _mCard('配送中',s.delivering||0,'green',p?p.delivering:null),
            _mCard('异常',s.anomaly_count||0,s.anomaly_count>0?'red':'green',p?p.anomaly_count:null),
            _mCard('跳扫码',s.skip_scan_count||0,s.skip_scan_count>0?'orange':'green',p?p.skip_scan_count:null),
            _mCard('售后',s.aftersale||0,'orange',null),
            _mCard('已完成',s.completed||0,'green',null),
        ].join('');
        _prevSummary={...s};
        _renderTrendCharts();_renderDistChart();_renderDeliveringTable();
    }
    function _mCard(l,v,c,prev){return`<div class="metric-card ${c}"><div class="metric-label">${esc(l)}</div><div class="metric-value">${v}</div><div class="metric-sub">${trendArrow(v,prev)}</div></div>`;}

    // ===== 趋势图 =====
    function _renderTrendCharts(){
        if(!_history||_history.length<2)return;
        const labels=_history.map(h=>{const d=new Date(h.time);return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');});
        // 订单趋势
        _lineChart('chart-orders-trend',labels,[
            {label:'总订单',data:_history.map(h=>h.orders),color:'#0071e3'},
            {label:'配送中',data:_history.map(h=>h.delivering),color:'#34c759'},
        ]);
        // 异常趋势
        _lineChart('chart-anomaly-trend',labels,[
            {label:'异常',data:_history.map(h=>h.anomalies),color:'#ff3b30'},
            {label:'跳扫码',data:_history.map(h=>h.skip_scans),color:'#ff9500'},
        ]);
    }
    function _lineChart(id,labels,datasets){
        const ctx=document.getElementById(id);if(!ctx)return;
        if(_charts[id])_charts[id].destroy();
        _charts[id]=new Chart(ctx,{
            type:'line',
            data:{labels,datasets:datasets.map(d=>({
                label:d.label,data:d.data,borderColor:d.color,backgroundColor:d.color+'18',
                borderWidth:2,pointRadius:0,pointHoverRadius:4,fill:true,tension:.3,
            }))},
            options:{
                responsive:true,maintainAspectRatio:false,
                interaction:{mode:'index',intersect:false},
                plugins:{legend:{display:datasets.length>1,position:'bottom',labels:{boxWidth:10,font:{size:10}}}},
                scales:{
                    y:{beginAtZero:true,grid:{color:'#f2f2f7'},ticks:{font:{size:10}}},
                    x:{grid:{display:false},ticks:{font:{size:9},maxTicksLimit:8,maxRotation:0}},
                },
            },
        });
    }

    // ===== 分布图 =====
    function _renderDistChart(){
        const a=_data.anomalies||[];const by={'分拣超时':0,'投餐超时':0,'配送超时':0,'压单':0};a.forEach(x=>{by[x.type]=(by[x.type]||0)+1;});
        const ctx=document.getElementById('chart-dist');if(!ctx)return;
        if(_charts.dist)_charts.dist.destroy();
        _charts.dist=new Chart(ctx,{type:'bar',data:{labels:['分拣超时','投餐超时','配送超时','压单'],datasets:[{label:'数量',data:[by['分拣超时'],by['投餐超时'],by['配送超时'],by['压单']],backgroundColor:['#ff3b30','#ff9500','#ffcc00','#8e8e93'],borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{size:10}},grid:{color:'#f2f2f7'}},x:{grid:{display:false},ticks:{font:{size:10}}}}}});
    }

    // ===== 配送中表格 =====
    function _renderDeliveringTable(){
        const a=_data.anomalies||[];const c=document.getElementById('delivering-table');
        if(!a.length){c.innerHTML=empty('当前没有异常');return;}
        c.innerHTML=`<div class="table-scroll"><table class="data-table"><thead><tr><th>严重度</th><th>类型</th><th>店铺</th><th>区域</th><th>耗时</th><th>详情</th></tr></thead><tbody>${a.slice(0,20).map(x=>`<tr><td><span class="badge ${badgeCls(x.severity)}">${sevLabel(x.severity)}</span></td><td>${esc(x.type)}</td><td>${esc(x.shop)}</td><td><span class="area-tag ${areaCls(x.area)}">${esc(x.area)}</span></td><td>${esc(String(x.elapsed_min))}分钟</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div>`;
    }

    // ===== 异常告警 =====
    function _renderAnomalies(){
        const a=_data.anomalies||[];const sm=document.getElementById('anomaly-summary');const gr=document.getElementById('anomaly-groups');
        const cnt={HIGH:0,MED:0,LOW:0,WARN:0};a.forEach(x=>{cnt[x.severity]=(cnt[x.severity]||0)+1;});
        sm.innerHTML=[['严重',cnt.HIGH,'badge-high'],['中等',cnt.MED,'badge-med'],['轻微',cnt.LOW,'badge-low'],['警告',cnt.WARN,'badge-warn']].filter(([,n])=>n).map(([l,n,c])=>`<span class="badge ${c}">${l}: ${n}</span>`).join('');
        const types=['分拣超时','投餐超时','配送超时','压单'];
        gr.innerHTML=types.map(t=>{const items=a.filter(x=>x.type===t);if(!items.length)return'';return`<div class="anomaly-group"><div class="anomaly-group-title">${esc(t)}<span class="anomaly-count">${items.length}</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>严重度</th><th>订单</th><th>店铺</th><th>区域</th><th>耗时</th><th>阈值</th><th>详情</th></tr></thead><tbody>${items.map(x=>`<tr><td><span class="badge ${badgeCls(x.severity)}">${sevLabel(x.severity)}</span></td><td>${esc(x.oid)}</td><td>${esc(x.shop)}</td><td><span class="area-tag ${areaCls(x.area)}">${esc(x.area)}</span></td><td>${esc(String(x.elapsed_min))}分钟</td><td>${esc(String(x.threshold||'--'))}分钟</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div></div>`;}).join('');
        if(!a.length)gr.innerHTML=empty('暂无异常');
    }

    // ===== 骑手 =====
    function _renderRiders(){
        const r=_data.riders||[];const c=document.getElementById('rider-groups');
        if(!r.length){c.innerHTML=empty('暂无骑手数据');_renderRiderChart([]);return;}
        const by={};r.forEach(x=>{if(!by[x.area])by[x.area]=[];by[x.area].push(x);});
        c.innerHTML=Object.entries(by).map(([area,list])=>{
            return`<div class="rider-area-group"><div class="rider-area-title">${esc(area)}</div>${list.map(r=>{
                const dims=[{l:'分拣',d:r.sort},{l:'停留',d:r.stay},{l:'配送',d:r.deliver}];
                return`<div class="rider-card"><div class="rider-name">${esc(r.name)}</div><div class="rider-dims">${dims.map(d=>`<div class="rider-dim ${d.d.rate>20?'high':''}"><div class="rider-dim-label">${esc(d.l)}</div><div class="rider-dim-value">${d.d.rate}%</div><div class="rider-dim-sub">${d.d.overtime}/${d.d.total} 超时 | 均${d.d.avg}分</div></div>`).join('')}</div></div>`;
            }).join('')}</div>`;
        }).join('');
        _renderRiderChart(r);
    }
    function _renderRiderChart(riders){
        const ctx=document.getElementById('chart-riders');if(!ctx)return;if(_charts.riders)_charts.riders.destroy();
        const sorted=[...riders].sort((a,b)=>(b.sort.total+b.stay.total+b.deliver.total)-(a.sort.total+a.stay.total+a.deliver.total)).slice(0,10);
        _charts.riders=new Chart(ctx,{type:'bar',data:{labels:sorted.map(r=>r.name),datasets:[{label:'分拣',data:sorted.map(r=>r.sort.rate),backgroundColor:'#ff3b30',borderRadius:4},{label:'停留',data:sorted.map(r=>r.stay.rate),backgroundColor:'#ff9500',borderRadius:4},{label:'配送',data:sorted.map(r=>r.deliver.rate),backgroundColor:'#ffcc00',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%',font:{size:9}},grid:{color:'#f2f2f7'}},x:{grid:{display:false},ticks:{font:{size:9},maxRotation:45}}}}});
    }

    // ===== 跳扫码 =====
    function _renderSkipScan(){
        const sc=_data.skip_scans||[];const rd=_data.skip_scan_riders||[];const th=(_data.config||{}).skip_scan_threshold||60;
        const se=document.getElementById('skip-rider-summary');
        se.innerHTML=rd.length?`<div class="skip-rider-cards">${rd.map(r=>`<div class="skip-rider-card ${r.high_risk?'high-risk':''}"><div class="skip-rider-name">${esc(r.name)}</div><div class="skip-rider-count">${r.count}</div><div class="metric-sub">${r.high_risk?'高风险':'次疑似'}</div></div>`).join('')}</div>`:'';
        const de=document.getElementById('skip-detail-table');
        if(!sc.length){de.innerHTML=empty('暂无跳扫码记录');return;}
        de.innerHTML=`<div class="table-card"><h3>全部记录（阈值: ${th}秒）</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>严重度</th><th>骑手</th><th>订单</th><th>店铺</th><th>投餐</th><th>送达</th><th>间隔</th></tr></thead><tbody>${sc.map(s=>`<tr><td><span class="badge ${badgeCls(s.severity)}">${sevLabel(s.severity)}</span></td><td>${esc(s.rider)}</td><td>${esc(s.oid)}</td><td>${esc(s.shop)}</td><td>${esc(s.place_time)}</td><td>${esc(s.deliver_time)}</td><td><strong>${esc(String(s.gap_seconds))}秒</strong></td></tr>`).join('')}</tbody></table></div></div>`;
    }

    // ===== 竞品 =====
    function _renderCompetitor(){
        const cp=_data.competitor;if(!cp||!cp.stores){document.getElementById('competitor-metrics').innerHTML=empty('暂无竞品数据');return;}
        document.getElementById('competitor-date').textContent='数据日期: '+(cp.date||'--');
        document.getElementById('competitor-metrics').innerHTML=[_mCard('当日销量',cp.total_daily||0,'blue',null),_mCard('累计销量',cp.total_cumul||0,'green',null),_mCard('活跃店铺',cp.active_stores||0,'green',null),_mCard('总店铺数',cp.total_stores||0,'',null)].join('');
        const stores=cp.stores||[];const top15=stores.slice(0,15);
        const ctx=document.getElementById('chart-competitor');if(ctx){if(_charts.comp)_charts.comp.destroy();_charts.comp=new Chart(ctx,{type:'bar',data:{labels:top15.map(s=>s.name.length>7?s.name.slice(0,7)+'..':s.name),datasets:[{label:'当日销量',data:top15.map(s=>s.daily),backgroundColor:'#0071e3',borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f2f2f7'},ticks:{font:{size:9}}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});}
        const te=document.getElementById('competitor-table');
        te.innerHTML=`<div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>店铺</th><th>当日</th><th>累计</th><th>昨日</th><th>评分</th></tr></thead><tbody>${stores.map((s,i)=>`<tr ${s.daily===0?'style="opacity:.45"':''}><td>${i+1}</td><td>${esc(s.name)}</td><td><strong>${s.daily}</strong></td><td>${s.total}</td><td>${s.yesterday_total}</td><td>${esc(String(s.score||'--'))}</td></tr>`).join('')}</tbody></table></div>`;
    }

    // ===== 设置 =====
    function openSettings(){document.getElementById('settings-modal').style.display='flex';document.getElementById('setting-interval').value=String(_refreshInterval);}
    function closeSettings(){document.getElementById('settings-modal').style.display='none';}
    function updateInterval(){_refreshInterval=parseInt(document.getElementById('setting-interval').value,10);localStorage.setItem('refresh_interval',String(_refreshInterval));_startRefresh();}

    // ===== 初始化 =====
    document.getElementById('gate-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkPassword();});
    if(!PASSWORD_HASH){document.getElementById('gate').style.display='none';document.getElementById('app').style.display='block';_loadAll();_startRefresh();}

    return{checkPassword,refreshData,switchTab,openSettings,closeSettings,updateInterval};
})();
