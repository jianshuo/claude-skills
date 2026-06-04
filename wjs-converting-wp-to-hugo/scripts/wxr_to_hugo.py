"""WordPress WXR (.xml export) -> Hugo Markdown.

Pure-stdlib. Designed to work for ANY WordPress site: feed it the standard
"Tools -> Export -> All content" WXR file plus the wp-content/uploads folder.

Image URLs are left verbatim (e.g. /wp-content/uploads/2022/09/p.jpg); the
driver copies uploads/ into static/wp-content/uploads/ so they resolve
unchanged. Post URLs from <link> are preserved verbatim too (/archives/<id>/).

Unit-tested pure functions: parse_items, html_to_markdown,
build_front_matter, next_archive_id.  See tests/test_wxr.py.
"""
import re, html, os, json
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import unquote

NS = {
    'wp': 'http://wordpress.org/export/1.2/',
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'dc': 'http://purl.org/dc/elements/1.1/',
}


# --------------------------------------------------------------------------
# HTML -> Markdown
# --------------------------------------------------------------------------
def _root_relative(url):
    """Strip scheme+host from self-hosted media so URLs resolve under any host.
    Any absolute URL whose path is under /wp-content/ becomes root-relative;
    external images (other domains, not wp-content) stay absolute."""
    m = re.match(r'https?://[^/]+(/wp-content/.*)$', url)
    return m.group(1) if m else url



