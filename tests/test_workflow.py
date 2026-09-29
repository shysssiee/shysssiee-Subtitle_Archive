import hashlib
import hmac
import http.cookiejar
import importlib.util
import os
from pathlib import Path
import re
import secrets
import tempfile
import io
import zipfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer


class Workflow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ['VOICE_DATA_DIR'] = self.tmp.name
        spec = importlib.util.spec_from_file_location('voice_app', Path(__file__).resolve().parents[1] / 'app.py')
        self.app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.app)
        self.app.initialize()
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac('sha256', b'example-password-123', salt, 300000).hex()
        with self.app.conn() as db:
            db.execute('INSERT INTO admin VALUES (1,?,?)', (salt.hex(), digest))
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), self.app.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def get(self, path):
        with self.client.open(self.base + path) as response:
            return response.read().decode(), response.geturl()

    def post(self, path, values):
        payload = urllib.parse.urlencode(values).encode()
        with self.client.open(self.base + path, payload) as response:
            return response.read().decode(), response.geturl()

    def test_publish_edit_and_settings(self):
        public, _ = self.get('/')
        self.assertIn('ShySssiee', public)
        self.assertIn('<title>ShySssiee｜一頭栽進虛擬偶像世界的J人</title>',public)
        self.assertIn('影音紀錄', public)
        self.assertIn('Podcast', public)
        admin, url = self.get('/admin')
        self.assertTrue(url.endswith('/admin/login'))
        self.post('/admin/login', {'password': 'example-password-123'})
        with self.app.conn() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM groups').fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM categories').fetchone()[0], 0)
            db.execute('UPDATE settings SET value=? WHERE key="site_url"',('https://example.github.io/podcast/',))
        form, _ = self.get('/admin/episode/new')
        csrf = re.search(r'name="csrf" value="([^"]+)"', form).group(1)
        self.assertNotIn('name="cover_url"',form)
        self.assertIn('id="member-input"',form)
        self.post('/admin/groups', {'csrf': csrf, 'name': 'SKINZ'})
        self.post('/admin/categories', {'csrf': csrf, 'name': '語音直播'})
        ko = '1\n00:00:03,000 --> 00:00:06,000\n안녕하세요\n'
        zh = '1\n00:00:03,000 --> 00:00:06,000\n大家好\n'
        self.post('/admin/episode/save', {'csrf':csrf,'title':'第一場','slug':'first-voice','group_id':'1','category_id':'1','member':'Finn','live_date':'2026-09-20','source_url':'https://youtu.be/dQw4w9WgXcQ','ko_srt':ko,'zh_srt':zh,'status':'draft'})
        listing, _ = self.get('/')
        self.assertNotIn('第一場', listing)
        with self.client.open(self.base + '/admin/export/download') as response:
            with zipfile.ZipFile(io.BytesIO(response.read())) as site:
                self.assertNotIn('podcast/first-voice/index.html',site.namelist())
        preview, _ = self.get('/admin/preview/1')
        self.assertIn('大家好', preview)
        with self.app.conn() as db:
            self.assertEqual(db.execute('SELECT category_id FROM episodes WHERE id=1').fetchone()[0], 1)
        publish={'csrf':csrf,'id':'1','title':'第一場修正','slug':'first-voice','group_id':'1','category_id':'1','member':'Finn, Jaon','live_date':'2026-09-20','source_url':'https://youtu.be/dQw4w9WgXcQ','ko_srt':ko,'zh_srt':zh,'status':'published'}
        with self.assertRaises(urllib.error.HTTPError) as refused:
            self.post('/admin/episode/save',publish)
        self.assertEqual(refused.exception.code,400)
        self.post('/admin/episode/save', {**publish,'confirm_publish':'1'})
        with self.app.conn() as db:
            first_publish=db.execute('SELECT published_at FROM episodes WHERE id=1').fetchone()[0]
            self.assertTrue(first_publish)
            self.assertEqual({r[0] for r in db.execute('SELECT name FROM member_tags WHERE group_id=1')},{'Finn','Jaon'})
        public, _ = self.get('/podcast/first-voice')
        self.assertIn('第一場修正', public)
        self.assertIn('大家好', public)
        self.assertIn('data-youtube="dQw4w9WgXcQ"', public)
        self.assertIn('<span>首頁</span></a>',public)
        self.assertIn('href="/?group=1"',public)
        self.assertIn('倒退 10 秒',public)
        self.assertIn('自動跟隨播放',public)
        self.assertIn('繁體中文',public)
        self.assertLess(public.index('class="youtube-placeholder"'), public.index('class="live-caption"'))
        self.assertLess(public.index('class="live-caption"'), public.index('class="listening-controls"'))
        self.assertLess(public.index('class="source"'), public.index('class="youtube-placeholder"'))
        self.assertIn('data-language="zh"',public)
        self.assertIn('data-caption-lang="both"',public)
        self.assertIn('data-caption-size="-1"',public)
        self.assertGreater(public.index('class="theater-toggle"'),public.index('class="live-caption"'))
        self.assertIn('v1.4.3',public)
        self.assertNotIn('<iframe', public)
        self.assertIn('first-voice', self.get('/')[0])
        with self.client.open(self.base + '/admin/export/download') as response:
            site_zip=response.read()
        with zipfile.ZipFile(io.BytesIO(site_zip)) as website:
            names=set(website.namelist())
            self.assertIn('index.html',names)
            self.assertIn('episode/first-voice/index.html',names)
            self.assertIn('podcast/first-voice/index.html',names)
            self.assertIn('podcast/index.html',names)
            self.assertIn('report/index.html',names)
            self.assertIn('static/export.js',names)
            self.assertIn('static/share-default.png',names)
            self.assertIn('about/index.html',names)
            self.assertFalse(any('sqlite' in name or 'admin' in name for name in names))
            homepage=website.read('index.html').decode()
            article=website.read('episode/first-voice/index.html').decode()
            self.assertIn('href="episode/first-voice/"',homepage)
            self.assertIn('href="../../index.html"',article)
            self.assertIn('href="../../index.html?group=1"',article)
            self.assertIn('src="../../static/app.js?',article)
            self.assertIn('data-caption-size="1"',article)
            self.assertIn('https://example.github.io/podcast/static/share-default.png',article)
            self.assertIn('https://example.github.io/podcast/episode/first-voice/',article)
            self.assertIn('直播日期：2026-09-20',article)
            self.assertIn('分類：語音直播',article)
            self.assertIn('影片翻譯評分',article)
            self.assertNotIn('公開及不公開列出的影片都能使用',article)
            self.assertNotIn('href="/podcast/',homepage)
            self.assertNotIn('name="csrf"',homepage)
        boundary='----voice-test-boundary'
        fields={'csrf':csrf,'id':'1','title':'第一場修正','slug':'first-voice','group_id':'1','category_id':'1','member':'Finn','live_date':'2026-09-20','source_url':'https://youtu.be/dQw4w9WgXcQ','ko_srt':ko,'zh_srt':'','status':'published'}
        chunks=[]
        for name,value in fields.items():
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="zh_file"; filename="zh.srt"\r\nContent-Type: text/plain\r\n\r\n'.encode()+zh.encode()+b'\r\n')
        chunks.append(f'--{boundary}--\r\n'.encode())
        req=urllib.request.Request(self.base+'/admin/episode/save',data=b''.join(chunks),headers={'Content-Type':f'multipart/form-data; boundary={boundary}'})
        self.client.open(req).close()
        self.assertIn('大家好', self.get('/podcast/first-voice')[0])
        with self.app.conn() as db:
            self.assertEqual(db.execute('SELECT published_at FROM episodes WHERE id=1').fetchone()[0],first_publish)
        from PIL import Image
        picture=io.BytesIO()
        Image.new('RGB',(360,220),'#a89bd3').save(picture,format='PNG')
        image_bytes=picture.getvalue()
        chunks=[]
        for name,value in fields.items():
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="cover_file"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+image_bytes+b'\r\n')
        chunks.append(f'--{boundary}--\r\n'.encode())
        self.client.open(urllib.request.Request(self.base+'/admin/episode/save',data=b''.join(chunks),headers={'Content-Type':f'multipart/form-data; boundary={boundary}'})).close()
        public,_=self.get('/podcast/first-voice')
        self.assertIn('/media/episode/1.png',public)
        self.assertIn('<details class="transcript-disclosure">',public)
        self.assertIn('影片來源為 YouTube',public)
        with self.client.open(self.base+'/media/episode/1.png') as response:
            self.assertEqual(response.read(),image_bytes)
        with self.client.open(self.base+'/admin/export/download') as response:
            with zipfile.ZipFile(io.BytesIO(response.read())) as website:
                self.assertEqual(website.read('static/covers/1.png'),image_bytes)
                article=website.read('episode/first-voice/index.html').decode()
                self.assertIn('https://example.github.io/podcast/static/covers/1.png',article)
                self.assertIn('src="../../static/covers/1.png"',article)
                self.assertIn('static/hero.webp',website.namelist())
        logo_fields={'csrf':csrf,'about_title':'關於本站','about_content':'第一段\n第二段','logo_size':'48','show_hero':'1','show_filters':'1','show_latest':'1','show_recommend':'1'}
        chunks=[f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode() for name,value in logo_fields.items()]
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="logo_file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+image_bytes+b'\r\n')
        chunks.append(f'--{boundary}--\r\n'.encode())
        self.client.open(urllib.request.Request(self.base+'/admin/settings',data=b''.join(chunks),headers={'Content-Type':f'multipart/form-data; boundary={boundary}'})).close()
        self.assertIn('<p>第二段</p>',self.get('/about/')[0])
        homepage=self.get('/')[0]
        self.assertIn('id="date-sort"',homepage)
        self.assertIn('id="shuffle-recommend"',homepage)
        self.assertIn('語音直播',homepage)
        with self.client.open(self.base+'/admin/export/download') as response:
            with zipfile.ZipFile(io.BytesIO(response.read())) as website:
                self.assertEqual(website.read('static/logo.png'),image_bytes)
                article=website.read('episode/first-voice/index.html').decode()
                self.assertIn('src="../../static/logo.png"',article)
                self.assertNotIn('data:image/',article)
                self.assertIn('property="og:image"',article)
                self.assertIn('name="twitter:image"',article)
                self.assertIn('1.png?v=',article)
                self.assertIn('<p>第二段</p>',website.read('about/index.html').decode())
        self.post('/admin/settings', {'csrf':csrf,'site_name':'我的語音房','page_name':'語音','hero_title':'一起聽','hero_subtitle':'介紹','latest_title':'新上架','others_title':'更多','about_text':'自發整理','accent':'#dc887d','secondary':'#968aca','background':'#fcfaf7','text_color':'#1c2a4a','body_size':'18','title_size':'32','corner':'16'})
        self.assertIn('我的語音房', self.get('/')[0])
        with self.client.open(self.base + '/admin/backup') as response:
            backup=response.read()
            self.assertEqual(backup[:16], b'SQLite format 3\x00')
        restored=Path(self.tmp.name)/'restored.sqlite3'
        restored.write_bytes(backup)
        import sqlite3
        with sqlite3.connect(restored) as saved:
            self.assertEqual(saved.execute('SELECT title FROM episodes WHERE id=1').fetchone()[0], '第一場修正')
            self.assertEqual(saved.execute('SELECT cover_image FROM episodes WHERE id=1').fetchone()[0], image_bytes)
        self.assertIn('v1.4.3',self.get('/')[0])

    def test_admin_filters_pagination_and_delete(self):
        self.post('/admin/login', {'password':'example-password-123'})
        form,_=self.get('/admin/episode/new')
        csrf=re.search(r'name="csrf" value="([^"]+)"',form).group(1)
        self.post('/admin/groups', {'csrf':csrf,'name':'SKINZ'})
        self.post('/admin/categories', {'csrf':csrf,'name':'直播'})
        self.post('/admin/members/save', {'csrf':csrf,'group_id':'1','name':'Finn','display_name':'Finn','sort_order':'1','visible':'1'})
        members_page,_=self.get('/admin/members')
        self.assertIn('成員管理',members_page)
        self.assertIn('value="Finn"',members_page)
        with self.app.conn() as db:
            now='2026-09-26T12:00:00+00:00'
            for i in range(12):
                db.execute('''INSERT INTO episodes(slug,title,group_id,category_id,member,live_date,youtube_id,source_url,status,created_at,updated_at,published_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',(f'voice-{i}',f'文章 {i}',1,1,'Finn' if i%2 else 'Jaon','2026-09-20','dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ','published',now,now,now))
        listing,_=self.get('/admin?group=1&category=1&member=Finn&page=1')
        self.assertIn('符合條件 6 篇',listing)
        self.assertIn('2026/09/26 20:00',listing)
        all_posts,_=self.get('/admin')
        self.assertIn('第 1/2 頁',all_posts)
        self.assertEqual(all_posts.count('class="admin-table-row"'),10)
        second,_=self.get('/admin?page=2')
        self.assertEqual(second.count('class="admin-table-row"'),2)
        with self.assertRaises(urllib.error.HTTPError) as refused:
            self.post('/admin/episode/delete',{'csrf':csrf,'id':'1'})
        self.assertEqual(refused.exception.code,400)
        self.post('/admin/episode/delete',{'csrf':csrf,'id':'1','confirm_delete':'1'})
        with self.app.conn() as db:self.assertFalse(db.execute('SELECT 1 FROM episodes WHERE id=1').fetchone())

    def test_sbv_and_idempotent_migration(self):
        sbv='0:00:07.000,0:00:12.000\nHello\n\n1:02:03.200,1:02:04.000\nAgain\n'
        cues=self.app.srt_lines(sbv)
        self.assertEqual([x['stamp'] for x in cues], ['00:00:07', '01:02:03'])
        self.app.initialize()
        with self.app.conn() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM categories').fetchone()[0], 0)
            db.execute('DROP TABLE member_tags')
            db.execute('ALTER TABLE episodes DROP COLUMN published_at')
            db.execute('''INSERT INTO episodes(slug,title,member,youtube_id,source_url,status,created_at,updated_at,cover_url)
                VALUES (?,?,?,?,?,?,?,?,?)''',('old','舊版文章','Finn, Jaon','dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ','published','2026-09-20T10:00:00+00:00','2026-09-22T10:00:00+00:00','https://example.com/old.jpg'))
        self.app.initialize()
        with self.app.conn() as db:
            row=db.execute('SELECT published_at,cover_url FROM episodes WHERE slug="old"').fetchone()
            self.assertEqual(row['published_at'],'2026-09-20T10:00:00+00:00')
            self.assertEqual(row['cover_url'],'https://example.com/old.jpg')
            self.assertEqual({r[0] for r in db.execute('SELECT name FROM member_tags')},{'Finn','Jaon'})

    def test_private_export_and_podcast_sections(self):
        now='2026-09-28T08:30:00+00:00'
        with self.app.conn() as db:
            db.execute('UPDATE settings SET value=? WHERE key="site_url"',('https://example.github.io/archive/',))
            db.execute('INSERT INTO groups(name,sort_order) VALUES (?,?)',('WE GO-6',1))
            for order,(name,label) in enumerate(self.app.WEGO_MEMBERS,1):
                db.execute('INSERT INTO member_tags(group_id,name,display_name,sort_order,visible) VALUES (?,?,?,?,1)',(1,name,label,order))
            db.execute('INSERT INTO groups(name,sort_order) VALUES (?,?)',('BEGRITZ',2))
            db.execute('INSERT INTO member_tags(group_id,name) VALUES (?,?)',(2,'LUBIN'))
            db.execute('''INSERT INTO episodes(slug,title,group_id,member,live_date,youtube_id,source_url,summary,ko_srt,zh_srt,status,created_at,updated_at,published_at,content_type)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',('secret-show','不能外洩的標題',1,'Wooyeon','2026-09-28','dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ','不能外洩的摘要','1\n00:00:01,000 --> 00:00:02,000\n비밀\n','1\n00:00:01,000 --> 00:00:02,000\n秘密內容\n','private',now,now,now,'podcast'))
            with self.assertRaises(ValueError): self.app.export_pages(db,self.server,'short')
            payload,count=self.app.export_pages(db,self.server,'correct-horse')
        self.assertEqual(count,1)
        with zipfile.ZipFile(io.BytesIO(payload)) as site:
            podcast=site.read('podcast/index.html').decode()
            pop_live=site.read('pop-live/index.html').decode()
            private=site.read('episode/secret-show/index.html').decode()
            self.assertIn('data-filter="1">WE GO-6</button>',podcast)
            self.assertIn('Wooyeon／鄭羽然',podcast)
            self.assertIn('data-filter="2">BEGRITZ</button>',podcast)
            self.assertIn('LUBIN',podcast)
            self.assertNotIn('id="podcast-group-filter"',podcast)
            self.assertIn('id="podcast-member-filter"',podcast)
            self.assertNotIn('podcast-member-group',podcast)
            self.assertLess(podcast.index('Wooyeon／鄭羽然'),podcast.index('Xiu／車時雨'))
            self.assertLess(podcast.index('Xiu／車時雨'),podcast.index('Taegang／朱泰岡'))
            self.assertIn('private-payload',private)
            self.assertIn('private-payload',pop_live)
            self.assertNotIn('不能外洩的標題',pop_live)
            self.assertNotIn('不能外洩的標題',private)
            self.assertNotIn('秘密內容',private)
            raw=re.search(r'<script id="private-payload" type="application/json">(.*?)</script>',private).group(1)
            import json,base64
            encrypted=json.loads(raw)
            salt=base64.b64decode(encrypted['salt']); nonce=base64.b64decode(encrypted['nonce'])
            cipher=base64.b64decode(encrypted['cipher']); tag=base64.b64decode(encrypted['tag'])
            key=hashlib.pbkdf2_hmac('sha256',b'correct-horse',salt,200000,64)
            self.assertTrue(hmac.compare_digest(tag,hmac.new(key[32:],nonce+cipher,hashlib.sha256).digest()))
            plain=bytearray()
            for counter,start in enumerate(range(0,len(cipher),32)):
                stream=hmac.new(key[:32],nonce+counter.to_bytes(4,'big'),hashlib.sha256).digest()
                plain.extend(a^b for a,b in zip(cipher[start:start+32],stream))
            self.assertIn('秘密內容',plain.decode())


if __name__ == '__main__':
    unittest.main()
