#!/usr/bin/env python3
"""口播：稿/chNN.txt → 音频/chNN.mp3（火山豆包 seed-tts-2.0）→ chNN.asr.json（火山 ASR）→ chNN.句时间.txt（按字对齐）。

句时间直接用 ASR 定，不用 TTS 自带的字级时间戳（它普遍晚 0.3–0.5s，念数字的句子能错位好几秒）。
只重做稿子比 mp3 新的章；几章并发（默认 3）。凭据读 ~/code/.env。

用法：python3 narrate.py <项目目录> [ch03 ch07 …]（不写章号＝全部） [-j 3]
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
TTS = Path.home() / 'code/volcano-tts/tts.py'
ASR = Path.home() / '.claude/skills/wjs-transcribing-audio/scripts/volc_asr_stream.py'
args = [x for x in sys.argv[1:]]; jobs = 3
if '-j' in args: i = args.index('-j'); jobs = int(args[i + 1]); del args[i:i + 2]
P = Path(args[0]).expanduser().resolve(); only = set(args[1:]); A = P / '音频'
book = json.loads((P / 'book.json').read_text()); v = book.get('voice', {})
env = dict(os.environ)
for l in (Path.home() / 'code/.env').read_text().splitlines():
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, _, val = l.removeprefix('export ').partition('='); env.setdefault(k.strip(), val.strip().strip('"\''))

def one(txt):
    ch = txt.stem; mp3 = A / f'{ch}.mp3'; log = open(A / f'{ch}.log', 'w')
    if not mp3.exists() or mp3.stat().st_mtime < txt.stat().st_mtime:
        cmd = [sys.executable, str(TTS), '-f', str(txt), '-o', str(mp3), '--subtitle', '--speaker', v.get('speaker', 'zh_female_vv_uranus_bigtts')]
        if v.get('instruction'): cmd += ['-i', v['instruction']]
        if subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, env=env).returncode: return f'{ch} TTS 失败，见 音频/{ch}.log'
        (A / f'{ch}.asr.json').unlink(missing_ok=True)
    asr = A / f'{ch}.asr.json'
    if not asr.exists() or asr.stat().st_size == 0:
        if subprocess.run([sys.executable, str(ASR), str(mp3), str(asr)], stdout=log, stderr=subprocess.STDOUT, env=env).returncode: return f'{ch} ASR 失败，见 音频/{ch}.log'
    r = subprocess.run([sys.executable, str(HERE / 'asr_align.py'), str(asr), str(txt)], capture_output=True, text=True)
    if r.returncode: return f'{ch} 对齐失败：{r.stderr.strip()}'
    (A / f'{ch}.句时间.txt').write_text(r.stdout)
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(mp3)]))
    return f'{ch} {d:6.1f}s  {r.stderr.strip().lstrip("# ")}'

txts = sorted(t for t in (P / '稿').glob('ch??.txt') if not only or t.stem in only)
if not txts: sys.exit('稿/ 下没有 chNN.txt')
with ThreadPoolExecutor(jobs) as ex:
    for line in ex.map(one, txts): print(line, flush=True)
