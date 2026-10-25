#!/usr/bin/env python3
"""qa.py 分批跑：一次跑完三百多镜，Playwright 驱动会在两百镜左右偶发断开（EPIPE，不固定在哪一镜），
所以每批一个进程，失败的批自动重试，最后合并成一份 qa.json / qa.md（deliver.py --qa 读它）。

用法：python3 qa_batches.py <项目目录> <输出目录> [--ids 逗号分隔的镜头 id] [--size 70]
可续跑：已有 qa.json 的批跳过。只验改过的几镜：--ids c02_hypo,c05_overlap
"""
import json, os, re, subprocess, sys
from pathlib import Path
args = sys.argv[1:]; N = 70; ids_only = None
if '--size' in args: i = args.index('--size'); N = int(args[i + 1]); del args[i:i + 2]
if '--ids' in args: i = args.index('--ids'); ids_only = args[i + 1].split(','); del args[i:i + 2]
P, OUT = Path(args[0]).expanduser().resolve(), Path(args[1]).expanduser().resolve(); OUT.mkdir(parents=True, exist_ok=True)
QA = Path.home() / '.claude/skills/huashu-art-motion/scripts/qa.py'
ids = ids_only or re.findall(r'\["(\w+)", [\d.]+, [\d.]+', (P / '代码工程/eras_book.js').read_text())
batches = [ids[i:i + N] for i in range(0, len(ids), N)]
for k, b in enumerate(batches):
    d = OUT / f'b{k}'
    for attempt in range(3):
        if (d / 'qa.json').exists(): break
        with open(OUT / f'b{k}.log', 'w') as log:
            subprocess.run(['uv', 'run', str(QA), '--project', str(P / '代码工程'), '--film', 'book', '--fps', '30', '--sub-band', '0.74', '--ids', ','.join(b), '--out', str(d)],
                           stdout=log, stderr=subprocess.STDOUT, env={**os.environ, 'PYTHONUNBUFFERED': '1'})
    print(f'批 {k + 1}/{len(batches)}', '✓' if (d / 'qa.json').exists() else '✗（重试 3 次仍断，见 b%d.log）' % k, flush=True)
parts = [json.loads((OUT / f'b{k}' / 'qa.json').read_text()) for k in range(len(batches)) if (OUT / f'b{k}' / 'qa.json').exists()]
rep = {**parts[0], 'segments': sum((p['segments'] for p in parts), []), 'transitions': sum((p.get('transitions', []) for p in parts), []), 'page_errors': sum((p['page_errors'] for p in parts), [])}
json.dump(rep, open(OUT / 'qa.json', 'w'), ensure_ascii=False, indent=1)
(OUT / 'qa.md').write_text('\n\n'.join(f'## 批 {k + 1}\n\n' + (OUT / f'b{k}' / 'qa.md').read_text() for k in range(len(batches)) if (OUT / f'b{k}' / 'qa.md').exists()))
fr = [(g['id'], x) for g in rep['segments'] for x in g['framing']]
(OUT / '框景线索.txt').write_text(''.join(f"{(x['t'][0] + x['t'][1]) / 2:.2f}|{x['kind']}|{i}|{x['text']}\n" for i, x in fr))
print(f"合并：{len(rep['segments'])}/{len(ids)} 镜，页面报错 {len(rep['page_errors'])} 条，框景线索 {len(fr)} 条（{OUT / '框景线索.txt'}，逐条抽帧看）-> {OUT}")
