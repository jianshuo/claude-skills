#!/usr/bin/env python3
"""盘古之白 — 在中文(汉字)和英文之间补一个空格。

规则:
  - 只在「汉字 ↔ 含字母的英文块」边界补空格(AI、Claude Code、GPT-4、skill.md…)。
  - 纯数字块(如「13万」)不补,因为用户要的是「英文」前后留白,不是数字。
  - 幂等:已经有空格 / 已经隔着标点的,不会重复补。
  - 不碰这些区域:fenced code(``` 块)、inline code(`...`)、
    markdown 链接/图片的 URL 部分 `](...)`、裸 http(s) URL。
  - 汉字旁的全角标点(，。！？「」)不补空格——因为只在汉字↔英文块触发,
    全角标点不是汉字也不是英文块,天然跳过。

用法:
  pangu.py <file.md> [file2.md ...]   # 就地改写(幂等)
  pangu.py -            # 从 stdin 读、写 stdout
  echo "用AI写skill" | pangu.py -    # → 用 AI 写 skill
"""
import re, sys

HAN = r'一-鿿㐀-䶿'
# 一个「英文/代码块」:字母数字,允许内部连接符 . - + # / _
CHUNK = r'[A-Za-z0-9]+(?:[.\-+#/_][A-Za-z0-9]+)*'
HAS_LETTER = re.compile(r'[A-Za-z]')

_han_then_chunk = re.compile(r'([' + HAN + r'])(' + CHUNK + r')')
_chunk_then_han = re.compile(r'(' + CHUNK + r')([' + HAN + r'])')


def _space_line(line: str) -> str:
    line = _han_then_chunk.sub(
        lambda m: m.group(1) + (' ' + m.group(2) if HAS_LETTER.search(m.group(2)) else m.group(2)),
        line)
    line = _chunk_then_han.sub(
        lambda m: (m.group(1) + ' ' if HAS_LETTER.search(m.group(1)) else m.group(1)) + m.group(2),
        line)
    return line


def _protect(line: str):
    store = []
    def keep(m):
        store.append(m.group(0))
        return f'\x00{len(store) - 1}\x00'
    line = re.sub(r'`[^`]*`', keep, line)        # inline code
    line = re.sub(r'\]\([^)]*\)', keep, line)     # ](url) of links/images
    line = re.sub(r'https?://\S+', keep, line)    # bare urls
    return line, store


def _restore(line: str, store) -> str:
    return re.sub(r'\x00(\d+)\x00', lambda m: store[int(m.group(1))], line)


def pangu(text: str) -> str:
    out, in_fence = [], False
    for line in text.split('\n'):
        if line.lstrip().startswith('```'):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        protected, store = _protect(line)
        out.append(_restore(_space_line(protected), store))
    return '\n'.join(out)


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args == ['-']:
        sys.stdout.write(pangu(sys.stdin.read()))
        return
    for path in args:
        with open(path, encoding='utf-8') as f:
            src = f.read()
        new = pangu(src)
        if new != src:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new)
            print(f'pangu: {path} (changed)')
        else:
            print(f'pangu: {path} (no change)')


if __name__ == '__main__':
    main()
