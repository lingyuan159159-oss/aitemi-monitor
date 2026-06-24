"""
艾特米后台 API 交互模块

负责：
- Session 验证
- 拉取骑手操作记录
- 拉取订单列表
- 拉取店铺区域映射

所有 HTTP 请求使用 urllib（stdlib），无第三方依赖。
"""

import re
import json
import sys
import urllib.request
import urllib.parse
from datetime import datetime

def _today():
    return datetime.now().strftime('%Y-%m-%d')


def validate_session(session, base_url):
    """验证 session 是否有效。
    返回 (valid: bool, cookie: str)
    """
    cookie = f"PHPSESSID={session.get('PHPSESSID', '')}; adminsession={session.get('adminsession', '')}"
    url = f"{base_url}/?m=public&c=login"
    req = urllib.request.Request(url, headers={'Cookie': cookie})
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        html = resp.read().decode('utf-8')
        if 'admin_name' in html or 'pass_word' in html or '验证码' in html:
            return False, cookie
        return True, cookie
    except Exception as e:
        print(f"  Session check error: {e}", file=sys.stderr)
        return False, cookie


def _fetch(url, cookie, timeout=20):
    """发送带 cookie 的 GET 请求，返回 HTML 文本。"""
    req = urllib.request.Request(url, headers={'Cookie': cookie})
    return urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8')


def load_all_ops(base_url, cookie, date_str=None):
    """拉取全量骑手操作记录（翻页，最多7页）。"""
    if date_str is None:
        date_str = _today()
    ops = {}
    for pg in range(1, 8):
        url = (
            f"{base_url}/?m=delivery&c=rider_order_process_operate_list"
            f"&noframe=1&action=search"
            f"&start_date={date_str}&end_date={date_str}"
            f"&page={pg}&eachnum=500"
        )
        html = _fetch(url, cookie)
        trs = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
        if not trs:
            break
        for tr in trs:
            tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.DOTALL)
            clean = [re.sub(r'<[^>]+>', '', td).strip() for td in tds]
            if len(clean) < 8:
                continue
            oid = clean[6]
            if not oid.isdigit():
                continue
            if oid not in ops:
                ops[oid] = []
            ops[oid].append({
                'time': clean[1],
                'rider': clean[2],
                'type': clean[4],
                'status': clean[5],
                'shop': clean[7],
            })
        print(f"  Ops page {pg}: {sum(len(v) for v in ops.values())} records", file=sys.stderr)
    print(f"  Total: {len(ops)} orders with ops", file=sys.stderr)
    return ops


def load_all_orders(base_url, cookie, date_str=None):
    """拉取全量订单（翻页，最多7页）。"""
    if date_str is None:
        date_str = _today()
    orders = []
    for pg in range(1, 8):
        url = (
            f"{base_url}/?m=order&c=order_product_list"
            f"&noframe=1&action=search"
            f"&start_date={date_str}&end_date={date_str}"
            f"&page={pg}&eachnum=500"
        )
        html = _fetch(url, cookie)
        tables = re.findall(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)
        if not tables:
            break
        for table in tables:
            shop_m = re.search(r'店铺[：:]\s*<b>(.*?)</b>', table)
            oid_m = re.search(r'订单编号[：:]\s*<b>(\d+)</b>', table)
            exp_m = re.search(r'期望送达[：:](\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}:\d{2})', table)
            ord_m = re.search(r'下单时间[：:](\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}:\d{2})', table)
            if not oid_m:
                continue
            oid = oid_m.group(1)
            addr_m = re.search(r'<p>([^<]*肇庆市技师学院[^<]*)</p>', table)
            addr = addr_m.group(1).strip() if addr_m else ''
            dorm = ''
            if addr:
                dorm_m = re.search(r'([A-Za-z]?\d[A-Za-z]?\d{2,4})\s*(?:号|宿舍)?\s*$', addr)
                dorm = dorm_m.group(1) if dorm_m else ''
            orders.append({
                'shop': shop_m.group(1) if shop_m else '',
                'oid': oid,
                'addr': addr,
                'dorm': dorm,
                'exp_time': exp_m.group(1) if exp_m else '',
                'order_time': ord_m.group(1) if ord_m else '',
                'is_delivering': '配送中' in table,
                'is_complete': '已完成' in table,
                'is_aftersale': '同意退款' in table,
                'is_waimai': '外卖配送' in table,
            })
            ds_m = re.search(r'配送[#＃]<[^>]*>(\d+)</[^>]*>', table)
            if ds_m:
                orders[-1]['delivery_seq'] = int(ds_m.group(1))
        print(f"  Orders page {pg}: {len(orders)} so far", file=sys.stderr)
    print(f"  Total: {len(orders)} orders", file=sys.stderr)
    return orders


def load_shop_area(base_url, cookie):
    """拉取 business_list 建立店铺→区域映射。
    返回 {shop_name: area_name}
    """
    mapping = {}
    for pg in range(1, 10):
        url = f"{base_url}/?m=business&c=business_list&noframe=1&action=search&page={pg}"
        html = _fetch(url, cookie)
        tables = re.findall(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)
        if not tables:
            break
        for table in tables:
            trs = re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.DOTALL)
            for tr in trs:
                tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.DOTALL)
                clean = [re.sub(r'<[^>]+>', '', td).strip() for td in tds]
                if len(clean) >= 4:
                    area = clean[2]
                    shop = clean[3]
                    if shop and area:
                        mapping[shop] = area
        print(f"  Biz page {pg}: {len(mapping)} shops total", file=sys.stderr)
    print(f"  Total: {len(mapping)} shop->area mappings", file=sys.stderr)
    return mapping


def get_area(shop_name, config_shop_areas, api_shop_areas=None):
    """查找店铺区域。优先精确匹配，再模糊匹配。"""
    if not shop_name:
        return '未知'

    # 优先用 API 拉到的实时映射
    if api_shop_areas:
        if shop_name in api_shop_areas:
            return _normalize_area(api_shop_areas[shop_name])
        for biz_shop, biz_area in api_shop_areas.items():
            if shop_name in biz_shop or biz_shop in shop_name:
                return _normalize_area(biz_area)

    # 回退到 config 静态映射
    if shop_name in config_shop_areas:
        return _normalize_area(config_shop_areas[shop_name])
    for biz_shop, biz_area in config_shop_areas.items():
        if shop_name in biz_shop or biz_shop in shop_name:
            return _normalize_area(biz_area)

    return '未知'


def _normalize_area(area):
    if '一饭' in area or '1饭' in area:
        return '一饭堂'
    elif '二饭' in area or '2饭' in area:
        return '二饭堂'
    elif '三饭' in area or '3饭' in area:
        return '三饭堂'
    elif '四饭' in area or '4饭' in area:
        return '四饭堂'
    elif '商业' in area:
        return '商业街'
    elif '航天' in area:
        return '航天食堂'
    return area


def parse_ts(s):
    """解析时间字符串为 datetime 对象。"""
    try:
        return datetime.strptime(s, '%Y-%m-%d %H:%M:%S')
    except Exception:
        return None
