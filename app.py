#!/usr/bin/env python3
"""A small, dependency-free voice archive CMS. Python 3.10+."""
import argparse
import base64
import hashlib
import hmac
import html
import io
import json
import os
import re
import secrets
import sqlite3
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone, timedelta
from email.parser import BytesParser
from email.policy import default
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('VOICE_DATA_DIR', ROOT / 'data')).resolve()
DB = DATA / 'archive.sqlite3'
STATIC = ROOT / 'static'
ASSET_VERSION = '1.4.3'
ASSET_BUILD = '1.4.3-r2'
MAX_POST = 8 * 1024 * 1024
DEFAULTS = {
    'site_name': 'ShySssiee', 'page_name': '一頭栽進虛擬偶像世界的J人',
    'hero_title': '邊聽，邊讀懂每一句話。',
    'hero_subtitle': '偶像語音直播 × 韓文／繁中逐字稿',
    'latest_title': '最近更新', 'others_title': '其他語音紀錄',
    'transcript_title': '雙語逐字稿', 'notes_title': '整理筆記',
    'about_text': '粉絲自發整理的語音直播與雙語逐字稿。',
    'footer_credit': '© 2026 shysssiee · 網站設計與內容整理：shysssiee',
    'report_url': '',
    'about_title': '關於我', 'about_content': '這裡是粉絲自發整理的語音直播與雙語字幕收藏站。',
    'about_threads': '', 'about_instagram': '', 'about_youtube': '', 'about_email': '',
    'report_form_url': '', 'report_types': '字幕翻譯錯誤\n字幕時間不同步\n影片無法播放\n圖片或版面異常\n網站連結失效\n其他問題或建議',
    'podcast_title': 'Podcast', 'podcast_subtitle': 'WE GO-6 的聲音收藏與雙語逐字稿',
    'pop_live_title': 'POP Live', 'pop_live_subtitle': '限定分享的影音與雙語字幕收藏',
    'groups_title': '團體專欄', 'recommend_title': '隨機推薦', 'show_recommend': '1',
    'logo_data': '', 'logo_size': '40',
    'accent': '#dc887d', 'secondary': '#968aca', 'background': '#fcfaf7',
    'text_color': '#1c2a4a', 'body_size': '17', 'title_size': '31',
    'corner': '16', 'font_url': '', 'logo_url': '', 'site_url': '',
    'home_order': 'hero,filters,latest', 'show_hero': '1',
    'show_filters': '1', 'show_latest': '1', 'show_private_cards': '1',
    'wego_members_initialized': '0',
}

def esc(value):
    return html.escape(str(value or ''), quote=True)

def conn():
    DATA.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    return db

