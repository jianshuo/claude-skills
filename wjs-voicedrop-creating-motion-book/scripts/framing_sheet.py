#!/usr/bin/env python3
"""框景线索拼图：qa 的「半截字/进字幕带/叠字/近空白」逐条出两帧（线索中点、0.8 秒后），拼成几张总图一次看完。
两帧都切边＝真出画（多半是长镜头里推近中心偏了、或开场初始状态在画外），要改；只有前一帧有＝转场或动画中途，不改。
不需要 MP4：直接用 render.py --stills 按全片时间出帧。

用法：python3 framing_sheet.py <项目目录> <qa 输出目录> [片名，默认 book]   → <qa 目录>/框景/sheet_N.png ＋ 序号表
"""
import subprocess, sys
from pathlib import Path
P, Q = Path(sys.argv[1]).expanduser().resolve(), Path(sys.argv[2]).expanduser().resolve(); FILM = sys.argv[3] if len(sys.argv) > 3 else 'book'
rows = [l.split('|') for l in (Q / '框景线索.txt').read_text().splitlines() if l.strip()]
if not rows: sys.exit('没有框景线索')
D = Q / '框景'; D.mkdir(exist_ok=True)
ts = sorted({round(float(r[0]) + dt, 2) for r in rows for dt in (0, 0.8)})
subprocess.run(['uv', 'run', '--with', 'playwright', 'python', 'render.py', '--film', FILM, '--width', '1080', '--height', '1920', '--stills', ','.join(map(str, ts)), '--out', str(D / 'raw')],
               cwd=P / '代码工程', check=True, capture_output=True)
pairs = []
for i, r in enumerate(rows):
    t = float(r[0]); a, b = D / 'raw' / f't{round(t, 2):06.2f}.png', D / 'raw' / f't{round(t + 0.8, 2):06.2f}.png'
    o = D / f'p{i:03d}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(a), '-i', str(b), '-filter_complex', '[0]scale=200:-1[x];[1]scale=200:-1[y];[x][y]hstack', str(o)], check=True)
    pairs.append(o)
per = 12   # 每张 6 列 × 2 行，一格 = 一条线索的两帧
for s in range(0, len(pairs), per):
    grp = pairs[s:s + per]; ins = sum((['-i', str(p)] for p in grp), [])
    cols = 6; n = len(grp); lay = '|'.join(f'{(k % cols) * 400}_{(k // cols) * 356}' for k in range(n))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', f"{''.join(f'[{k}]' for k in range(n))}xstack=inputs={n}:layout={lay}:fill=black" if n > 1 else 'null',
                    str(D / f'sheet_{s // per + 1}.png')], check=True)
for i, r in enumerate(rows): print(f'图{i // per + 1} 格{i % per + 1:>2}  {float(r[0]):7.2f}s  {r[1]}  {r[2]}  {r[3]}')
print('->', D)
