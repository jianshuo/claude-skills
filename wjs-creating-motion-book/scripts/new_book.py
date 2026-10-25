#!/usr/bin/env python3
"""开一本新书的动画工程：复制 huashu-art-motion 引擎、装上选中的画风套件、写 book.json 和章节制作规范。

用法：python3 new_book.py <项目目录> --slug <书 slug> --title <书名> --kit <套件名> --chapters <章名文件，一行一个>
        [--author 作者] [--voice zh_female_vv_uranus_bigtts]
已存在的东西不覆盖（可重复跑来补齐）；套件要的本机字体在这里抽子集。
"""
import argparse, json, shutil, subprocess, sys, tempfile
from pathlib import Path

SK = Path(__file__).resolve().parent.parent
ENGINE = Path.home() / '.claude/skills/huashu-art-motion/scripts/engine'
FONT_SUBSET = ENGINE.parent / 'font_subset.py'

ap = argparse.ArgumentParser()
ap.add_argument('dir'); ap.add_argument('--slug', required=True); ap.add_argument('--title', required=True)
ap.add_argument('--kit', required=True, help='kits/ 下的套件名；新画风先按 references/选画风.md 做出套件再来')
ap.add_argument('--chapters', required=True, help='章名文件，一行一个（不含开场）'); ap.add_argument('--author', default='')
ap.add_argument('--voice', default='zh_female_vv_uranus_bigtts')
a = ap.parse_args()

P = Path(a.dir).expanduser().resolve(); E = P / '代码工程'; KIT = SK / 'kits' / a.kit
if not (KIT / 'lib.js').exists(): sys.exit(f'没有套件 {a.kit}：{KIT}/lib.js；现有：{[k.name for k in (SK / "kits").iterdir()]}')
kit = json.loads((KIT / 'kit.json').read_text())
names = [l.strip() for l in Path(a.chapters).read_text().splitlines() if l.strip()]

for d in ['稿', '音频', '镜头表', '静帧', '审片', 'qa', 'output', 'html']: (P / d).mkdir(parents=True, exist_ok=True)
if not E.exists():
    shutil.copytree(ENGINE, E, ignore=shutil.ignore_patterns('__pycache__')); print('引擎 ->', E)
B = E / 'scenes/book'; B.mkdir(parents=True, exist_ok=True)
shutil.copy(KIT / 'lib.js', B / 'lib.js')   # 套件每次都刷新成 skill 里的最新版；本书自己的道具写 props.js
if not (B / 'props.js').exists():
    (B / 'props.js').write_text(f"// 《{a.title}》专属道具（贯穿物、反复出现的物件）。挂在 K 上，名字别和套件撞；章节卡上的主物在这里改 cardToken / cardCenter。\n(() => {{ const D = K, C = D.C, {{ W, H, TAU }} = D, {{ clamp, lerp }} = U;\n}})();\n")
(B / 'meta.js').write_text('window.BOOK_META = ' + json.dumps({'title': a.title, 'chapters': names}, ensure_ascii=False) + ';\n')

# 套件要的本机字体：从系统 TTC 取出那一个字面，再抽 GB2312 子集，注册进 lib/fonts.js
fj = E / 'lib/fonts.js'; reg = fj.read_text()
for f in kit.get('fonts', []):
    out = E / 'lib/fonts' / f['file']
    if not out.exists():
        with tempfile.TemporaryDirectory() as td:
            ttf = Path(td) / 'face.ttf'
            subprocess.run(['uv', 'run', '--with', 'fonttools', 'python', '-c',
                            f"from fontTools.ttLib import TTCollection; TTCollection({f['ttc']!r}).fonts[{f['index']}].save({str(ttf)!r})"], check=True)
            subprocess.run(['uv', 'run', str(FONT_SUBSET), '--font', str(ttf), '--out', str(out), '--gb2312', '--no-default-scan', '--scan', str(B)], check=True, capture_output=True)
        print('字体 ->', out.name)
    if f"'{f['family']}'" not in reg:
        reg = reg.replace('window.FONT_FACES = [\n', f"window.FONT_FACES = [\n  {{family:'{f['family']}', url:'lib/fonts/{f['file']}'}},   // 套件 {a.kit}：{kit.get('fonts_note', '')}\n", 1)
fj.write_text(reg)

bj = P / 'book.json'
if not bj.exists():
    bj.write_text(json.dumps({'slug': a.slug, 'title': a.title, 'author': a.author, 'kit': a.kit, 'chapters': names,
                              'size': [1080, 1920], 'fps': 30, 'gap': 0.8,
                              'voice': {'speaker': a.voice, 'instruction': '用沉稳、清楚的科普讲解语气，像在给朋友讲一个有意思的知识'}},
                             ensure_ascii=False, indent=1) + '\n')
spec = (SK / 'references/章节制作规范.md').read_text()
for k, v in {'{{TITLE}}': a.title, '{{KIT}}': a.kit, '{{KIT_LABEL}}': kit['label'], '{{GRAMMAR}}': kit['grammar'], '{{PALETTE}}': kit['palette'],
             '{{API}}': kit['api'], '{{N}}': str(len(names)), '{{DIR}}': str(P)}.items():
    spec = spec.replace(k, v)
(P / '制作规范.md').write_text(spec)
print(f'《{a.title}》：{len(names)} 章，套件 {a.kit} -> {P}\n下一步：写 稿/ch00.txt（开场）… 稿/ch{len(names):02d}.txt，再跑 narrate.py')
