# 做书机上的进度探针：run_book.sh 每 2 分钟通过 ssh 喂给 python3 跑一次，打印一行 JSON（只有数字和画风名，不带路径）。
# 用法（在做书机上）：python3 - <slug> < probe.py
import glob, json, os, sys
P = os.path.expanduser(f'~/art-films/{sys.argv[1]}')
def n(pat): return len(glob.glob(f'{P}/{pat}'))
out = {'mp3': n('音频/ch??.mp3'), 'asr': n('音频/ch??.asr.json'), 'shots': n('音频/*.shots.json'), 'scenes': n('代码工程/scenes/book/ch*.js'),
       'html': os.path.exists(f'{P}/html/index.html'), 'result': os.path.exists(f'{P}/RESULT.md'), 'kit': '', 'smoke': None}
try: out['kit'] = json.load(open(f'{P}/book.json')).get('kit', '')
except Exception: pass
try:
    s = json.load(open(f'{P}/qa/smoke/smoke.json'))
    out['smoke'] = {'shots': s.get('shots', 0), 'errors': len(s.get('errors', [])), 'glyphs': len(s.get('glyphs', [])), 'framing': len(s.get('framing', [])), 'boot': bool(s.get('boot'))}
except Exception: pass
print(json.dumps(out))
