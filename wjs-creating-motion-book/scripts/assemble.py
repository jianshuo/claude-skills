#!/usr/bin/env python3
"""总装：各段口播（ch00 开场 + ch01…chNN）各自计时 → 全片时间轴。
- 音轨：每段 pad 到 时长+GAP 后首尾相接 → 音频/全片口播.wav
- 段落表：各章 音频/chNN.shots.json（章内局部时间）加章偏移 → 代码工程/eras_book.js
- 字幕：句时间（ASR 对齐）＋短句合并/拆条/数字不跨条 → 代码工程/scenes/book/subs.js（调套件的 K.subtitle）、音频/全片.srt

用法：python3 assemble.py <项目目录> [--allow-missing]（缺章用占位镜头，先看已完成的部分）
"""
import json, re, subprocess, sys
from pathlib import Path
P = Path(sys.argv[1]).expanduser().resolve(); A = P / '音频'; E = P / '代码工程'; B = E / 'scenes/book'
book = json.loads((P / 'book.json').read_text()); GAP = book.get('gap', 0.8)   # 章间气口（0.4s 审片嫌赶）
CH = [f'ch{i:02d}' for i in range(len(book['chapters']) + 1)]
dur = lambda f: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]).decode())
allow = '--allow-missing' in sys.argv

# ---------- 时间轴 ----------
offs, shots, libs, missing = {}, [], [], []
t = 0.0
for ch in CH:
    d = dur(A / f'{ch}.mp3'); offs[ch] = t; sj = A / f'{ch}.shots.json'; clen = d + GAP
    if sj.exists() and (B / f'{ch}.js').exists():
        rows = json.loads(sj.read_text()); libs.append(f'scenes/book/{ch}.js'); end = rows[-1][2]
        if abs(end - (d + GAP)) > 0.6 and ch != CH[-1]: print(f'⚠ {ch} 最后一镜结束 {end:.2f}，音频+GAP={d + GAP:.2f}')
        if ch == CH[-1]: clen = max(d + GAP, end)   # 最后一章允许片尾多留（片名停留），其余章严格 = 音频＋GAP
        for i, r in enumerate(rows):
            sid, a, b = r[:3]; shots.append([sid, round(t + a, 3), round(t + (clen if i == len(rows) - 1 else b), 3)] + (['seamless'] if len(r) > 3 and r[3] == 'seamless' else []))
    else:
        missing.append(ch)
        if not allow: sys.exit(f'缺 {ch}：{sj.name} 或 scenes/book/{ch}.js 不存在（--allow-missing 用占位镜头）')
        shots.append([f'ph_{ch}', round(t, 3), round(t + clen, 3)])
    t += clen
total = round(t, 3)
for i in range(len(shots) - 1): shots[i][2] = shots[i + 1][1]   # 首尾严格相接
print(f'全片 {total:.1f}s = {total / 60:.1f} 分钟，{len(shots)} 镜；缺：{missing or "无"}')

# ---------- 音轨 ----------
parts = sum((['-i', str(A / f'{ch}.mp3')] for ch in CH), [])
lens = [round(total - offs[ch], 3) if ch == CH[-1] else dur(A / f'{ch}.mp3') + GAP for ch in CH]
fil = ''.join(f'[{i}:a]aresample=48000,apad=whole_dur={lens[i]:.3f}[a{i}];' for i in range(len(CH))) + ''.join(f'[a{i}]' for i in range(len(CH))) + f'concat=n={len(CH)}:v=0:a=1[o]'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *parts, '-filter_complex', fil, '-map', '[o]', str(A / '全片口播.wav')], check=True)

