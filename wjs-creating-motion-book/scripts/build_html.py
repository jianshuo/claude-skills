#!/usr/bin/env python3
"""把整本书打包成浏览器里直接播放的网页（默认交付物，不经 MP4）：画面实时绘制，时间取口播 <audio> 的 currentTime。

- 脚本：引擎库 + eras_book.js 的 SCENE_LIBS，全部改成 <script charset="utf-8"> 标签直接引入（不走同步请求＋eval；不写 charset 中文会乱码）
- 字体：扫场景代码里用到的 family，按 lib/fonts.js 找源文件，只切片子里出现过的字（先 fetch 成 ArrayBuffer 再注册 FontFace）
- 音频：全片口播 → 64k 单声道 mp3（Artifact 单个文件 ≤15MB；20 分钟约 11MB）
播放器是公用组件 player/template.html，改样式改那一份，所有书一起变。

用法：python3 build_html.py <项目目录> [输出目录，默认 <项目>/html]
本地自测：输出目录里的 _test.html（补了 <meta charset>）用 python3 -m http.server 打开。
"""
import json, re, subprocess, sys, shutil
from pathlib import Path
SK = Path(__file__).resolve().parent.parent
P = Path(sys.argv[1]).expanduser().resolve(); OUT = Path(sys.argv[2]).expanduser().resolve() if len(sys.argv) > 2 else P / 'html'
E = P / '代码工程'; book = json.loads((P / 'book.json').read_text()); OUT.mkdir(parents=True, exist_ok=True)
LIBS = ['util', 'paint', 'brush', 'render', 'post', 'rig', 'rig_huashu', 'kit', 'medium', 'motion', 'camera', 'diagram', 'typo', 'chart', 'ui', 'collage', 'media', 'toon']
eras = (E / 'eras_book.js').read_text()
scene_libs = json.loads(re.search(r'window.SCENE_LIBS = (\[.*?\])', eras).group(1))
for f in [f'lib/{n}.js' for n in LIBS] + ['transitions.js', 'engine.js', 'eras_book.js', 'scenes/index.js'] + scene_libs:
    (OUT / f).parent.mkdir(parents=True, exist_ok=True); shutil.copy(E / f, OUT / f)
faces = dict(re.findall(r"\{family:'([^']+)', url:'([^']+)'", (E / 'lib/fonts.js').read_text()))
code = ''.join((E / f).read_text() for f in scene_libs)
used = sorted(fam for fam in faces if re.search(r'["\']' + re.escape(fam) + r'["\']', code))
chars = ''.join(sorted(set(c for c in code if ord(c) > 127) | set(chr(i) for i in range(32, 127)) | set('％：，。、？！（）·—–')))
(OUT / 'fonts').mkdir(exist_ok=True)
for fam in used:
    subprocess.run(['uv', 'run', str(Path.home() / '.claude/skills/huashu-art-motion/scripts/font_subset.py'), '--font', str(E / faces[fam]), '--out', str(OUT / 'fonts' / f'{fam}.woff'), '--text', chars, '--no-default-scan'], check=True, capture_output=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(P / '音频/全片口播.wav'), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', str(OUT / 'narration.mp3')], check=True)
total = max(float(x) for x in re.findall(r'\["\w+", [\d.]+, ([\d.]+)', eras))
mmss = f'{int(total // 60)}:{int(total % 60):02d}'
tags = '\n'.join(f'<script charset="utf-8" src="{f}"></script>' for f in scene_libs)
libtags = '\n'.join(f'<script charset="utf-8" src="lib/{n}.js"></script>' for n in LIBS[1:])
font_js = json.dumps([[fam, f'fonts/{fam}.woff'] for fam in used], ensure_ascii=False)
page = (SK / 'player/template.html').read_text()
for k, v in {'{{TITLE}}': book['title'], '{{TOTAL}}': f'{total:.2f}', '{{MMSS}}': mmss, '{{ERAS}}': 'eras_book.js', '{{LIBTAGS}}': libtags, '{{SCENETAGS}}': tags, '{{FONTS}}': font_js}.items():
    page = page.replace(k, v)
(OUT / 'index.html').write_text(page)
(OUT / '_test.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + page + '</body></html>')
pub = {str(p.relative_to(OUT)): str(p) for p in sorted(OUT.rglob('*')) if p.is_file() and p.name not in ('index.html', '_test.html', 'artifact_files.json')}
(OUT / 'artifact_files.json').write_text(json.dumps(pub, ensure_ascii=False, indent=0))   # Artifact 发布时原样传给 files
size = sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file() and p.name != '_test.html')
big = [(p.name, p.stat().st_size) for p in OUT.rglob('*') if p.is_file() and p.stat().st_size > 15e6]
print(f"《{book['title']}》：{len(scene_libs)} 个场景文件，字体 {used}，{len(chars)} 字，时长 {mmss}，总大小 {size / 1e6:.1f}MB -> {OUT}" + (f'\n⚠ 超过 Artifact 单文件 15MB：{big}' if big else ''))