class _MD(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.images = []
        self._in_link = False
        self._href = None
        self._link_text = []
        self._in_gallery = 0
        self._fig_stack = []
        self._ul_stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('p', 'div'):
            self.parts.append('\n\n')
        elif tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.parts.append('\n\n' + '#' * int(tag[1]) + ' ')
        elif tag == 'ul':
            # Earlier Gutenberg galleries carry wp-block-gallery on the <ul>
            # itself (no wrapping <figure>); its <li> must not become bullets.
            is_gallery = 'wp-block-gallery' in a.get('class', '')
            self._ul_stack.append(is_gallery)
            if is_gallery:
                self._in_gallery += 1
        elif tag == 'li':
            if not self._in_gallery:
                self.parts.append('\n- ')
        elif tag in ('strong', 'b'):
            self.parts.append('**')
        elif tag in ('em', 'i'):
            self.parts.append('*')
        elif tag == 'br':
            self.parts.append('  \n')
        elif tag == 'blockquote':
            self.parts.append('\n\n> ')
        elif tag == 'figure':
            is_gallery = 'wp-block-gallery' in a.get('class', '')
            self._fig_stack.append(is_gallery)
            if is_gallery:
                self._in_gallery += 1
        elif tag == 'img':
            src = a.get('data-full-url') or a.get('src', '')
            if src:
                self.images.append(src)
                self.parts.append('\n\n![](%s)\n\n' % _root_relative(src))
        elif tag in ('video', 'audio', 'iframe'):
            # Pass embeds through as raw HTML (Hugo goldmark unsafe=true renders them).
            src = a.get('src', '')
            ctl = ' controls' if tag in ('video', 'audio') else ''
            if src:
                self.parts.append('\n\n<%s%s src="%s"></%s>\n\n' % (tag, ctl, src, tag))
                self._raw_media = True
        elif tag == 'source':
            # <video><source src=...></video> — capture if outer tag had no src
            src = a.get('src', '')
            if src and not getattr(self, '_raw_media', False):
                self.parts.append('\n\n<video controls src="%s"></video>\n\n' % src)
        elif tag == 'a':
            self._in_link = True
            self._href = a.get('href', '')
            self._link_text = []

    def handle_startendtag(self, tag, attrs):
        # <img .../> arrives here, not handle_starttag
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == 'a' and self._in_link:
            text = ''.join(self._link_text).strip()
            if self._href and text:
                self.parts.append('[%s](%s)' % (text, self._href))
            elif text:
                self.parts.append(text)
            self._in_link = False
            self._href = None
            self._link_text = []
        elif tag in ('strong', 'b'):
            self.parts.append('**')
        elif tag in ('em', 'i'):
            self.parts.append('*')
        elif tag in ('video', 'audio', 'iframe'):
            self._raw_media = False
        elif tag == 'figure' and self._fig_stack:
            if self._fig_stack.pop():
                self._in_gallery -= 1
        elif tag == 'ul' and self._ul_stack:
            if self._ul_stack.pop():
                self._in_gallery -= 1
        elif tag in ('p', 'div', 'blockquote'):
            self.parts.append('\n\n')

    def handle_data(self, data):
        if self._in_link:
            self._link_text.append(data)
        else:
            self.parts.append(data)


def html_to_markdown(content):
    """Return (markdown, [image_urls]). Image URLs and links preserved verbatim."""
    p = _MD()
    p.feed(content)
    md = ''.join(p.parts)
    md = re.sub(r'[ \t]+\n', '\n', md)
    md = re.sub(r'\n{3,}', '\n\n', md)
    return md.strip(), p.images


# --------------------------------------------------------------------------
# Front matter
# --------------------------------------------------------------------------
# Default WordPress / common-plugin scaffolding page slugs (not real content).
SCAFFOLD_SLUGS = {
    'sample-page', 'login', 'register', 'findpassword', 'password-protected',
    'login-designer', 'archives', 'cart', 'checkout', 'my-account',
}


def is_real_page(page):
    """False for WordPress scaffolding: empty body, single-shortcode body, or
    a known default slug. Keeps genuine content pages."""
    if page['slug'] in SCAFFOLD_SLUGS:
        return False
    body = html_to_markdown(page['content'])[0].strip()
    if not body:
        return False
    if re.fullmatch(r'\[[^\]]+\]', body):   # body is exactly one shortcode
        return False
    return True


def build_front_matter(post):
    title = html.unescape(post['title']).replace('"', "'")
    lines = [
        '---',
        'title: "%s"' % title,
        'date: %s' % post['date'],
        'lastmod: %s' % post.get('modified', post['date']),
        'categories: %s' % json.dumps(post.get('categories', []), ensure_ascii=False),
        'tags: %s' % json.dumps(post.get('tags', []), ensure_ascii=False),
        'url: %s' % post['url'],
        '---',
    ]
    return '\n'.join(lines)


# --------------------------------------------------------------------------
# Archive-id allocation for new posts
# --------------------------------------------------------------------------
def next_archive_id(content_dir):
    mx = 0
    for root, _dirs, files in os.walk(content_dir):
        for fn in files:
            if fn.endswith('.md'):
                txt = open(os.path.join(root, fn), encoding='utf-8').read()
                for m in re.finditer(r'url:\s*/archives/(\d+)/', txt):
                    n = int(m.group(1))
                    mx = max(mx, n)
    return mx + 1


# --------------------------------------------------------------------------
# WXR parsing
# --------------------------------------------------------------------------
def _norm_url(link, post_id, post_type):
    """Preserve the original permalink path with a trailing slash.

    WordPress percent-encodes CJK slugs in <link> (e.g. /生活调香室/ shows up as
    /%e7%94%9f.../). We decode them so Hugo writes a UTF-8 directory on disk; a
    static host then decodes incoming %xx requests to match it, keeping BOTH the
    old encoded links and the human-readable form alive. (Numeric /archives/<id>/
    URLs are unaffected — unquote is a no-op on them.)"""
    if link:
        path = unquote(re.sub(r'^https?://[^/]+', '', link).strip())
        if not path:
            path = '/'
        if not path.endswith('/'):
            path += '/'
        return path
    return '/archives/%s/' % post_id


def parse_items(xml_text, post_type):
    """Parse a WXR string; return published items of the given post_type.

    Each item: {id, title, slug, date, modified, url, categories, tags, content}.
    """
    root = ET.fromstring(xml_text)
    out = []
    for item in root.iter('item'):
        ptype = item.findtext('wp:post_type', default='', namespaces=NS)
        status = item.findtext('wp:status', default='', namespaces=NS)
        if ptype != post_type or status != 'publish':
            continue
        # Password-protected posts can't be gated on a static site -> skip them.
        if (item.findtext('wp:post_password', default='', namespaces=NS) or '').strip():
            continue
        pid = item.findtext('wp:post_id', default='', namespaces=NS)
        title = (item.findtext('title') or '').strip()
        slug = item.findtext('wp:post_name', default='', namespaces=NS) or pid
        link = (item.findtext('link') or '').strip()
        cats, tags = [], []
        for c in item.findall('category'):
            domain = c.get('domain')
            name = (c.text or '').strip()
            if not name:
                continue
            if domain == 'category':
                cats.append(name)
            elif domain == 'post_tag':
                tags.append(name)
        out.append({
            'id': int(pid) if pid.isdigit() else pid,
            'title': title,
            'slug': slug,
            'date': item.findtext('wp:post_date', default='', namespaces=NS),
            'modified': (item.findtext('wp:post_modified', default='', namespaces=NS)
                         or item.findtext('wp:post_date', default='', namespaces=NS)),
            'url': _norm_url(link, pid, ptype),
            'categories': cats,
            'tags': tags,
            'content': item.findtext('content:encoded', default='', namespaces=NS) or '',
        })
    return out


# --------------------------------------------------------------------------
# CLI driver
# --------------------------------------------------------------------------
def _copy_uploads(src='uploads', dst='static/wp-content/uploads'):
    import shutil
    if not os.path.isdir(src):
        return 0
    n = 0
    for root, _dirs, files in os.walk(src):
        for fn in files:
            if fn == '.DS_Store' or fn.endswith('.sql'):
                continue
            s = os.path.join(root, fn)
            rel = os.path.relpath(s, src)
            d = os.path.join(dst, rel)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copy2(s, d)
            n += 1
    return n


def convert_all(xml_path):
    xml_text = open(xml_path, encoding='utf-8').read()
    posts = parse_items(xml_text, 'post')
    pages = parse_items(xml_text, 'page')
    os.makedirs('content/posts', exist_ok=True)
    all_images = set()
    report = {'posts': 0, 'pages': 0, 'images': 0, 'warnings': []}

    for post in posts:
        body, imgs = html_to_markdown(post['content'])
        all_images.update(imgs)
        fm = build_front_matter(post)
        with open('content/posts/%s.md' % post['id'], 'w', encoding='utf-8') as f:
            f.write(fm + '\n\n' + body + '\n')
        if not body.strip():
            report['warnings'].append('empty body: %s' % post['id'])
        report['posts'] += 1

    for page in pages:
        if not is_real_page(page):
            report['warnings'].append('skipped scaffolding page: %s' % page['slug'])
            continue
        body, imgs = html_to_markdown(page['content'])
        all_images.update(imgs)
        title = html.unescape(page['title']).replace('"', "'")
        fm = '\n'.join(['---', 'title: "%s"' % title, 'url: %s' % page['url'], '---'])
        with open('content/%s.md' % page['slug'], 'w', encoding='utf-8') as f:
            f.write(fm + '\n\n' + body + '\n')
        report['pages'] += 1

    report['images'] = len(all_images)
    copied = _copy_uploads()
    report['uploads_copied'] = copied
    # any image whose host differs from the site (can't be served locally)
    ext = [u for u in all_images if u.startswith('http') and '/wp-content/uploads/' not in u]
    if ext:
        report['warnings'].append('external/off-site images: %d' % len(ext))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    import sys
    xml = sys.argv[1] if len(sys.argv) > 1 else None
    if not xml:
        # default: first *.xml in cwd
        xmls = [f for f in os.listdir('.') if f.lower().endswith('.xml')]
        xml = xmls[0] if xmls else None
    if not xml:
        print('usage: python3 scripts/wxr_to_hugo.py <wordpress-export.xml>')
        sys.exit(1)
    convert_all(xml)