# ---------- 字幕：短句合并到 ≤17 字、超 18 字拆、数字和量词不拆开、<0.8s 的并或延、空条不出 ----------
NUM = set('零一二三四五六七八九十百千万亿两几0123456789.%'); MW = set('倍个年人种次岁天位颗元块条')
def chapter_subs(ch, off):
    rows = []
    for l in (A / f'{ch}.句时间.txt').read_text().splitlines():
        m = re.match(r'\s*([\d.]+)-\s*([\d.]+)\s+(.*)', l)
        if m: rows.append([float(m[1]), float(m[2]), m[3].strip()])
    cues = []
    for a, b, tx in rows:
        t2 = re.sub(r'[，。：；]$', '', tx)
        if cues and len(cues[-1][2]) + len(t2) <= 17 and a - cues[-1][1] < 0.6 and not re.search(r'[。：；？！]$', cues[-1][3]):
            cues[-1][1] = b; cues[-1][2] += '，' + t2; cues[-1][3] = tx
        else: cues.append([a, b, t2, tx])
    def split(a, b, tx):
        if len(tx) <= 18: return [[a, b, tx]]
        mid = len(tx) / 2; ok = [i for i in range(5, len(tx) - 4) if not (tx[i - 1] in NUM and (tx[i] in NUM or tx[i] in MW))] or list(range(5, len(tx) - 4))
        pref = [i for i in ok if tx[i - 1] in '、，' or tx[i] == ' ']; k = min(pref or ok, key=lambda i: abs(i - mid))
        l, r = tx[:k].rstrip('、， '), tx[k:].lstrip('、， '); m = a + (b - a) * len(l) / (len(l) + len(r))
        return split(a, m - 0.02, l) + split(m, b, r)
    out = []
    for i, (a, b, tx, _) in enumerate(cues):
        nb = cues[i + 1][0] if i + 1 < len(cues) else b + 0.6
        out += split(a, min(b + 0.4, nb - 0.02), tx)
    merged = []
    for a, b, tx in out:
        if merged and (b - a < 0.8 or merged[-1][1] - merged[-1][0] < 0.8) and len(merged[-1][2]) + len(tx) + 1 <= 18 and a - merged[-1][1] < 0.6:
            merged[-1][1] = b; merged[-1][2] += ('' if merged[-1][2][-1:] in '？。！：；' else '，') + tx
        else: merged.append([a, b, tx])
    for i in range(len(merged)):
        if merged[i][1] - merged[i][0] < 0.8:
            nxt = merged[i + 1][0] - 0.02 if i + 1 < len(merged) else merged[i][1] + 0.8
            merged[i][1] = min(nxt, merged[i][0] + 0.8)
    return [[round(off + a, 3), round(off + b, 3), tx] for a, b, tx in merged if tx.strip(' ，、。？！：；')]
subs = sum((chapter_subs(ch, offs[ch]) for ch in CH), [])
fmt = lambda s: f"{int(s // 3600):02}:{int(s % 3600 // 60):02}:{int(s % 60):02},{int(round(s % 1 * 1000)) % 1000:03}"
(A / '全片.srt').write_text('\n'.join(f"{i + 1}\n{fmt(a)} --> {fmt(b)}\n{tx}\n" for i, (a, b, tx) in enumerate(subs)))
(B / 'subs.js').write_text("""// 字幕（assemble.py 生成）：画在画布最上层，样式由套件 K.subtitle 决定
window.SUBS = %s;
window.GLOBAL_OVERLAY = (c, t) => {
  const s = SUBS.find(q => t >= q[0] && t < q[1]); if (!s) return;
  K.subtitle(c, s[2], Math.min(1, (t - s[0]) / 0.08, (s[1] - t) / 0.08));
};
""" % json.dumps(subs, ensure_ascii=False))

# ---------- 段落表 ----------
(B / 'meta.js').write_text('window.BOOK_META = ' + json.dumps({'title': book['title'], 'chapters': book['chapters']}, ensure_ascii=False) + ';\n')
extra = [f'scenes/book/{f}' for f in book.get('extra_libs', [])]   # 本书另有的共用场景文件（如复用旧片的 a.js）
ph = ''.join(f"SCENES['ph_{ch}'] = {{ draw(c, lt, t) {{ K.bg(c, t, {{}}); K.text(c, '{ch} 待制作', 540, 900, {{ size: 90 }}); }} }};\n" for ch in missing)
lines = ',\n'.join('  ' + ', '.join(json.dumps(s, ensure_ascii=False) for s in shots[k:k + 4]) for k in range(0, len(shots), 4))
W_, H_ = book.get('size', [1080, 1920])
(E / 'eras_book.js').write_text(f"""// 《{book['title']}》：assemble.py 生成，别手改（改各章 音频/chNN.shots.json 后重跑）
window.FILM_SIZE = [{W_}, {H_}];
window.PUNCH = 0;
window.SCENE_LIBS = {json.dumps(['scenes/book/meta.js', 'scenes/book/lib.js', 'scenes/book/props.js'] + extra + libs + ['scenes/book/subs.js'])};
{ph}window.CHAPTER_OFFSETS = {json.dumps({k: round(v, 3) for k, v in offs.items()})};
const SHOTS = [
{lines},
];
// 同一个连续世界拆成多镜时，后几镜在 chNN.shots.json 里带第四列 "seamless"，镜间不加转场
window.ERAS = SHOTS.map(([id, a, b, sm], i) => ({{ id, dur: +(b - a).toFixed(3), ...(i && sm !== 'seamless' ? {{ transition: {{ type: 'crossfade', dur: 0.15 }} }} : {{}}) }}));
""")
print('音轨、字幕、段落表已写好；字幕', len(subs), '条，最长', max((len(s[2]) for s in subs), default=0), '字')
