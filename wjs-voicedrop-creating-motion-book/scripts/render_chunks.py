#!/usr/bin/env python3
"""MP4（可选产物）：按章切段，每段一个 render.py 进程（渲完退出、内存归还），已渲好的段跳过（可续跑），
最后 ffmpeg 无损拼接、混入全片音轨。16GB 的 Mac 上同时最多 2 个渲染进程，一次整片渲会被内存回收杀掉。

用法：python3 render_chunks.py <项目目录> <输出 mp4> [-j 2]
改了某几章：删掉 <输出>_chunks/chNN.mp4 再跑（其余段直接复用）。
"""
import json, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
args = sys.argv[1:]; jobs = 2
if '-j' in args: i = args.index('-j'); jobs = min(2, int(args[i + 1])); del args[i:i + 2]
P, out = Path(args[0]).expanduser().resolve(), Path(args[1]).expanduser().resolve()   # 绝对路径：render.py 在 代码工程/ 下运行
E = P / '代码工程'; eras = (E / 'eras_book.js').read_text(); book = json.loads((P / 'book.json').read_text())
W_, H_ = book.get('size', [1080, 1920]); fps = str(book.get('fps', 30))
offs = json.loads(re.search(r'CHAPTER_OFFSETS = (\{.*?\})', eras).group(1))
total = max(float(x) for x in re.findall(r'\["\w+", [\d.]+, ([\d.]+)', eras)); keys = list(offs)
bounds = [(k, offs[k], offs[keys[i + 1]] if i + 1 < len(keys) else total) for i, k in enumerate(keys)]
cdir = out.parent / f'{out.stem}_chunks'; cdir.mkdir(parents=True, exist_ok=True)

def one(kab):
    k, a, b = kab; seg = cdir / f'{k}.mp4'
    if seg.exists() and seg.stat().st_size > 0: return f'{k} 已有，跳过'
    tmp = cdir / f'{k}.part.mp4'; st = time.time()
    r = subprocess.run(['uv', 'run', '--with', 'playwright', 'python', 'render.py', '--film', 'book', '--width', str(W_), '--height', str(H_), '--fps', fps,
                        '--from', f'{a:.4f}', '--to', f'{b:.4f}', '--out', str(tmp)], cwd=E, capture_output=True, text=True)
    if r.returncode or not tmp.exists(): return f'✗ {k} 渲染失败：\n{r.stdout[-1500:]}\n{r.stderr[-1500:]}'
    tmp.rename(seg); return f'{k} 完成 {b - a:.1f}s 用时 {time.time() - st:.0f}s'
with ThreadPoolExecutor(jobs) as ex:
    res = list(ex.map(lambda x: (print(r := one(x), flush=True), r)[1], bounds))
if any(r.startswith('✗') for r in res): sys.exit('有段落渲染失败，修好后重跑（已完成的段会跳过）')
lst = cdir / 'list.txt'; lst.write_text(''.join(f"file '{cdir / (k + '.mp4')}'\n" for k, _, _ in bounds))
noaud = cdir / 'all.noaudio.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(noaud)], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(noaud), '-i', str(P / '音频' / '全片口播.mp3'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', str(out)], check=True)
d = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)]).decode().strip()
print(f'完成 -> {out}（{d}s，段落表 {total:.1f}s）', flush=True)
