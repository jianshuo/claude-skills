#!/usr/bin/env python3
"""用火山 ASR 的逐词时间给口播稿短句定时（替代 TTS 自带的字级时间戳——念数字的句子它常错位好几秒）。

稿子与 ASR 文本按字比对（difflib）：对上的字用 ASR 时间；数字等写法不同（九千九百九十九 vs 9,999）对不上的字，
用前后对上的字线性插值。短句起止 = 句首字开始、句末字结束。输出与 align.py 相同：每行「开始-结束  短句」。

用法：python3 asr_align.py <chNN.asr.json> <chNN.txt>
"""
import difflib, json, re, sys

PUN = set('，、：？。；！ ,.~～“”"\'（）()《》·—-')

def asr_chars(asr):
    out = []   # (char, start_s, end_s)
    for u in asr['result'].get('utterances', []):
        for w in u.get('words', []):
            t = [ch for ch in w['text'] if ch not in PUN]
            if not t: continue
            a, b = w['start_time'] / 1000, w['end_time'] / 1000
            for i, ch in enumerate(t): out.append((ch, a + (b - a) * i / len(t), a + (b - a) * (i + 1) / len(t)))
    return out

def main(asr_path, txt_path):
    asr = json.load(open(asr_path)); text = open(txt_path).read()
    phrases = [p.strip() for p in re.split(r'(?<=[，。：；？])|\n', text) if p and p.strip()]
    sc = []   # 稿子的字流：(char, phrase_index)
    for k, p in enumerate(phrases):
        for ch in p:
            if ch not in PUN: sc.append((ch, k))
    ac = asr_chars(asr)
    sm = difflib.SequenceMatcher(None, [c for c, _ in sc], [c for c, _, _ in ac], autojunk=False)
    st, en = [None] * len(sc), [None] * len(sc)
    for blk in sm.get_matching_blocks():
        for i in range(blk.size): st[blk.a + i] = ac[blk.b + i][1]; en[blk.a + i] = ac[blk.b + i][2]
    # 插值：没对上的字按前后锚点线性分
    known = [i for i in range(len(sc)) if st[i] is not None]
    if not known: sys.exit('ASR 与稿子完全对不上')
    for i in range(len(sc)):
        if st[i] is not None: continue
        L = max([k for k in known if k < i], default=None); R = min([k for k in known if k > i], default=None)
        if L is None: st[i] = en[i] = st[R]; continue
        if R is None: st[i] = en[i] = en[L]; continue
        f = (i - L) / (R - L); st[i] = en[L] + (st[R] - en[L]) * f; en[i] = en[L] + (st[R] - en[L]) * ((i - L + 1) / (R - L))
    rows = []
    for k, p in enumerate(phrases):
        idx = [i for i, (_, pk) in enumerate(sc) if pk == k]
        if not idx: continue
        rows.append((st[idx[0]], en[idx[-1]], p))
    for a, b, p in rows: print(f'{a:6.2f}-{b:6.2f}  {p}')
    ratio = sum(b.size for b in sm.get_matching_blocks()) / max(1, len(sc))
    print(f'# 对上 {ratio:.0%} 的字', file=sys.stderr)

if __name__ == '__main__': main(*sys.argv[1:3])
