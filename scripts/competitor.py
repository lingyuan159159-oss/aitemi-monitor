"""
竞品数据采集模块（一技生活圈）

通过微信小程序 API 获取店铺销量数据。
"""

import json
import os
import sys
import time
import random
from datetime import datetime, date
from pathlib import Path

try:
    import requests
except ImportError:
    import urllib.request
    import urllib.parse
    requests = None

API_BASE = "https://chudalife.jumanxing.com/app/wxapp.php"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Mac "
    "MacWechat/WMPF MacWechat/3.8.7(0x13080712) UnifiedPCMacWechat(0xf2641a1a) XWEB/19918"
)

BASE_PARAMS = {
    "i": "1", "c": "entry", "do": "mobile", "m": "we7_wmall",
    "ctrl": "wmall", "ac": "home", "op": "index", "ta": "store",
    "device": "wxapp", "from": "wxapp", "u": "wxapp",
    "lv": "v6", "v": "6.7.3", "theme": "blue", "mv": "550",
    "lang": "zh-cn", "psize": "10",
    "lat": "23.1195", "lng": "112.5125",
    "useTest": "0", "scene": "1256", "ipreload": "0",
}


def _make_session(session_id):
    if requests:
        s = requests.Session()
        s.proxies = {"http": None, "https": None}
        s.trust_env = False
        s.cookies.set("PHPSESSID", session_id, domain="chudalife.jumanxing.com")
        s.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://servicewechat.com/wx67599a2ffa67c452/9/page-frame.html",
            "xweb_xhr": "1",
        })
        return s
    else:
        return _UrllibSession(session_id)


class _UrllibSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.headers = {
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://servicewechat.com/wx67599a2ffa67c452/9/page-frame.html",
            "xweb_xhr": "1",
        }

    def get(self, url, params=None, timeout=30):
        if params:
            qs = urllib.parse.urlencode(params)
            full_url = f"{url}?{qs}"
        else:
            full_url = url
        req = urllib.request.Request(full_url, headers=self.headers)
        req.add_header("Cookie", f"PHPSESSID={self.session_id}")
        resp = urllib.request.urlopen(req, timeout=timeout)
        body = resp.read().decode('utf-8')
        # 检查返回是否是 JSON（防止 HTML 错误页导致模糊报错）
        try:
            json.loads(body)
        except json.JSONDecodeError:
            raise ValueError(f"API 返回非 JSON 响应（可能是错误页），前 200 字符: {body[:200]}")
        return _UrllibResponse(resp, body)


class _UrllibResponse:
    def __init__(self, resp, body):
        self.status_code = resp.getcode()
        self._body = body

    def json(self):
        return json.loads(self._body)


def _fetch_store_page(session, page, psize=50):
    params = {**BASE_PARAMS, "page": str(page), "psize": str(psize)}
    try:
        resp = session.get(API_BASE, params=params, timeout=30)
        if resp.status_code != 200:
            return None, f"HTTP {resp.status_code}"
        data = resp.json()
        msg = data.get("message", {})
        errno = msg.get("errno", 0)
        if isinstance(errno, int) and errno != 0:
            return None, msg.get("message", f"errno={errno}")
        inner = msg.get("message", {})
        stores = inner.get("stores", [])
        return stores, None
    except Exception as e:
        return None, str(e)


def fetch_all_stores(session_id, max_retries=3):
    best_stores = []
    best_count = 0

    for attempt in range(1, max_retries + 1):
        session = _make_session(session_id)
        all_stores = []
        page = 1
        empty_streak = 0
        seen_ids = set()

        while empty_streak < 3 and page <= 10:
            stores, err = _fetch_store_page(session, page, psize=50)
            if err:
                print(f"  [WARN] page {page}: {err}", file=sys.stderr)
                empty_streak += 1
                page += 1
                continue
            if not stores:
                empty_streak += 1
                page += 1
                continue
            empty_streak = 0
            for s in stores:
                sid = str(s.get("id", ""))
                if sid and sid not in seen_ids:
                    seen_ids.add(sid)
                    all_stores.append(s)
            page += 1
            time.sleep(random.uniform(1.5, 3.0))

        count = len(all_stores)
        print(f"  Attempt {attempt}: {count} stores", file=sys.stderr)

        if count > best_count:
            best_stores = all_stores
            best_count = count

        if attempt >= 2 and count == best_count and count > 0:
            return best_stores

        if attempt < max_retries:
            time.sleep(2)

    return best_stores


def compute_competitor_data(stores, history_path=None):
    """计算竞品数据，支持：
    - 每小时增量（对比上一小时）
    - 当日总量（对比昨天最后一小时）
    """
    now = datetime.now()
    today_str = date.today().strftime("%Y-%m-%d")
    hour_key = now.strftime("%Y-%m-%dT%H")  # 如 "2026-06-25T14"

    today_map = {}
    for s in stores:
        sid = str(s.get("id", ""))
        if sid:
            try:
                sailed_raw = s.get("sailed", 0)
                score_raw = s.get("score", 0)
                today_map[sid] = {
                    "name": s.get("title", "?"),
                    "sailed": int(sailed_raw) if str(sailed_raw).strip().isdigit() else 0,
                    "score": float(score_raw) if score_raw not in (None, '', 'N/A') else 0.0,
                    "address": s.get("address", ""),
                }
            except (ValueError, TypeError):
                continue

    # 加载历史（按小时存储）
    history = {}
    if history_path and os.path.exists(history_path):
        try:
            with open(history_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except Exception:
            history = {}

    # 找昨天最后一小时的快照（用于计算当日总量）
    yesterday_keys = sorted([k for k in history.keys() if k < today_str], reverse=True)
    yesterday_map = history[yesterday_keys[0]] if yesterday_keys else {}

    # 找上一小时的快照（用于计算小时增量）
    prev_hour_key = None
    for k in sorted(history.keys(), reverse=True):
        if k < hour_key:
            prev_hour_key = k
            break
    prev_hour_map = history[prev_hour_key] if prev_hour_key else {}

    results = []
    for sid, t in today_map.items():
        sailed_now = t["sailed"]
        sailed_yesterday = yesterday_map.get(sid, {}).get("sailed", 0)
        sailed_prev_hour = prev_hour_map.get(sid, {}).get("sailed", 0)

        daily = max(0, sailed_now - sailed_yesterday)  # 当日总量
        hourly = max(0, sailed_now - sailed_prev_hour)  # 小时增量

        results.append({
            "id": sid,
            "name": t["name"],
            "total": sailed_now,
            "yesterday_total": sailed_yesterday,
            "daily": daily,
            "hourly": hourly,
            "score": t["score"],
        })

    results.sort(key=lambda x: x["daily"], reverse=True)

    # 保存当前小时快照
    history[hour_key] = today_map
    # 保留最近7天的小时数据（7×24=168条）
    keep_keys = sorted(history.keys())[-168:]
    history = {k: history[k] for k in keep_keys}
    if history_path:
        os.makedirs(os.path.dirname(history_path), exist_ok=True)
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False)

    total_hourly = sum(r["hourly"] for r in results)
    total_daily = sum(r["daily"] for r in results)
    total_cumul = sum(r["total"] for r in results)
    active = sum(1 for r in results if r["hourly"] > 0)

    return {
        "date": today_str,
        "hour": now.hour,
        "total_daily": total_daily,
        "total_hourly": total_hourly,
        "total_cumul": total_cumul,
        "active_stores": active,
        "total_stores": len(results),
        "stores": results,
    }