def initialize():
    with conn() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, password_hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, sort_order INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, sort_order INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS member_tags (group_id INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, UNIQUE(group_id,name));
        CREATE TABLE IF NOT EXISTS episodes (
          id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
          group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          member TEXT NOT NULL DEFAULT '', live_date TEXT NOT NULL DEFAULT '',
          youtube_id TEXT NOT NULL, source_url TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '', ko_srt TEXT NOT NULL DEFAULT '',
          zh_srt TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
          cover_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        ''')
        for key, value in DEFAULTS.items():
            db.execute('INSERT OR IGNORE INTO settings VALUES (?,?)', (key, value))
        columns = {r['name'] for r in db.execute('PRAGMA table_info(episodes)')}
        if 'category_id' not in columns:
            db.execute('ALTER TABLE episodes ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL')
        if 'cover_image' not in columns:
            db.execute('ALTER TABLE episodes ADD COLUMN cover_image BLOB')
        if 'cover_mime' not in columns:
            db.execute("ALTER TABLE episodes ADD COLUMN cover_mime TEXT NOT NULL DEFAULT ''")
        if 'published_at' not in columns:
            db.execute("ALTER TABLE episodes ADD COLUMN published_at TEXT NOT NULL DEFAULT ''")
            db.execute("UPDATE episodes SET published_at=created_at WHERE status='published'")
        if 'content_type' not in columns:
            db.execute("ALTER TABLE episodes ADD COLUMN content_type TEXT NOT NULL DEFAULT 'video'")
        member_columns={r['name'] for r in db.execute('PRAGMA table_info(member_tags)')}
        if 'display_name' not in member_columns:
            db.execute("ALTER TABLE member_tags ADD COLUMN display_name TEXT NOT NULL DEFAULT ''")
            db.execute("UPDATE member_tags SET display_name=name WHERE display_name='' ")
        if 'sort_order' not in member_columns:
            db.execute("ALTER TABLE member_tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
        if 'visible' not in member_columns:
            db.execute("ALTER TABLE member_tags ADD COLUMN visible INTEGER NOT NULL DEFAULT 1")
        for r in db.execute('SELECT group_id,member FROM episodes WHERE member<>""'):
            for name in split_members(r['member']):
                db.execute('INSERT OR IGNORE INTO member_tags(group_id,name) VALUES (?,?)',(r['group_id'] or 0,name))
        marker=db.execute('SELECT value FROM settings WHERE key="wego_members_initialized"').fetchone()
        wego=db.execute("SELECT id FROM groups WHERE REPLACE(REPLACE(UPPER(name),' ',''),'-','')='WEGO6' LIMIT 1").fetchone()
        if wego and marker and marker['value']=='0':
            for order,(name,label) in enumerate((('Wooyeon','Wooyeon／鄭羽然'),('Xiu','Xiu／車時雨'),('Taegang','Taegang／朱泰岡'),('Zero','Zero／傑羅李'),('Kuta','Kuta／蒼井 空汰')),1):
                db.execute('INSERT OR IGNORE INTO member_tags(group_id,name,display_name,sort_order,visible) VALUES (?,?,?,?,1)',(wego['id'],name,label,order))
                db.execute('UPDATE member_tags SET display_name=?,sort_order=? WHERE group_id=? AND name=? AND (display_name="" OR display_name=name)',(label,order,wego['id'],name))
            db.execute('UPDATE settings SET value="1" WHERE key="wego_members_initialized"')

def setting(db):
    return {r['key']: r['value'] for r in db.execute('SELECT * FROM settings')}

def split_members(raw):
    return list(dict.fromkeys(x.strip()[:80] for x in re.split(r'[,，;；\n]+',raw or '') if x.strip()))[:30]

def display_date(raw):
    if not raw:return '尚未發布'
    try:return datetime.fromisoformat(raw).astimezone(timezone(timedelta(hours=8))).strftime('%Y/%m/%d %H:%M')
    except ValueError:return raw[:16]

def icon(name):
    paths={
      'home':'M3 10l9-7 9 7v11h-6v-7H9v7H3z',
      'play':'M8 5v14l11-7z','pause':'M7 5h3v14H7zM14 5h3v14h-3z',
      'external':'M14 4h6v6m0-6-9 9M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6',
      'copy':'M8 8h12v12H8zM4 16V4h12',
      'back':'M12 5a7 7 0 1 0 7 7M12 2v5l-4-2.5z',
      'forward':'M12 5a7 7 0 1 1-7 7M12 2v5l4-2.5z',
      'expand':'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
      'lock':'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z'
    }
    return f'<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="{paths[name]}"/></svg>'

def youtube_id(url):
    try:
        p = urllib.parse.urlparse(url.strip())
        host = (p.hostname or '').lower()
        if host in ('youtu.be', 'www.youtu.be'):
            vid = p.path.strip('/').split('/')[0]
        elif host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'):
            parts = p.path.strip('/').split('/')
            vid = parts[1] if len(parts) > 1 and parts[0] in ('embed', 'shorts', 'live') else urllib.parse.parse_qs(p.query).get('v', [''])[0]
        else:
            return ''
        return vid if re.fullmatch(r'[A-Za-z0-9_-]{11}', vid) else ''
    except (ValueError, IndexError):
        return ''

def clean_slug(value):
    return re.sub(r'[^a-z0-9-]+', '-', value.lower().strip()).strip('-')[:80]

def safe_url(value):
    value = value.strip()
    try:
        p = urllib.parse.urlparse(value)
        if p.scheme in ('http', 'https') and p.netloc and not p.username and not p.password:
            return value
    except ValueError:
        pass
    return ''

def image_type(blob):
    if blob.startswith(b'\x89PNG\r\n\x1a\n'): return 'png', 'image/png'
    if blob.startswith(b'\xff\xd8\xff'): return 'jpg', 'image/jpeg'
    if blob[:4] == b'RIFF' and blob[8:12] == b'WEBP': return 'webp', 'image/webp'
    return None

def cover_path(row):
    mime=row['cover_mime'] if 'cover_mime' in row.keys() else ''
    ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}.get(mime)
    return f'/media/episode/{row["id"]}.{ext}' if ext else row['cover_url']

def cover_markup(row, css_class='mini-cover'):
    url=cover_path(row)
    return f'<span class="{css_class}"><img src="{esc(url)}" alt="" loading="lazy"></span>' if url else f'<span class="{css_class}">♫</span>'

def hero_markup(cfg):
    return f'<section class="hero"><span class="eyebrow">VOICE ARCHIVE</span><h1>{esc(cfg["hero_title"])}</h1><p>{esc(cfg["hero_subtitle"])}</p></section>'

def transcript_markup(captions,cfg,controls=True):
    follow='<label class="follow-control"><input id="auto-follow" type="checkbox"> 自動跟隨播放</label>'
    tools=f'''<div class="transcript-head"><h2>{esc(cfg['transcript_title'])}</h2><div class="modes" aria-label="語言顯示"><button class="active" data-mode="both">雙語</button><button data-mode="ko">韓文</button><button data-mode="zh">繁中</button></div></div>{follow}<div class="size-control">文字大小 <button data-size="-1">A−</button><button data-size="1">A＋</button><button data-size="0">重設</button></div><label class="offset">字幕偏移（秒） <input id="offset" type="number" min="-30" max="30" step="0.1" value="0" inputmode="decimal"><small>字幕比聲音早出現時填正數</small></label>''' if controls else f'<h2>{esc(cfg["transcript_title"])}</h2>{follow}'
    return f'<details class="transcript-disclosure"><summary>展開{esc(cfg["transcript_title"])} <span class="disclosure-hint">點擊查看完整內容</span></summary><section class="transcript-area">{tools}<div id="transcript" class="transcript" tabindex="0" aria-label="可捲動的雙語逐字稿">{captions}</div></section></details>'

def srt_lines(raw):
    output = []
    for block in re.split(r'\n\s*\n', raw.replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff')):
        m = re.search(r'(?m)^\s*(?:(\d+):)?([0-5]?\d):([0-5]\d)[,\.](\d{3})\s*(?:-->\s*|,\s*)(?:(?:\d+):)?[0-5]?\d:[0-5]\d[,\.]\d{3}\s*$', block)
        if not m:
            continue
        seconds = int(m[1] or 0)*3600 + int(m[2])*60 + int(m[3]) + int(m[4])/1000
        lines = [x.strip() for x in block[m.end():].splitlines() if x.strip()]
        if lines:
            output.append({'time': seconds, 'stamp': f'{int(seconds//3600):02}:{int(seconds%3600//60):02}:{int(seconds%60):02}', 'text': ' '.join(lines)})
    return output

def transcript(ko, zh):
    a, b = srt_lines(ko), srt_lines(zh)
    if not a:
        return [{'time': x['time'], 'stamp': x['stamp'], 'ko': '', 'zh': x['text']} for x in b]
    result = []
    for i, x in enumerate(a):
        match = min(b, key=lambda y: abs(y['time']-x['time'])) if b else None
        if match and abs(match['time']-x['time']) > 4:
            match = b[i] if i < len(b) else None
        result.append({'time': x['time'], 'stamp': x['stamp'], 'ko': x['text'], 'zh': match['text'] if match else ''})
    return result

def form_data(handler):
    length = int(handler.headers.get('Content-Length', '0'))
    if length > MAX_POST or length < 0:
        raise ValueError('提交內容超過 5 MB')
    payload = handler.rfile.read(length)
    ctype = handler.headers.get('Content-Type', '')
    if ctype.startswith('multipart/form-data'):
        msg = BytesParser(policy=default).parsebytes(b'Content-Type: '+ctype.encode()+b'\r\nMIME-Version: 1.0\r\n\r\n'+payload)
        fields = {}
        for part in msg.iter_parts():
            name = part.get_param('name', header='content-disposition')
            if name:
                raw=part.get_payload(decode=True)
                fields[name] = raw if name in ('cover_file','logo_file') else raw.decode('utf-8-sig', 'replace')
        return fields
    return {k: v[-1] for k, v in urllib.parse.parse_qs(payload.decode('utf-8', 'replace'), keep_blank_values=True).items()}

def page(title, body, cfg, admin=False):
    cssvars = ';'.join([
        f'--accent:{cfg["accent"]}', f'--secondary:{cfg["secondary"]}',
        f'--bg:{cfg["background"]}', f'--ink:{cfg["text_color"]}',
        f'--body-size:{cfg["body_size"]}px', f'--title-size:{cfg["title_size"]}px',
        f'--corner:{cfg["corner"]}px'])
    font = f'<link rel="stylesheet" href="{esc(cfg["font_url"])}">' if cfg['font_url'] else ''
    logo_source = cfg.get('logo_data') or cfg['logo_url']
    logo_size = int(cfg.get('logo_size','40'))
    logo = f'<img class="logo" src="{esc(logo_source)}" alt="" style="width:{logo_size}px;height:{logo_size}px">' if logo_source else '<span class="wave">〰</span>'
    nav = f'<a href="/">首頁</a><a href="/">影音紀錄</a><a href="/podcast/">Podcast</a><a href="/pop-live/">{esc(cfg.get("pop_live_title","POP Live"))}</a><a href="/about/">{esc(cfg.get("about_title","關於我"))}</a><a href="/report/">問題回報</a><button class="theme-switch" type="button" role="switch" aria-checked="false" aria-label="切換深色與淺色模式"><span>☀</span><span>☾</span></button>'
    sidebar = '''<aside class="admin-sidebar"><strong>管理選單</strong><a href="/admin">總覽</a><details open><summary>內容管理</summary><a href="/admin">所有文章</a><a href="/admin/episode/new?type=video">新增影音紀錄</a><a href="/admin/episode/new?type=podcast">新增 Podcast</a><a href="/admin/episode/new?type=video&status=private">新增 POP Live</a></details><details open><summary>資料管理</summary><a href="/admin/groups">團體</a><a href="/admin/members">成員</a><a href="/admin/categories">分類</a><a href="/admin/storage">資料容量與整理</a></details><details open><summary>網站管理</summary><a href="/admin/settings">網站文字與外觀</a><a href="/admin/settings/home">首頁區塊</a><a href="/admin/settings/identity">識別與字體</a><a href="/admin/settings/about">關於我</a><a href="/admin/settings/report">問題回報設定</a><a href="/admin/export">匯出 GitHub Pages</a><a href="/admin/backup">下載資料庫備份</a></details><a href="/">查看網站</a><a href="/admin/logout">登出</a></aside>''' if admin else ''
    nav = '<a href="/">查看網站</a>' if admin else nav
    browser_title=f'{cfg["site_name"]}｜{cfg["page_name"]}'
    return f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>{esc(browser_title)}</title><link rel="stylesheet" href="/static/style.css?v={ASSET_BUILD}">{font}</head><body class="{'admin-page' if admin else 'public-page'}" style="{esc(cssvars)}"><div class="shell"><header><a class="brand" href="/">{logo}<span><strong>{esc(cfg['site_name'])}</strong><small>{esc(cfg['page_name'])}</small></span></a><nav>{nav}</nav></header><div class="page-layout">{sidebar}<main>{body}</main></div><footer><span>{esc(cfg['about_text'])}</span><span>{esc(cfg['footer_credit'])} · v{ASSET_VERSION}</span></footer></div><script src="/static/app.js?v={ASSET_BUILD}" defer></script></body></html>'''

def episode_card(row):
    category=row['category_name'] if 'category_name' in row.keys() else ''
    details=' · '.join(dict.fromkeys(x for x in ('直播日期：'+(row['live_date'] or '未填寫'),row['group_name'] or '',category or '',row['member'] or '') if x))
    search=' '.join(str(row[k] or '') for k in ('title','member','group_name'))+' '+(category or '')
    lock=f'<span class="card-lock" title="私密文章">{icon("lock")}</span>' if row['status']=='private' else ''
    return f'<a class="episode-row {"podcast-card" if row["content_type"]=="podcast" else ""}" href="/episode/{esc(row["slug"])}" data-date="{esc(row["live_date"])}" data-group="{row["group_id"] or ""}" data-member="{esc(row["member"] or "")}" data-search="{esc(search.lower())}">{cover_markup(row)}<span><strong>{esc(row["title"])}</strong><small>{esc(details)}</small></span>{lock}<span aria-hidden="true">›</span></a>'

WEGO_MEMBERS=[('Wooyeon','Wooyeon／鄭羽然'),('Xiu','Xiu／車時雨'),('Taegang','Taegang／朱泰岡'),('Zero','Zero／傑羅李'),('Kuta','Kuta／蒼井 空汰')]

def podcast_member_groups(db):
    result=[]
    for group in db.execute('SELECT id,name FROM groups ORDER BY sort_order,id'):
        members=[dict(r) for r in db.execute('SELECT name,display_name,sort_order FROM member_tags WHERE group_id=? AND visible=1 ORDER BY sort_order,rowid',(group['id'],))]
        if members: result.append({'id':group['id'],'name':group['name'],'members':members})
    return result

def member_label(name):
    return dict(WEGO_MEMBERS).get(name,name)

def home_markup(rows,groups,cfg,content_type='video',member_groups=()):
    if content_type=='podcast':
        member_options=''.join(f'<option value="{esc(member["name"])}" data-group="{group["id"]}">{esc(member["display_name"] or member_label(member["name"]))}</option>' for group in member_groups for member in group['members'])
        group_chips='<button class="chip selected" type="button" data-filter="">全部</button>'+''.join(f'<button class="chip" type="button" data-filter="{g["id"]}">{esc(g["name"])}</button>' for g in groups)
        chips=f'''<div class="chips">{group_chips}</div><div class="podcast-member-filters"><label>成員<select id="podcast-member-filter" disabled><option value="">請先選擇團體</option>{member_options}</select></label></div>'''
    else:
        chips='<button class="chip selected" type="button" data-filter="">全部</button>'+''.join(f'<button class="chip" type="button" data-filter="{g["id"]}">{esc(g["name"])}</button>' for g in groups)
    cards=''.join(episode_card(row) for row in rows)
    recommendations=f'<section class="recommendations" hidden><div class="section-heading"><h2>{esc(cfg["recommend_title"])}</h2><button type="button" id="shuffle-recommend">換一批</button></div><div id="recommend-list" class="list"></div></section>' if cfg.get('show_recommend')=='1' else ''
    blocks={
      'hero':hero_markup(cfg) if content_type=='video' else f'<section class="hero podcast-hero"><span class="eyebrow">PODCAST ARCHIVE</span><h1>{esc(cfg["podcast_title"])}</h1><p>{esc(cfg["podcast_subtitle"])}</p></section>',
      'filters':f'<section class="group-columns"><h2>{esc(cfg["groups_title"])}</h2>{chips if content_type=="podcast" else f"<div class=\"chips\">{chips}</div>"}</section><form class="search" id="static-search"><input id="static-query" type="search" aria-label="搜尋影音紀錄" placeholder="搜尋影音紀錄、成員或關鍵字"><button>搜尋</button></form>',
      'latest':recommendations+f'<div class="section-heading"><h2>{esc(cfg["latest_title"])}</h2><label class="date-sort">直播日期 <select id="date-sort"><option value="desc">最新優先</option><option value="asc">最舊優先</option></select></label></div><div id="static-list" class="list">{cards}<p id="static-empty" class="empty" {"hidden" if rows else ""}>目前沒有符合的影音紀錄。</p></div><nav id="home-pages" class="home-pages" aria-label="文章分頁"></nav>'
    }
    return '<div class="home-layout">'+''.join(blocks[k] for k in cfg.get('home_order',DEFAULTS['home_order']).split(',') if k in blocks and cfg.get('show_'+k,'1')=='1')+'</div><script src="/static/export.js?v='+ASSET_BUILD+'" defer></script>'

def about_markup(cfg):
    paragraphs=''.join(f'<p>{esc(line)}</p>' for line in cfg.get('about_content','').splitlines() if line.strip())
    social=[]
    for key,label in [('about_threads','Threads'),('about_instagram','Instagram'),('about_youtube','YouTube')]:
        if cfg.get(key):social.append(f'<a class="button" href="{esc(cfg[key])}" target="_blank" rel="noopener noreferrer">{label} ↗</a>')
    if cfg.get('about_email'):social.append(f'<a class="button" href="mailto:{esc(cfg["about_email"])}">聯絡我</a>')
    return f'<article class="about-page"><a class="home-crumb" href="/">{icon("home")}<span>首頁</span></a><h1>{esc(cfg["about_title"])}</h1>{paragraphs}<div class="social-links">{"".join(social)}</div></article>'

def report_markup(cfg,article_url=''):
    types=''.join(f'<option>{esc(x)}</option>' for x in cfg.get('report_types','').splitlines() if x.strip())
    endpoint=cfg.get('report_form_url','')
    if not endpoint:return '<article class="report-page"><h1>問題回報</h1><p class="empty">管理員尚未設定表單收件服務。</p></article>'
    return f'''<article class="report-page"><a class="home-crumb" href="/">{icon('home')}<span>首頁</span></a><h1>問題回報</h1><p>不需要提供真實姓名或聯絡方式，問題說明中也請避免填入個人資料。</p><form class="form report-form" method="post" action="{esc(endpoint)}"><label>暱稱（選填，可匿名）<input name="nickname" maxlength="80"></label><label>問題類型 *<select name="problem_type" required><option value="">請選擇</option>{types}</select></label><label>文章網址<input name="article_url" type="url" value="{esc(article_url)}"></label><label>影片時間點（選填）<input name="timestamp" placeholder="例如 05:32"></label><label>問題說明 *<textarea name="message" rows="7" required maxlength="5000"></textarea></label><button class="primary">送出回報</button></form></article>'''


def delete_form(ident, token):
    return f'<form method="post" action="/admin/episode/delete" class="delete-form" data-confirm="delete"><input type="hidden" name="csrf" value="{token}"><input type="hidden" name="id" value="{ident}"><input type="hidden" name="confirm_delete" value="0"><button class="danger" type="submit">刪除</button></form>'

def playback_panel(row, cover, cfg):
    date=f'<span>直播日期：{esc(row["live_date"])}</span>' if row['live_date'] else ''
    category=f'<span>分類：{esc(row["category_name"])}</span>' if row['category_name'] else ''
    member=f'<span>{esc(row["member"])}</span>' if row['member'] else ''
    meta=' · '.join(x for x in (category,date) if x)
    groupcrumb=f'<a href="/?group={row["group_id"]}">{esc(row["group_name"])}</a><span aria-hidden="true">›</span>' if row['group_id'] and row['group_name'] else ''
    content_type=row['content_type'] if 'content_type' in row.keys() else 'video'
    return f'''<nav class="breadcrumbs" aria-label="文章路徑"><a class="home-crumb" href="/">{icon('home')}<span>首頁</span></a><span aria-hidden="true">›</span>{groupcrumb}<span aria-current="page">{esc(row['title'])}</span></nav><article class="episode-article {"podcast-theme" if content_type=="podcast" else "video-theme"}" data-slug="{esc(row['slug'])}" data-title="{esc(row['title'])}"><div class="episode-meta-top"><span class="badge">{esc(row['group_name'] or ('Podcast' if content_type=='podcast' else '影音紀錄'))}</span><span class="meta">{meta}</span></div><h1>{esc(row['title'])}</h1>{f'<p class="meta">{member}</p>' if member else ''}<p>{esc(row['summary'])}</p>
    <div class="episode-main"><div class="playback-column"><div class="video-toolbar"><a class="source" href="{esc(row['source_url'])}" target="_blank" rel="noopener noreferrer">{icon('external')}<span>在 YouTube 觀看原始影片</span></a></div><div id="player-anchor"><div class="player-box" id="player-box"><button class="theater-close" type="button" aria-label="關閉劇院模式">×</button><div class="youtube-placeholder" data-youtube="{esc(row['youtube_id'])}">{cover}<button class="load-player" type="button" aria-label="載入並播放 YouTube 影片">{icon('play')}<span>載入 YouTube 播放器</span></button></div>
    <div class="live-caption" data-language="zh" aria-live="off"><div class="caption-heading"><div class="caption-tool"><div class="caption-languages" role="group" aria-label="播放字幕語言"><button type="button" data-caption-lang="zh" aria-pressed="true">繁中</button><button type="button" data-caption-lang="ko" aria-pressed="false">韓文</button><button type="button" data-caption-lang="both" aria-pressed="false">雙語</button></div></div><div class="caption-tool"><div class="caption-size" role="group" aria-label="調整播放字幕字級"><button type="button" data-caption-size="-1" aria-label="縮小播放字幕">A−</button><span id="caption-size-value" aria-live="polite">12pt</span><button type="button" data-caption-size="1" aria-label="放大播放字幕">A＋</button></div></div><div class="caption-tool"><button class="theater-toggle" type="button" aria-pressed="false">{icon('expand')}<span>劇院模式</span></button></div></div><div class="caption-row caption-zh"><span class="caption-lang">繁體中文</span><span id="live-zh">點播放後，字幕會顯示在這裡</span></div><div class="caption-row caption-ko"><span class="caption-lang">韓文</span><span id="live-ko"></span></div></div>
    <div class="listening-controls"><div class="transport"><button type="button" id="seek-back" class="seek-button" aria-label="倒退 10 秒">{icon('back')}<span>10</span></button><button type="button" id="play-toggle" class="round-play" aria-label="播放影片">{icon('play')}</button><button type="button" id="seek-forward" class="seek-button" aria-label="快進 10 秒">{icon('forward')}<span>10</span></button><label class="speed-control">速度 <select id="playback-rate" aria-label="播放速度"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div><input id="seek-progress" type="range" min="0" max="1000" value="0" aria-label="影片播放進度" disabled><span id="time-display" class="time-display">00:00 / --:--</span></div>
    <aside class="caption-notice">影片來源為 YouTube。本站字幕依來源字幕與語音內容整理，並使用 AI 輔助校對及翻譯。語音辨識與翻譯可能有誤，內容僅供參考；若發現字幕問題，歡迎透過<a class="report-link" href="/report/">「問題回報」</a>告訴我。</aside></div></div>
    <div class="episode-actions"><div class="share-panel" aria-label="分享文章"><strong>分享這篇</strong><div class="share-buttons"><a data-share="threads" target="_blank" rel="noopener noreferrer" aria-label="分享到 Threads" title="Threads"><span aria-hidden="true">@</span></a><a data-share="facebook" target="_blank" rel="noopener noreferrer" aria-label="分享到 Facebook" title="Facebook"><span aria-hidden="true">f</span></a><a data-share="line" target="_blank" rel="noopener noreferrer" aria-label="分享到 LINE" title="LINE"><span aria-hidden="true">LINE</span></a><a data-share="x" target="_blank" rel="noopener noreferrer" aria-label="分享到 X" title="X"><span aria-hidden="true">𝕏</span></a><button type="button" id="copy-url" aria-label="複製網址" title="複製網址">{icon('copy')}</button></div><small id="copy-status" role="status"></small></div>
    <div class="rating-panel"><strong>影片翻譯評分</strong><div class="rating-stars" role="group" aria-label="為影片翻譯評分">{''.join(f'<button type="button" data-rating="{i}" aria-label="{i} 星" aria-pressed="false">☆</button>' for i in range(1,6))}</div><small id="rating-status">選擇 1～5 星</small></div></div></div>'''

def article_markup(row,cfg,others=()):
    lines=transcript(row['ko_srt'],row['zh_srt'])
    captions=''.join(f'<button class="line" data-time="{x["time"]}" type="button"><span class="stamp">{esc(x["stamp"])}</span><span class="words"><span class="ko">{esc(x["ko"])}</span><span class="zh">{esc(x["zh"])}</span></span></button>' for x in lines) or '<p class="empty">逐字稿整理中。</p>'
    cover=f'<img src="{esc(cover_path(row))}" alt="節目封面" loading="lazy">' if cover_path(row) else '<span>VOICE<br>LIVE</span><span class="cover-wave">〰〰〰</span>'
    return playback_panel(row,cover,cfg)+transcript_markup(captions,cfg)+'</div>'+((f'<section class="notes"><h2>{esc(cfg["notes_title"])}</h2><p>{esc(row["notes"]).replace(chr(10),"<br>")}</p></section>') if row['notes'] else '')+f'<h2>{esc(cfg["others_title"])}</h2><div class="list">{"".join(episode_card(x) for x in others) or "<div class=\"empty\">目前沒有其他場次。</div>"}</div></article>'

def static_links(markup, prefix):
    """Turn root-relative links into links within any GitHub Pages project folder."""
    def change(match):
        value=html.unescape(match.group(2))
        if value == '/': target=prefix+'index.html'
        elif value.startswith('/?'): target=prefix+'index.html'+value[1:]
        elif value == '/about/':
            target=prefix+'about/'
        elif value.startswith('/report/'):
            target=prefix+'report/'+(('?'+value.split('?',1)[1]) if '?' in value else '')
        elif value == '/podcast/':
            target=prefix+'podcast/'
        elif value == '/pop-live/':
            target=prefix+'pop-live/'
        elif value.startswith('/episode/'):
            target=prefix+value.strip('/')+'/'
        elif value.startswith('/podcast/'):
            target=prefix+value.strip('/')+'/'
        elif value.startswith('/static/'):
            target=prefix+value.lstrip('/')
        elif value.startswith('/media/episode/'):
            target=prefix+'static/covers/'+value.rsplit('/',1)[-1]
        else: target=value
        return match.group(1)+'"'+esc(target)+'"'
    return re.sub(r'((?:href|src|action)=)"(/[^"<>]*)"',change,markup)

def social_meta(title,description,url,image):
    tags={'og:type':'article','og:locale':'zh_TW','og:title':title,'og:description':description,'og:url':url,'og:image':image,'og:image:secure_url':image,'og:image:alt':title}
    twitter={'twitter:card':'summary_large_image','twitter:title':title,'twitter:description':description,'twitter:image':image,'twitter:image:alt':title}
    return ''.join(f'<meta property="{esc(key)}" content="{esc(value)}">' for key,value in tags.items())+''.join(f'<meta name="{esc(key)}" content="{esc(value)}">' for key,value in twitter.items())+f'<link rel="canonical" href="{esc(url)}">'

def encrypt_private(markup,password):
    """Authenticated password encryption implemented with standard HMAC primitives."""
    salt,nonce=secrets.token_bytes(16),secrets.token_bytes(16)
    key=hashlib.pbkdf2_hmac('sha256',password.encode('utf-8'),salt,200000,64)
    raw=markup.encode('utf-8'); cipher=bytearray()
    for counter,start in enumerate(range(0,len(raw),32)):
        stream=hmac.new(key[:32],nonce+counter.to_bytes(4,'big'),hashlib.sha256).digest()
        cipher.extend(a^b for a,b in zip(raw[start:start+32],stream))
    tag=hmac.new(key[32:],nonce+bytes(cipher),hashlib.sha256).digest()
    return {k:base64.b64encode(v).decode('ascii') for k,v in {'salt':salt,'nonce':nonce,'cipher':bytes(cipher),'tag':tag}.items()}

def private_shell(title,payload,cfg,heading='這是一篇私密影音紀錄',description='請輸入本站管理員提供的密碼。'):
    # A script element is a raw-text element: HTML entities are not decoded in it.
    # Escape only characters that could terminate the element, leaving valid JSON.
    data=json.dumps(payload,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    body=f'''<article class="private-gate"><div class="private-lock">{icon('lock')}<h1>{esc(heading)}</h1><p>{esc(description)}</p><form id="private-unlock" class="form"><label>觀看密碼<input name="password" type="password" required autocomplete="off"></label><button class="primary">進入 POP Live</button><p id="private-error" role="alert"></p></form></div><div id="private-content" hidden></div><script id="private-payload" type="application/json">{data}</script><script src="/static/private.js?v={ASSET_BUILD}" defer></script></article>'''
    return page(title,body,cfg)

def export_pages(db, server, private_password=''):
    """Create a public-only archive; the SQLite database never enters this ZIP."""
    cfg=setting(db)
    site_url=cfg.get('site_url','').rstrip('/')+'/'
    parsed_url=urllib.parse.urlsplit(site_url)
    if parsed_url.scheme!='https' or not parsed_url.hostname or parsed_url.query or parsed_url.fragment or parsed_url.username:
        raise ValueError('請先在「網站文字與外觀」設定 HTTPS GitHub Pages 網址。')
    logo_data=cfg.get('logo_data','')
    logo_asset=None
    if logo_data:
        logo_bytes=base64.b64decode(logo_data.split(',',1)[1])
        logo_asset='static/logo.'+image_type(logo_bytes)[0]
        cfg={**cfg,'logo_data':'','logo_url':'/'+logo_asset}
    rows=db.execute('''SELECT e.*,g.name group_name,c.name category_name FROM episodes e
        LEFT JOIN groups g ON g.id=e.group_id LEFT JOIN categories c ON c.id=e.category_id
        WHERE e.status IN ('published','private') ORDER BY e.live_date DESC,e.id DESC''').fetchall()
    if any(row['status']=='private' for row in rows) and len(private_password)<8:
        raise ValueError('目前有私密文章，匯出密碼至少需要 8 個字元。')
    groups=db.execute('SELECT * FROM groups ORDER BY sort_order,id').fetchall()
    video_rows=[r for r in rows if r['content_type']=='video' and r['status']=='published']
    podcast_rows=[r for r in rows if r['content_type']=='podcast' and r['status']=='published']
    private_rows=[r for r in rows if r['status']=='private']
    body=home_markup(video_rows,groups,cfg,'video')
    home=static_links(page(cfg['page_name'],body,cfg), '')
    home=home.replace('</head>',social_meta(cfg['site_name'],cfg['hero_subtitle'],site_url,urllib.parse.urljoin(site_url,'static/share-default.png'))+'</head>')
    endpoint=f'http://127.0.0.1:{server.server_port}'
    bundle=io.BytesIO()
    with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('.nojekyll','')
        if logo_asset:
            archive.writestr(logo_asset,logo_bytes)
        archive.writestr('index.html',home)
        archive.writestr('about/index.html',static_links(page(cfg['about_title'],about_markup(cfg),cfg),'../'))
        archive.writestr('report/index.html',static_links(page('問題回報',report_markup(cfg),cfg),'../'))
        podcast_home=static_links(page(cfg['podcast_title'],home_markup(podcast_rows,groups,cfg,'podcast',podcast_member_groups(db)),cfg).replace('class="public-page"','class="public-page podcast-index"'),'../')
        archive.writestr('podcast/index.html',podcast_home)
        if private_rows:
            pop_body=f'<section class="hero pop-live-hero"><span class="eyebrow">PRIVATE ARCHIVE</span><h1>{esc(cfg.get("pop_live_title","POP Live"))}</h1><p>{esc(cfg.get("pop_live_subtitle","限定分享的影音收藏"))}</p></section><div id="static-list" class="list">'+''.join(episode_card(r) for r in private_rows)+'</div><nav id="home-pages" class="home-pages" aria-label="文章分頁"></nav><script src="/static/export.js?v='+ASSET_BUILD+'" defer></script>'
            pop_page=private_shell(cfg.get('pop_live_title','POP Live'),encrypt_private(static_links(pop_body,'../'),private_password),cfg,cfg.get('pop_live_title','POP Live'),'請輸入本站管理員提供的密碼，進入限定分享內容。')
        else:
            pop_page=page(cfg.get('pop_live_title','POP Live'),'<p class="empty">目前尚無 POP Live 內容。</p>',cfg)
        archive.writestr('pop-live/index.html',static_links(pop_page,'../'))
        for name in ('style.css','app.js','export.js','private.js','share-default.png','hero.webp','podcast-hero.webp'):
            archive.write(STATIC/name,'static/'+name)
        for row in rows:
            if row['cover_mime'] and row['cover_image']:
                archive.writestr('static/covers/'+cover_path(row).rsplit('/',1)[-1],row['cover_image'])
            others=[r for r in rows if r['status']=='published' and r['id']!=row['id']][:4]
            article_body=article_markup(row,cfg,others)
            article=page(row['title'],article_body,cfg).replace('class="public-page"',f'class="public-page {"podcast-page" if row["content_type"]=="podcast" else "video-page"}"')
            if logo_asset:
                article=article.replace(esc(logo_data),'/'+logo_asset)
            article_url=urllib.parse.urljoin(site_url,'episode/'+row['slug']+'/')
            cover=urllib.parse.urljoin(site_url,'static/covers/'+cover_path(row).rsplit('/',1)[-1]) if row['cover_mime'] and row['cover_image'] else row['cover_url'] if row['cover_url'].startswith('https://') else urllib.parse.urljoin(site_url,'static/share-default.png')
            if row['cover_mime'] and row['cover_image']:
                cover+='?v='+hashlib.sha256(row['cover_image']).hexdigest()[:12]
            if row['status']=='private':
                article=private_shell('私密影音紀錄',encrypt_private(static_links(article_body,'../../'),private_password),cfg)
                meta_title,meta_description,meta_cover='私密影音紀錄','此內容需要密碼才能閱讀。',urllib.parse.urljoin(site_url,'static/share-default.png')
            else:
                meta_title,meta_description,meta_cover=row['title'],row['summary'] or cfg['hero_subtitle'],cover
            article=article.replace('</head>',social_meta(meta_title,meta_description,article_url,meta_cover)+'</head>')
            article=static_links(article,'../../')
            archive.writestr('episode/'+row['slug']+'/index.html',article)
            legacy='<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../../episode/'+esc(row['slug'])+'/"><title>頁面已移動</title><a href="../../episode/'+esc(row['slug'])+'/">前往文章</a>'
            archive.writestr('podcast/'+row['slug']+'/index.html',legacy)
    return bundle.getvalue(),len(rows)

class Handler(BaseHTTPRequestHandler):
    def send(self, status, body, content_type='text/html; charset=utf-8', headers=None):
        payload = body.encode('utf-8') if isinstance(body, str) else body
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; script-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; base-uri 'self'; form-action 'self' https:")
        if headers:
            for k,v in headers.items(): self.send_header(k,v)
        self.end_headers()
        self.wfile.write(payload)

    def redirect(self, url, cookie=None):
        headers = {'Location': url}
        if cookie: headers['Set-Cookie'] = cookie
        self.send(303, b'', headers=headers)

    def session(self, db):
        jar = SimpleCookie()
        try: jar.load(self.headers.get('Cookie',''))
        except Exception: return None
        token = jar['voice_session'].value if 'voice_session' in jar else ''
        if not token: return None
        return db.execute('SELECT * FROM sessions WHERE token_hash=? AND expires>?', (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()

    def auth(self, db):
        s = self.session(db)
        if not s:
            query=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            self.redirect('/admin/login?session=lost' if query.get('from')==['login'] else '/admin/login')
        return s

    def csrf(self, db, data):
        s = self.session(db)
        if not s or not hmac.compare_digest(data.get('csrf',''), s['csrf']):
            self.send(403, '無效的登入狀態或表單，請重新整理後再試。', 'text/plain; charset=utf-8')
            return None
        return s

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ('/static/style.css','/static/app.js','/static/export.js','/static/private.js','/static/share-default.png','/static/hero.webp'):
            file = STATIC / path.split('/')[-1]
            mimetype='text/css; charset=utf-8' if file.suffix=='.css' else 'image/png' if file.suffix=='.png' else 'image/webp' if file.suffix=='.webp' else 'text/javascript; charset=utf-8'
            self.send(200, file.read_bytes(), mimetype, {'Cache-Control':'public, max-age=3600'})
            return
        with conn() as db:
            cfg = setting(db)
            if path.startswith('/media/episode/'):
                match=re.fullmatch(r'/media/episode/(\d+)\.(png|jpg|webp)',path)
                row=db.execute('SELECT id,cover_image,cover_mime,status FROM episodes WHERE id=?',(match[1],)).fetchone() if match else None
                if not row or not row['cover_image'] or (row['status']!='published' and not self.session(db)):
                    self.send(404,'找不到圖片','text/plain; charset=utf-8');return
                ext=image_type(row['cover_image'])
                if not ext or ext[0]!=match[2]:self.send(404,'找不到圖片','text/plain; charset=utf-8');return
                self.send(200,row['cover_image'],ext[1],{'Cache-Control':'public, max-age=3600'});return
            if path == '/about/':
                self.send(200,page(cfg['about_title'],about_markup(cfg),cfg));return
            if path == '/report/':
                article=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('article',[''])[0]
                self.send(200,page('問題回報',report_markup(cfg,article),cfg));return
            if path == '/':
                rows=db.execute("""SELECT e.*,g.name group_name,c.name category_name FROM episodes e
                    LEFT JOIN groups g ON g.id=e.group_id LEFT JOIN categories c ON c.id=e.category_id
                    WHERE e.status='published' AND e.content_type='video' ORDER BY e.live_date DESC,e.id DESC""").fetchall()
                groups=db.execute('SELECT * FROM groups ORDER BY sort_order,id').fetchall()
                self.send(200,page('影音紀錄',home_markup(rows,groups,cfg,'video'),cfg));return
            if path == '/podcast/':
                rows=db.execute("""SELECT e.*,g.name group_name,c.name category_name FROM episodes e
                    LEFT JOIN groups g ON g.id=e.group_id LEFT JOIN categories c ON c.id=e.category_id
                    WHERE e.status='published' AND e.content_type='podcast' ORDER BY e.live_date DESC,e.id DESC""").fetchall()
                groups=db.execute('SELECT * FROM groups ORDER BY sort_order,id').fetchall()
                self.send(200,page(cfg['podcast_title'],home_markup(rows,groups,cfg,'podcast',podcast_member_groups(db)),cfg).replace('class="public-page"','class="public-page podcast-index"'));return
            if path == '/pop-live/':
                body=f'<article class="private-local"><div class="private-lock">{icon("lock")}<h1>{esc(cfg.get("pop_live_title","POP Live"))}</h1><p>POP Live 會在匯出的 GitHub Pages 網站輸入密碼後開啟；本機可由後台預覽私密文章。</p></div></article>'
                self.send(200,page(cfg.get('pop_live_title','POP Live'),body,cfg));return
            if path.startswith('/episode/') or (path.startswith('/podcast/') and path!='/podcast/'):
                slug = path.split('/',2)[2]
                row = db.execute('SELECT e.*,g.name group_name,c.name category_name FROM episodes e LEFT JOIN groups g ON g.id=e.group_id LEFT JOIN categories c ON c.id=e.category_id WHERE e.slug=? AND e.status IN ("published","private")',(slug,)).fetchone()
                if not row: self.send(404,page('找不到文章','<div class="empty">找不到這篇公開文章。<a href="/">返回首頁</a></div>',cfg)); return
                if row['status']=='private' and not self.session(db):
                    body=f'<article class="private-local"><div class="private-lock">{icon("lock")}<h1>這是一篇私密影音紀錄</h1><p>私密文章只會在匯出的 GitHub Pages 網站使用共用密碼解鎖；本機請從後台預覽。</p></div></article>'
                    self.send(200,page('私密文章',body,cfg));return
                others = db.execute('SELECT e.*,g.name group_name FROM episodes e LEFT JOIN groups g ON g.id=e.group_id WHERE e.status="published" AND e.id<>? ORDER BY e.live_date DESC,e.id DESC LIMIT 4',(row['id'],)).fetchall()
                body = article_markup(row,cfg,others)
                self.send(200,page(row['title'],body,cfg).replace('class="public-page"',f'class="public-page {"podcast-page" if row["content_type"]=="podcast" else "video-page"}"')); return
            if path == '/admin/login':
                query=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                notice='<p class="empty">密碼正確，但瀏覽器未保留登入狀態。請允許 127.0.0.1 的 Cookie，並使用同一個網址 http://127.0.0.1:8776/admin 再試。</p>' if query.get('session')==['lost'] else ''
                body = '<h1>後台登入</h1>'+notice+'<form method="post" action="/admin/login" class="form"><label>管理密碼<input name="password" type="password" required autocomplete="current-password"></label><button class="primary">登入</button></form>'
                self.send(200,page('登入',body,cfg)); return
            if path == '/admin/logout':
                s=self.auth(db)
                if not s:return
                body=f'<h1>登出後台</h1><form method="post" action="/admin/logout"><input type="hidden" name="csrf" value="{esc(s["csrf"])}"><button class="primary">確認登出</button></form>'
                self.send(200,page('登出',body,cfg,True));return
            if path.startswith('/admin'):
                s=self.auth(db)
                if not s:return
                token=esc(s['csrf'])
                if path == '/admin':
                    query={k:urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get(k,[''])[0][:100] for k in ('q','group','category','member','page')}
                    term,group,category,member=query['q'],query['group'],query['category'],query['member']
                    current=max(1,int(query['page'])) if query['page'].isdigit() else 1
                    where=''' FROM episodes e LEFT JOIN groups g ON g.id=e.group_id LEFT JOIN categories c ON c.id=e.category_id
                        WHERE (?='' OR e.title LIKE ? OR e.member LIKE ? OR g.name LIKE ? OR c.name LIKE ?)
                        AND (?='' OR CAST(e.group_id AS TEXT)=?) AND (?='' OR CAST(e.category_id AS TEXT)=?) AND (?='' OR e.member LIKE ?)'''
                    params=(term,*(['%'+term+'%']*4),group,group,category,category,member,'%'+member+'%')
                    total=db.execute('SELECT COUNT(*) FROM episodes').fetchone()[0]
                    count=db.execute('SELECT COUNT(*)'+where,params).fetchone()[0]
                    pages=max(1,(count+9)//10);current=min(current,pages)
                    rows=db.execute('SELECT e.*,g.name group_name,c.name category_name'+where+' ORDER BY e.id DESC LIMIT 10 OFFSET ?',params+((current-1)*10,)).fetchall()
                    groups=db.execute('SELECT id,name FROM groups ORDER BY sort_order,id').fetchall()
                    categories=db.execute('SELECT id,name FROM categories ORDER BY sort_order,id').fetchall()
                    members=db.execute('SELECT DISTINCT name FROM member_tags ORDER BY name').fetchall()
                    options=lambda items,value: '<option value="">全部</option>'+''.join(f'<option value="{esc(r["id"] if "id" in r.keys() else r["name"])}" {"selected" if str(r["id"] if "id" in r.keys() else r["name"])==value else ""}>{esc(r["name"])}</option>' for r in items)
                    links=[('匯出 GitHub Pages','/admin/export'),('網站文字與外觀','/admin/settings'),('首頁區塊','/admin/settings/home'),('關於我','/admin/settings/about'),('下載資料庫備份','/admin/backup')]
                    body=f'<div class="admin-title"><h1>文章管理</h1><span><a class="button primary" href="/admin/episode/new?type=video">＋新增影音</a> <a class="button podcast-button" href="/admin/episode/new?type=podcast">＋新增 Podcast</a> <a class="button pop-live-button" href="/admin/episode/new?type=video&status=private">＋新增 POP Live</a></span></div><div class="admin-links compact-links">'+''.join(f'<a href="{url}">{label}</a>' for label,url in links)+'</div>'
                    body+=f'''<form class="admin-filters" action="/admin"><label>搜尋文章<input name="q" value="{esc(term)}" placeholder="標題或關鍵字"></label><label>團體<select name="group">{options(groups,group)}</select></label><label>分類<select name="category">{options(categories,category)}</select></label><label>成員<select name="member">{options(members,member)}</select></label><button class="primary">搜尋／篩選</button><a class="button" href="/admin">清除</a></form><p class="admin-count">目前共 {total} 篇文章；符合條件 {count} 篇 · 第 {current}/{pages} 頁</p>'''
                    body+='<div class="admin-table"><div class="admin-table-head"><span>文章標題</span><span>發文時間</span><span>團體／分類</span><span>成員</span><span>狀態</span><span>操作</span></div>'
                    body+=''.join(f'<div class="admin-table-row"><strong>{esc(r["title"])}<small>{"Podcast" if r["content_type"]=="podcast" else "影音紀錄"}</small></strong><span data-label="發文時間">{esc(display_date(r["published_at"]))}</span><span data-label="團體／分類">{esc(r["group_name"] or "未設定")}／{esc(r["category_name"] or "未設定")}</span><span data-label="成員">{esc(r["member"] or "未設定")}</span><span data-label="狀態">{"公開" if r["status"]=="published" else "私密" if r["status"]=="private" else "草稿"}</span><span class="admin-row-actions"><a class="button" href="/admin/episode/{r["id"]}">編輯</a>{delete_form(r["id"],token)}</span></div>' for r in rows)+'</div>' if rows else '<p class="empty">沒有符合的文章。</p>'
                    def page_link(number):return '/admin?'+urllib.parse.urlencode({**{k:v for k,v in query.items() if k!='page' and v},'page':number})
                    nearby=range(max(1,current-2),min(pages,current+2)+1)
                    page_buttons=''.join(f'<a class="page-number {"active" if n==current else ""}" href="{esc(page_link(n))}" aria-current="{"page" if n==current else "false"}">{n}</a>' for n in nearby)
                    jump_hidden=''.join(f'<input type="hidden" name="{esc(k)}" value="{esc(v)}">' for k,v in query.items() if k!='page' and v)
                    body+='<nav class="admin-pagination rounded-pagination" aria-label="文章分頁">'+(f'<a class="page-button" href="{esc(page_link(current-1))}">← 上一頁</a>' if current>1 else '<span class="page-button disabled">← 上一頁</span>')+page_buttons+(f'<a class="page-button" href="{esc(page_link(current+1))}">下一頁 →</a>' if current<pages else '<span class="page-button disabled">下一頁 →</span>')+f'<form class="page-jump" action="/admin">{jump_hidden}<label>前往第 <input name="page" type="number" min="1" max="{pages}" value="{current}" inputmode="numeric" aria-label="輸入頁碼"> 頁</label><button>前往</button></form></nav>'
                    self.send(200,page('後台',body,cfg,True));return
                if path.startswith('/admin/episode/'):
                    ident=path.split('/')[-1]
                    row=None if ident=='new' else db.execute('SELECT * FROM episodes WHERE id=?',(ident,)).fetchone()
                    if ident!='new' and not row:self.send(404,'找不到文章');return
                    val=lambda k: esc(row[k] if row else '')
                    groups=db.execute('SELECT * FROM groups ORDER BY sort_order,id').fetchall()
                    options='<option value="">未分類</option>'+''.join(f'<option value="{g["id"]}" {"selected" if row and row["group_id"]==g["id"] else ""}>{esc(g["name"])}</option>' for g in groups)
                    categories=db.execute('SELECT * FROM categories ORDER BY sort_order,id').fetchall()
                    category_options='<option value="">未分類</option>'+''.join(f'<option value="{c["id"]}" {"selected" if row and row["category_id"]==c["id"] else ""}>{esc(c["name"])}</option>' for c in categories)
                    tag_catalog=[{'group':r['group_id'],'name':r['name'],'display':r['display_name'] or r['name']} for r in db.execute('SELECT * FROM member_tags WHERE visible=1 ORDER BY sort_order,name')]
                    if row: options=options.replace('<option value="">','<option value="">',1)
                    requested=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('type',['video'])[0]
                    requested_status=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('status',['draft'])[0]
                    content_type=(row['content_type'] if row else requested) if (row and row['content_type'] in ('video','podcast')) or requested in ('video','podcast') else 'video'
                    body=f'''<a class="back" href="/admin">← 返回文章列表</a><h1>{'編輯文章' if row else '新增文章'}</h1>{('<p><a class="button" target="_blank" href="/admin/preview/'+str(row['id'])+'">預覽這篇文章</a></p>') if row else ''}<form class="form episode-form" method="post" action="/admin/episode/save" enctype="multipart/form-data" data-was-status="{row['status'] if row else 'draft'}"><input type="hidden" name="csrf" value="{token}"><input type="hidden" name="id" value="{val('id')}"><input type="hidden" name="confirm_publish" value="0">
                    <h2>① 基本資料</h2><label>文章類型<select name="content_type"><option value="video" {"selected" if content_type=="video" else ""}>影音紀錄</option><option value="podcast" {"selected" if content_type=="podcast" else ""}>Podcast／廣播</option></select></label><label>文章標題 *<input name="title" value="{val('title')}" required maxlength="150"></label><label>網址尾段（英文、數字及連字號；公開後保持不變）<input name="slug" value="{val('slug')}" placeholder="wego6-20260920-podcast" pattern="[a-z0-9-]*"></label><div class="two"><label>團體<select name="group_id" id="group-select">{options}</select></label><label>分類<select name="category_id">{category_options}</select></label></div><div class="member-editor" data-catalog="{esc(json.dumps(tag_catalog,ensure_ascii=False))}"><label>成員標籤<input id="member-input" autocomplete="off" placeholder="輸入姓名後按 Enter 或逗號"></label><p class="hint">先在「資料管理 → 成員」建立正式名單；選擇團體後，這裡會顯示已建立的成員建議。</p><div id="member-suggestions" class="member-suggestions" aria-label="已記住的成員"></div><div id="member-chips" class="member-chips"></div><input type="hidden" name="member" value="{val('member')}"></div><label>原直播日期<input name="live_date" type="date" value="{val('live_date')}"></label><label>簡短介紹<textarea name="summary" rows="3">{val('summary')}</textarea></label>
                    <h2>② 播放來源與文章縮圖</h2><label>YouTube 影片網址 *<input name="source_url" type="url" value="{val('source_url')}" required placeholder="https://www.youtube.com/watch?v=..."></label><label>上傳文章縮圖（PNG／JPG／WebP，2 MB 以下）<input type="file" name="cover_file" accept="image/png,image/jpeg,image/webp"></label>{('<p class="hint">目前縮圖：<img class="admin-cover-preview" src="'+esc(cover_path(row))+'" alt="目前縮圖"> <label class="check"><input type="checkbox" name="remove_cover_image" value="1">移除已上傳縮圖</label></p>') if row and row['cover_mime'] else ''}<p class="hint">同一張縮圖用於首頁、播放器載入前畫面與分享預覽，並保存在資料庫備份中。</p>
                    <h2>③ 雙語逐字稿</h2><p class="hint">可上傳 UTF-8 SRT 或 SBV，也能在下面直接貼上或修改。上傳檔案會取代對應文字框內容。</p><label>韓文 SRT／SBV 檔案<input type="file" name="ko_file" accept=".srt,.sbv,text/plain"></label><label>韓文字幕內容<textarea name="ko_srt" rows="8" spellcheck="false">{val('ko_srt')}</textarea></label><label>繁中 SRT／SBV 檔案<input type="file" name="zh_file" accept=".srt,.sbv,text/plain"></label><label>繁中字幕內容<textarea name="zh_srt" rows="8" spellcheck="false">{val('zh_srt')}</textarea></label>
                    <h2>④ 文章補充</h2><label>整理筆記（選填）<textarea name="notes" rows="5">{val('notes')}</textarea></label><h2>⑤ 發布設定</h2><label>狀態<select name="status"><option value="draft" {"selected" if (row and row['status']=='draft') or (not row and requested_status!='private') else ''}>儲存草稿</option><option value="published" {"selected" if row and row['status']=='published' else ''}>公開發布</option><option value="private" {"selected" if (row and row['status']=='private') or (not row and requested_status=='private') else ''}>POP Live 私密文章</option></select></label><p class="hint">POP Live 文章會在匯出時使用當次輸入的共用密碼加密。</p><button class="primary">儲存文章</button>{('<a class="button" href="/episode/'+esc(row['slug'])+'" target="_blank">查看頁面</a>') if row and row['status'] in ('published','private') else ''}</form>{('<div class="edit-delete"><h2>刪除文章</h2><p>後台無法直接復原，請先下載資料庫備份。</p>'+delete_form(row['id'],token)+'</div>') if row else ''}'''
                    self.send(200,page('編輯文章',body,cfg,True));return
                if path.startswith('/admin/preview/'):
                    ident=path.split('/')[-1]
                    row=db.execute('SELECT e.*,g.name group_name,c.name category_name FROM episodes e LEFT JOIN groups g ON g.id=e.group_id LEFT JOIN categories c ON c.id=e.category_id WHERE e.id=?',(ident,)).fetchone()
                    if not row:self.send(404,'找不到文章');return
                    lines=transcript(row['ko_srt'],row['zh_srt'])
                    captions=''.join(f'<button class="line" data-time="{x["time"]}" type="button"><span class="stamp">{esc(x["stamp"])}</span><span class="words"><span class="ko">{esc(x["ko"])}</span><span class="zh">{esc(x["zh"])}</span></span></button>' for x in lines) or '<p class="empty">逐字稿整理中。</p>'
                    cover=f'<img src="{esc(cover_path(row))}" alt="節目封面" loading="lazy">' if cover_path(row) else '<span>VOICE<br>LIVE</span><span class="cover-wave">〰〰〰</span>'
                    body=f'<p class="badge">後台預覽</p><p><a href="/admin/episode/{row["id"]}">← 返回編輯</a></p>'+playback_panel(row,cover,cfg)+transcript_markup(captions,cfg)+'</div></article>'
                    self.send(200,page('文章預覽',body,cfg,True));return
                if path == '/admin/settings/home':
                    orders=[('hero,filters,latest','介紹 → 搜尋 → 最近更新'),('filters,latest,hero','搜尋 → 最近更新 → 介紹'),('latest,filters,hero','最近更新 → 搜尋 → 介紹')]
                    body=f'''<a class="back" href="/admin">← 返回後台</a><h1>首頁區塊</h1><form class="form" method="post" action="/admin/settings/home"><input type="hidden" name="csrf" value="{token}"><label>團體專欄標題<input name="groups_title" value="{esc(cfg['groups_title'])}"></label><label>最近更新標題<input name="latest_title" value="{esc(cfg['latest_title'])}"></label><label>隨機推薦標題<input name="recommend_title" value="{esc(cfg['recommend_title'])}"></label><label>Podcast 標題<input name="podcast_title" value="{esc(cfg['podcast_title'])}"></label><label>Podcast 簡介<input name="podcast_subtitle" value="{esc(cfg['podcast_subtitle'])}"></label><label>POP Live 導覽名稱<input name="pop_live_title" value="{esc(cfg['pop_live_title'])}"></label><label>POP Live 密碼頁簡介<input name="pop_live_subtitle" value="{esc(cfg['pop_live_subtitle'])}"></label><label>排列順序<select name="home_order">{''.join(f'<option value="{v}" {"selected" if cfg["home_order"]==v else ""}>{label}</option>' for v,label in orders)}</select></label>{''.join(f'<label class="check"><input type="checkbox" name="show_{k}" value="1" {"checked" if cfg["show_"+k]=="1" else ""}>顯示{label}</label>' for k,label in [('hero','介紹'),('filters','團體與搜尋'),('latest','最近更新'),('recommend','隨機推薦')])}<p class="hint">影音紀錄、Podcast 與 POP Live 各自獨立；私密文章只會出現在 POP Live。前台列表每頁固定顯示 10 篇。</p><button class="primary">儲存首頁設定</button></form>'''
                    self.send(200,page('首頁區塊',body,cfg,True));return
                if path == '/admin/settings/identity':
                    body=f'''<a class="back" href="/admin">← 返回後台</a><h1>識別與字體</h1><form class="form" method="post" action="/admin/settings/identity" enctype="multipart/form-data"><input type="hidden" name="csrf" value="{token}"><label>上傳網站 Logo（PNG／JPG／WebP，2 MB 以下）<input type="file" name="logo_file" accept=".png,.jpg,.jpeg,.webp"></label><label class="check"><input type="checkbox" name="remove_logo" value="1">移除已上傳 Logo</label><label>Logo 尺寸（px）<input name="logo_size" type="number" min="24" max="80" value="{esc(cfg['logo_size'])}"></label><label>Logo 圖片網址（選填）<input name="logo_url" type="url" value="{esc(cfg['logo_url'])}"></label><label>字體樣式表網址（選填）<input name="font_url" type="url" value="{esc(cfg['font_url'])}"></label><label>內文字級 px<input name="body_size" type="number" min="15" max="22" value="{esc(cfg['body_size'])}"></label><label>主標題字級 px<input name="title_size" type="number" min="25" max="40" value="{esc(cfg['title_size'])}"></label><label>卡片圓角 px<input name="corner" type="number" min="0" max="30" value="{esc(cfg['corner'])}"></label><button class="primary">儲存識別設定</button></form>'''
                    self.send(200,page('識別與字體',body,cfg,True));return
                if path == '/admin/settings/about':
                    body=f'''<a class="back" href="/admin">← 返回後台</a><h1>關於我</h1><form class="form" method="post" action="/admin/settings/about"><input type="hidden" name="csrf" value="{token}"><label>頁面名稱<input name="about_title" value="{esc(cfg['about_title'])}"></label><label>介紹內容<textarea name="about_content" rows="10">{esc(cfg['about_content'])}</textarea></label><label>Threads 連結<input name="about_threads" type="url" value="{esc(cfg['about_threads'])}"></label><label>Instagram 連結<input name="about_instagram" type="url" value="{esc(cfg['about_instagram'])}"></label><label>YouTube 連結<input name="about_youtube" type="url" value="{esc(cfg['about_youtube'])}"></label><label>聯絡我信箱<input name="about_email" type="email" value="{esc(cfg['about_email'])}"></label><button class="primary">儲存關於我</button></form>'''
                    self.send(200,page('關於我',body,cfg,True));return
                if path == '/admin/settings/report':
                    body=f'''<a class="back" href="/admin">← 返回後台</a><h1>問題回報設定</h1><section class="setup-note"><strong>表單如何寄到妳的 Email？</strong><p>GitHub Pages 本身不能直接寄信，需要先在 Formspree、Web3Forms 或其他表單收件服務建立表單。服務會提供一組 HTTPS 收件網址；把它貼到下方後，讀者送出的內容就會由該服務轉寄到妳設定的 Email。</p><ol><li>到表單收件服務註冊並驗證妳的收件信箱</li><li>建立新表單並複製 Endpoint／收件網址</li><li>貼到下方、儲存，再從前台送一次測試回報</li></ol></section><form class="form" method="post" action="/admin/settings/report"><input type="hidden" name="csrf" value="{token}"><label>表單服務提供的 HTTPS 收件網址<input name="report_form_url" type="url" placeholder="例如 https://formspree.io/f/xxxxxxxx" value="{esc(cfg['report_form_url'])}"></label><p class="hint">網站不要求讀者填寫 Email 或電話，只會送出暱稱、問題類型、文章網址、影片時間點與說明。</p><label>問題類型（每行一項）<textarea name="report_types" rows="8">{esc(cfg['report_types'])}</textarea></label><button class="primary">儲存問題回報設定</button></form>'''
                    self.send(200,page('問題回報設定',body,cfg,True));return
                if path == '/admin/settings':
                    colors={'accent':'主要點綴色','secondary':'次要點綴色','background':'背景色','text_color':'文字色'}
                    body=f'''<a class="back" href="/admin">← 返回後台</a><h1>網站文字與外觀</h1><p class="hint">首頁區塊、識別與字體、關於我及問題回報已拆成獨立設定頁。</p><form class="form" method="post" action="/admin/settings"><input type="hidden" name="csrf" value="{token}"><label>網站名稱<input name="site_name" value="{esc(cfg['site_name'])}" maxlength="300"></label><label>網站副標題<input name="page_name" value="{esc(cfg['page_name'])}" maxlength="300"></label><label>頁尾簡介<input name="about_text" value="{esc(cfg['about_text'])}" maxlength="300"></label><label>頁尾製作署名<input name="footer_credit" value="{esc(cfg['footer_credit'])}" maxlength="300"></label><label>GitHub Pages 正式首頁網址<input name="site_url" type="url" placeholder="https://帳號.github.io/儲存庫名稱/" value="{esc(cfg['site_url'])}"></label><h2>網站配色</h2>{''.join(f'<label>{label}<input name="{key}" type="color" value="{esc(cfg[key])}"></label>' for key,label in colors.items())}<button class="primary">儲存設定</button><a class="button" href="/" target="_blank">查看前台</a></form><form method="post" action="/admin/settings/reset"><input type="hidden" name="csrf" value="{token}"><button class="button" type="submit">恢復預設配色</button></form>'''
                    self.send(200,page('網站文字與外觀',body,cfg,True));return
                    labels={'site_name':'網站名稱','page_name':'頁面名稱','hero_title':'首頁主標語','hero_subtitle':'首頁副標語','latest_title':'最近更新區標題','others_title':'相關場次區標題','transcript_title':'逐字稿區標題','notes_title':'整理筆記區標題','about_text':'頁尾說明','footer_credit':'頁尾製作署名','about_title':'關於我頁面名稱','groups_title':'團體專欄標題','recommend_title':'隨機推薦標題'}
                    colors={'accent':'主要點綴色','secondary':'次要點綴色','background':'背景色','text_color':'文字色'}
                    body=f'<a class="back" href="/admin">← 返回後台</a><h1>外觀與文案設定</h1><form class="form" method="post" action="/admin/settings" enctype="multipart/form-data"><input type="hidden" name="csrf" value="{token}"><h2>網站文字</h2>'
                    body+=''.join(f'<label>{label}<input name="{key}" value="{esc(cfg[key])}" maxlength="300"></label>' for key,label in labels.items())
                    body+=f'<label>關於我內容（分行顯示段落）<textarea name="about_content" rows="8" maxlength="10000">{esc(cfg["about_content"])}</textarea></label><label class="check"><input type="checkbox" name="show_recommend" value="1" {"checked" if cfg["show_recommend"]=="1" else ""}>顯示隨機推薦</label>'
                    body+=f'<label>GitHub Pages 正式首頁網址（分享縮圖必填）<input name="site_url" type="url" placeholder="https://帳號.github.io/儲存庫名稱/" value="{esc(cfg["site_url"])}"></label><p class="hint">請填首頁完整 HTTPS 網址，包含儲存庫名稱。匯出公開網站前先儲存。</p><label>問題回報網址（選填，建議填表單連結）<input name="report_url" type="url" placeholder="https://..." value="{esc(cfg["report_url"])}"></label><p class="hint">未填網址時，前台的「問題回報」會開啟讀者的電子郵件程式。若要集中收到回報，請填妳自己的表單網址。</p>'
                    body+='<h2>顏色與字級</h2>'+''.join(f'<label>{label}<input name="{key}" type="color" value="{esc(cfg[key])}"></label>' for key,label in colors.items())
                    body+=''.join(f'<label>{label}<input name="{key}" type="number" min="{lo}" max="{hi}" value="{esc(cfg[key])}"></label>' for key,label,lo,hi in [('body_size','逐字稿與內文字級 px',15,22),('title_size','主標題字級 px',25,40),('corner','卡片圓角 px',0,30)])
                    orders=[('hero,filters,latest','介紹 → 搜尋 → 最近更新'),('filters,latest,hero','搜尋 → 最近更新 → 介紹'),('latest,filters,hero','最近更新 → 搜尋 → 介紹')]
                    body+='<h2>首頁區塊</h2><label>排列順序<select name="home_order">'+''.join(f'<option value="{v}" {"selected" if cfg["home_order"]==v else ""}>{label}</option>' for v,label in orders)+'</select></label>'
                    body+=''.join(f'<label class="check"><input type="checkbox" name="show_{k}" value="1" {"checked" if cfg["show_"+k]=="1" else ""}>顯示{label}</label>' for k,label in [('hero','介紹'),('filters','團體與搜尋'),('latest','最近更新')])
                    body+=f'<h2>識別與字體</h2><label>上傳網站 Logo（PNG／JPG／WebP，2 MB 以下）<input type="file" name="logo_file" accept=".png,.jpg,.jpeg,.webp"></label><label class="check"><input type="checkbox" name="remove_logo" value="1">移除已上傳 Logo</label><label>Logo 尺寸（px）<input name="logo_size" type="number" min="24" max="80" value="{esc(cfg["logo_size"])}"></label><label>Logo 圖片網址（選填）<input name="logo_url" type="url" value="{esc(cfg["logo_url"])}"></label><label>源樣黑體樣式表網址（選填；請使用可信任的 HTTPS 來源）<input name="font_url" type="url" value="{esc(cfg["font_url"])}"></label><p class="hint">未填字體網址時使用裝置內建黑體，維持快速載入。發布前可先在前台確認效果。</p><button class="primary">儲存設定</button><a class="button" href="/" target="_blank">查看前台</a></form><form method="post" action="/admin/settings/reset"><input type="hidden" name="csrf" value="{token}"><button class="button" type="submit">恢復預設外觀</button></form>'
                    self.send(200,page('外觀設定',body,cfg,True));return
                if path == '/admin/groups':
                    groups=db.execute('SELECT * FROM groups ORDER BY sort_order,id').fetchall()
                    body=f'<a class="back" href="/admin">← 返回後台</a><h1>團體管理</h1><form class="form" method="post" action="/admin/groups"><input type="hidden" name="csrf" value="{token}"><label>新增團體名稱<input name="name" required maxlength="80"></label><button class="primary">新增團體</button></form><div class="list">'
                    body+=''.join(f'<form class="admin-row" method="post" action="/admin/groups/rename"><input type="hidden" name="csrf" value="{token}"><input type="hidden" name="id" value="{g["id"]}"><input name="name" value="{esc(g["name"])}" required maxlength="80"><button>修改名稱</button></form>' for g in groups)+'</div>'
                    self.send(200,page('團體管理',body,cfg,True));return
                if path == '/admin/members':
                    groups=db.execute('SELECT id,name FROM groups ORDER BY sort_order,id').fetchall()
                    members=db.execute('''SELECT m.rowid member_id,m.*,g.name group_name FROM member_tags m
                        JOIN groups g ON g.id=m.group_id ORDER BY g.sort_order,g.id,m.sort_order,m.rowid''').fetchall()
                    group_options=''.join(f'<option value="{g["id"]}">{esc(g["name"])}</option>' for g in groups)
                    rows=''.join(f'''<form class="member-manage-row" method="post" action="/admin/members/save"><input type="hidden" name="csrf" value="{token}"><input type="hidden" name="member_id" value="{m['member_id']}"><strong>{esc(m['group_name'])}</strong><label>篩選值<input name="name" value="{esc(m['name'])}" required maxlength="80"></label><label>顯示名稱<input name="display_name" value="{esc(m['display_name'] or m['name'])}" required maxlength="100"></label><label>順序<input name="sort_order" type="number" min="0" max="999" value="{m['sort_order']}"></label><label class="check"><input type="checkbox" name="visible" value="1" {"checked" if m['visible'] else ""}>前台顯示</label><button class="button">儲存</button><button class="danger" type="submit" formaction="/admin/members/delete" data-delete-member>刪除</button><input type="hidden" name="confirm_delete" value="0"></form>''' for m in members)
                    body=f'''<a class="back" href="/admin">← 返回後台</a><h1>成員管理</h1><p>成員會依所屬團體顯示在 Podcast 首頁的成員下拉選單。篩選值需與文章中的成員標籤一致；顯示名稱可自由使用中英文。</p>{('<form class="form member-create" method="post" action="/admin/members/save"><input type="hidden" name="csrf" value="{token}"><label>所屬團體<select name="group_id" required><option value="">請選擇團體</option>{group_options}</select></label><label>篩選值<input name="name" placeholder="例如 Wooyeon" required maxlength="80"></label><label>前台顯示名稱<input name="display_name" placeholder="例如 Wooyeon／鄭羽然" required maxlength="100"></label><label>排列順序<input name="sort_order" type="number" min="0" max="999" value="0"></label><label class="check"><input type="checkbox" name="visible" value="1" checked>顯示在前台</label><button class="primary">新增成員</button></form>' if groups else '<p class="empty">請先建立團體，再新增成員。</p>')}<h2>目前成員</h2><div class="member-manage-list">{rows or '<p class="empty">尚未新增成員。</p>'}</div>'''
                    self.send(200,page('成員管理',body,cfg,True));return
                if path == '/admin/categories':
                    categories=db.execute('SELECT * FROM categories ORDER BY sort_order,id').fetchall()
                    body=f'<a class="back" href="/admin">← 返回後台</a><h1>分類管理</h1><p>分類預設留空，妳可自行建立。</p><form class="form" method="post" action="/admin/categories"><input type="hidden" name="csrf" value="{token}"><label>新增分類名稱<input name="name" required maxlength="80"></label><button class="primary">新增分類</button></form><div class="list">'
                    body+=''.join(f'<form class="admin-row" method="post" action="/admin/categories/rename"><input type="hidden" name="csrf" value="{token}"><input type="hidden" name="id" value="{c["id"]}"><input name="name" value="{esc(c["name"])}" required maxlength="80"><button>修改名稱</button></form>' for c in categories)+'</div>'
                    self.send(200,page('分類管理',body,cfg,True));return
                if path == '/admin/storage':
                    db_size=DB.stat().st_size if DB.exists() else 0
                    images=db.execute('SELECT COUNT(*),COALESCE(SUM(length(cover_image)),0) FROM episodes WHERE cover_image IS NOT NULL').fetchone()
                    articles=db.execute('SELECT COUNT(*) FROM episodes').fetchone()[0]
                    body=f'''<a class="back" href="/admin">← 返回後台</a><h1>資料容量與整理</h1><div class="storage-cards"><div><strong>{articles}</strong><span>篇文章</span></div><div><strong>{db_size/1024/1024:.2f} MB</strong><span>資料庫大小</span></div><div><strong>{images[1]/1024/1024:.2f} MB</strong><span>{images[0]} 張縮圖</span></div></div><p>公開網站不會上傳這份資料庫，只會匯出公開與私密頁面所需的檔案。</p><form method="post" action="/admin/storage/compact" data-confirm="compact"><input type="hidden" name="csrf" value="{token}"><button class="button">先建立備份，再整理資料庫空間</button></form>'''
                    self.send(200,page('資料容量與整理',body,cfg,True));return
                if path == '/admin/backup':
                    try:
                        with tempfile.TemporaryDirectory() as tmp:
                            destination=Path(tmp)/'backup.sqlite3'
                            copy=sqlite3.connect(destination)
                            try:
                                db.backup(copy)
                            finally:
                                copy.close()  # On Windows an open SQLite handle blocks TemporaryDirectory cleanup.
                            payload=destination.read_bytes()
                        self.send(200,payload,'application/vnd.sqlite3',{'Content-Disposition':'attachment; filename="voice-archive-backup.sqlite3"','Cache-Control':'no-store'});return
                    except (OSError,sqlite3.Error) as error:
                        print(f'資料庫備份失敗：{error}',file=sys.stderr)
                        self.send(500,'備份失敗。請查看啟動網站的黑色視窗中的錯誤訊息。','text/plain; charset=utf-8');return
                if path == '/admin/export':
                    count=db.execute('SELECT COUNT(*) FROM episodes WHERE status="published"').fetchone()[0]
                    private_count=db.execute('SELECT COUNT(*) FROM episodes WHERE status="private"').fetchone()[0]
                    body=f'''<h1>匯出 GitHub Pages 網站</h1><p>目前有 {count} 篇公開文章、{private_count} 篇 POP Live 私密文章。草稿不會匯出。</p><p>分享縮圖需要正確的首頁網址。現在設定：{esc(cfg.get('site_url') or '尚未設定')}　<a href="/admin/settings">修改網站網址</a></p><p>下載 ZIP 並解壓後，把裡面的 <code>index.html</code>、<code>about/</code>、<code>report/</code>、<code>episode/</code>、<code>podcast/</code>、<code>pop-live/</code>、<code>static/</code> 與 <code>.nojekyll</code> 上傳到 GitHub 儲存庫根目錄。</p><form class="form export-form" method="post" action="/admin/export/download"><input type="hidden" name="csrf" value="{token}"><label>POP Live 共用密碼（有私密文章時至少 8 個字元）<input name="private_password" type="password" minlength="8" {"required" if private_count else ""} autocomplete="new-password"></label><p class="hint">密碼只用於本次匯出，不會儲存在資料庫。關閉分頁後會清除；每次重新匯出都要再次輸入。</p><button class="primary">下載公開網站 ZIP</button></form><p><a class="button" href="/admin/backup">另外下載私人的資料庫備份</a></p>'''
                    self.send(200,page('匯出網站',body,cfg,True));return
                if path == '/admin/export/download':
                    try: payload,count=export_pages(db,self.server)
                    except ValueError as error:
                        self.send(400,page('請設定網站網址',f'<h1>匯出前要設定網站網址</h1><p>{esc(error)}</p><a class="button" href="/admin/settings">前往網站設定</a>',cfg,True));return
                    except Exception as error:
                        print(f'匯出公開網站失敗：{error}',file=sys.stderr)
                        self.send(500,'網站匯出失敗，請確認文章網址與資料，再重試。','text/plain; charset=utf-8');return
                    self.send(200,payload,'application/zip',{'Content-Disposition':'attachment; filename="podcast-github-pages.zip"','Cache-Control':'no-store'});return
        self.send(404,'找不到頁面','text/plain; charset=utf-8')

    def do_POST(self):
        path=urllib.parse.urlparse(self.path).path
        try: data=form_data(self)
        except ValueError as e:self.send(413,str(e),'text/plain; charset=utf-8');return
        with conn() as db:
            if path == '/admin/login':
                row=db.execute('SELECT * FROM admin WHERE id=1').fetchone()
                password=data.get('password','')
                if not row or not hmac.compare_digest(hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(row['salt']),300000).hex(),row['password_hash']):
                    self.send(401,page('登入失敗','<h1>密碼錯誤</h1><a href="/admin/login">重新登入</a>',setting(db)));return
                token=secrets.token_urlsafe(32)
                db.execute('INSERT INTO sessions VALUES (?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),secrets.token_urlsafe(24),int(time.time())+7*86400))
                db.commit()  # Browser follows the redirect immediately; make session visible first.
                secure='; Secure' if self.headers.get('X-Forwarded-Proto','').lower()=='https' or os.environ.get('VOICE_COOKIE_SECURE')=='1' else ''
                self.redirect('/admin?from=login',f'voice_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800{secure}');return
            if path == '/admin/logout':
                if not self.csrf(db,data):return
                jar=SimpleCookie()
                try:jar.load(self.headers.get('Cookie',''))
                except Exception:pass
                if 'voice_session' in jar:db.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(jar['voice_session'].value.encode()).hexdigest(),))
                self.redirect('/admin/login','voice_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');return
            if not path.startswith('/admin/') or not self.csrf(db,data):return
            if path == '/admin/episode/delete':
                ident=data.get('id','')
                if data.get('confirm_delete')!='1':
                    self.send(400,'請先確認刪除文章。','text/plain; charset=utf-8');return
                if not ident.isdigit() or not db.execute('SELECT 1 FROM episodes WHERE id=?',(ident,)).fetchone():
                    self.send(404,'找不到文章','text/plain; charset=utf-8');return
                db.execute('DELETE FROM episodes WHERE id=?',(ident,))
                self.redirect('/admin');return
            if path == '/admin/storage/compact':
                if data.get('confirm_compact')!='1':self.send(400,'請先確認已下載備份。','text/plain; charset=utf-8');return
                db.commit();db.execute('VACUUM');self.redirect('/admin/storage');return
            if path == '/admin/export/download':
                try:payload,count=export_pages(db,self.server,data.get('private_password',''))
                except ValueError as error:
                    self.send(400,page('無法匯出',f'<h1>匯出設定需要調整</h1><p>{esc(error)}</p><a class="button" href="/admin/export">返回匯出頁</a>',setting(db),True));return
                except Exception as error:
                    print(f'匯出公開網站失敗：{error}',file=sys.stderr);self.send(500,'網站匯出失敗，請查看黑色視窗的錯誤。','text/plain; charset=utf-8');return
                self.send(200,payload,'application/zip',{'Content-Disposition':'attachment; filename="shysssiee-v1.4.3-github-pages.zip"','Cache-Control':'no-store'});return
            if path == '/admin/episode/save':
                title=data.get('title','').strip()[:150]; url=data.get('source_url','').strip(); vid=youtube_id(url)
                if not title or not vid:self.send(400,'請填寫標題與有效的 YouTube 網址。','text/plain; charset=utf-8');return
                eid=data.get('id','').strip()
                old=db.execute('SELECT * FROM episodes WHERE id=?',(eid,)).fetchone() if eid else None
                if eid and not old:self.send(404,'找不到文章');return
                status=data.get('status','draft') if data.get('status') in ('draft','published','private') else 'draft'
                if status in ('published','private') and (not old or old['status']!=status) and data.get('confirm_publish')!='1':
                    self.send(400,'請先確認公開發布。','text/plain; charset=utf-8');return
                slug=(old['slug'] if old and old['status']=='published' else clean_slug(data.get('slug',''))) or f'voice-{secrets.token_hex(4)}'
                ko=data.get('ko_srt',''); zh=data.get('zh_srt','')
                if data.get('ko_file'):ko=data['ko_file']
                if data.get('zh_file'):zh=data['zh_file']
                group=data.get('group_id','')
                group=int(group) if group.isdigit() and db.execute('SELECT 1 FROM groups WHERE id=?',(int(group),)).fetchone() else None
                category=data.get('category_id','')
                category=int(category) if category.isdigit() and db.execute('SELECT 1 FROM categories WHERE id=?',(int(category),)).fetchone() else None
                cover_blob=data.get('cover_file',b'')
                if cover_blob:
                    if len(cover_blob)>2*1024*1024 or not image_type(cover_blob):
                        self.send(400,'縮圖需為 2 MB 以下的 PNG、JPG 或 WebP 圖片。','text/plain; charset=utf-8');return
                    mime=image_type(cover_blob)[1]
                elif old and data.get('remove_cover_image')!='1':
                    cover_blob,mime=old['cover_image'],old['cover_mime']
                else:
                    cover_blob,mime=None,''
                members=', '.join(split_members(data.get('member','')[:2500]))
                now=datetime.now(timezone.utc).isoformat()
                published_at=(old['published_at'] if old else '') or (now if status in ('published','private') else '')
                content_type=data.get('content_type','video') if data.get('content_type') in ('video','podcast') else 'video'
                cover_url=safe_url(data.get('cover_url',old['cover_url'] if old else ''))
                fields=(slug,title,group,members,data.get('live_date','')[:10],vid,url,data.get('summary','')[:2000],ko,zh,data.get('notes','')[:10000],cover_url,status,now)
                try:
                    if old:
                        db.execute('''UPDATE episodes SET slug=?,title=?,group_id=?,member=?,live_date=?,youtube_id=?,source_url=?,summary=?,ko_srt=?,zh_srt=?,notes=?,cover_url=?,status=?,updated_at=?,category_id=?,cover_image=?,cover_mime=?,published_at=?,content_type=? WHERE id=?''',fields+(category,cover_blob,mime,published_at,content_type,old['id']))
                    else:
                        db.execute('''INSERT INTO episodes(slug,title,group_id,member,live_date,youtube_id,source_url,summary,ko_srt,zh_srt,notes,cover_url,status,updated_at,created_at,category_id,cover_image,cover_mime,published_at,content_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',fields+(now,category,cover_blob,mime,published_at,content_type))
                    for name in split_members(members):
                        db.execute('INSERT OR IGNORE INTO member_tags(group_id,name) VALUES (?,?)',(group or 0,name))
                except sqlite3.IntegrityError:
                    self.send(409,'網址尾段已被使用，請返回修改為其他名稱。','text/plain; charset=utf-8');return
                self.redirect('/admin');return
            if path in ('/admin/settings','/admin/settings/home','/admin/settings/identity','/admin/settings/about','/admin/settings/report'):
                values={}
                current=setting(db)
                for k in DEFAULTS:
                    if k=='logo_data':
                        continue
                    if k not in data and not (path=='/admin/settings/home' and k.startswith('show_')):
                        continue
                    val=data.get(k,current.get(k,DEFAULTS[k])).strip()[:10000 if k in ('about_content','report_types') else 500]
                    if k.startswith('show_'): val='1' if k in data else '0'
                    if k=='home_order' and val not in ('hero,filters,latest','filters,latest,hero','latest,filters,hero'):val=DEFAULTS[k]
                    if k in ('accent','secondary','background','text_color') and not re.fullmatch(r'#[0-9a-fA-F]{6}',val):val=DEFAULTS[k]
                    if k in ('body_size','title_size','corner','logo_size'):
                        low,high={'body_size':(15,22),'title_size':(25,40),'corner':(0,30),'logo_size':(24,80)}[k]
                        val=str(min(high,max(low,int(val)))) if val.isdigit() else DEFAULTS[k]
                    if k in ('font_url','logo_url','site_url','report_url','report_form_url','about_threads','about_instagram','about_youtube'):val=safe_url(val)
                    if k=='about_email' and val and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',val):val=''
                    values[k]=val
                logo=data.get('logo_file',b'')
                if logo:
                    if len(logo)>2*1024*1024 or not image_type(logo):
                        self.send(400,'Logo 需為 2 MB 以下 PNG、JPG 或 WebP 圖片。','text/plain; charset=utf-8');return
                    values['logo_data']='data:'+image_type(logo)[1]+';base64,'+base64.b64encode(logo).decode('ascii')
                elif data.get('remove_logo')=='1':
                    values['logo_data']=''
                db.executemany('UPDATE settings SET value=? WHERE key=?',[(v,k) for k,v in values.items()]);self.redirect(path);return
            if path == '/admin/settings/reset':
                keys=('accent','secondary','background','text_color','body_size','title_size','corner')
                db.executemany('UPDATE settings SET value=? WHERE key=?',[(DEFAULTS[k],k) for k in keys])
                self.redirect('/admin/settings');return
            if path in ('/admin/groups','/admin/groups/rename'):
                name=data.get('name','').strip()[:80]
                if not name:self.send(400,'請填團名');return
                try:
                    if path.endswith('rename'):db.execute('UPDATE groups SET name=? WHERE id=?',(name,data.get('id','')))
                    else:db.execute('INSERT INTO groups(name,sort_order) VALUES (?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM groups))',(name,))
                except sqlite3.IntegrityError:self.send(409,'這個團名已存在');return
                self.redirect('/admin/groups');return
            if path == '/admin/members/save':
                name=data.get('name','').strip()[:80]
                display=data.get('display_name','').strip()[:100]
                order=data.get('sort_order','0')
                order=min(999,max(0,int(order))) if order.isdigit() else 0
                visible=1 if data.get('visible')=='1' else 0
                ident=data.get('member_id','')
                if not name or not display:self.send(400,'請填寫篩選值與顯示名稱。');return
                try:
                    if ident.isdigit():
                        db.execute('UPDATE member_tags SET name=?,display_name=?,sort_order=?,visible=? WHERE rowid=?',(name,display,order,visible,ident))
                    else:
                        group=data.get('group_id','')
                        if not group.isdigit() or not db.execute('SELECT 1 FROM groups WHERE id=?',(group,)).fetchone():self.send(400,'請選擇有效團體。');return
                        db.execute('INSERT INTO member_tags(group_id,name,display_name,sort_order,visible) VALUES (?,?,?,?,?)',(int(group),name,display,order,visible))
                except sqlite3.IntegrityError:self.send(409,'這個團體已經有相同的成員篩選值。');return
                self.redirect('/admin/members');return
            if path == '/admin/members/delete':
                ident=data.get('member_id','')
                if data.get('confirm_delete')!='1':self.send(400,'請先確認刪除成員。');return
                if ident.isdigit():db.execute('DELETE FROM member_tags WHERE rowid=?',(ident,))
                self.redirect('/admin/members');return
            if path in ('/admin/categories','/admin/categories/rename'):
                name=data.get('name','').strip()[:80]
                if not name:self.send(400,'請填分類名稱');return
                try:
                    if path.endswith('rename'):db.execute('UPDATE categories SET name=? WHERE id=?',(name,data.get('id','')))
                    else:db.execute('INSERT INTO categories(name,sort_order) VALUES (?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM categories))',(name,))
                except sqlite3.IntegrityError:self.send(409,'這個分類名稱已存在');return
                self.redirect('/admin/categories');return
        self.send(404,'找不到頁面')

def init_admin():
    initialize()
    import getpass
    password=getpass.getpass('設定後台密碼（至少 12 個字元）：')
    again=getpass.getpass('再次輸入密碼：')
    if len(password)<12 or password!=again:
        print('密碼不一致，或少於 12 個字元。');return 1
    salt=secrets.token_bytes(16)
    digest=hashlib.pbkdf2_hmac('sha256',password.encode(),salt,300000).hex()
    with conn() as db:
        db.execute('INSERT INTO admin(id,salt,password_hash) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash',(salt.hex(),digest))
        db.execute('DELETE FROM sessions')
    print('後台密碼已設定。');return 0

def main():
    p=argparse.ArgumentParser(description='語音直播筆記')
    p.add_argument('command',choices=['init','serve','status'])
    p.add_argument('--host',default=os.environ.get('VOICE_HOST','127.0.0.1'))
    p.add_argument('--port',type=int,default=int(os.environ.get('VOICE_PORT','8776')))
    a=p.parse_args()
    if a.command=='init':return init_admin()
    initialize()
    with conn() as db:
        ready=bool(db.execute('SELECT 1 FROM admin WHERE id=1').fetchone())
        if a.command=='status':return 0 if ready else 1
        if not ready:
            print('請先執行 python app.py init 設定管理密碼。');return 1
    try:
        server=ThreadingHTTPServer((a.host,a.port),Handler)
    except OSError as error:
        print(f'無法開啟網站：{error}')
        return 1
    print(f'前台：http://{a.host}:{a.port}/　後台：http://{a.host}:{a.port}/admin')
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
    return 0

if __name__=='__main__':sys.exit(main())
