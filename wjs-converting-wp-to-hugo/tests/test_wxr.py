"""Unit tests for wxr_to_hugo. Run: python3 tests/test_wxr.py  (no pytest needed)."""
import sys, os, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
import wxr_to_hugo as w


# ---- html_to_markdown ----
def test_paragraph():
    md, _ = w.html_to_markdown('<p>你好</p><p>世界</p>')
    assert md == '你好\n\n世界', repr(md)

def test_heading():
    md, _ = w.html_to_markdown('<h2>标题</h2><p>正文</p>')
    assert md == '## 标题\n\n正文', repr(md)

def test_list():
    md, _ = w.html_to_markdown('<ul><li>甲</li><li>乙</li></ul>')
    assert md == '- 甲\n- 乙', repr(md)

def test_emphasis():
    md, _ = w.html_to_markdown('<p>这是<strong>粗</strong>和<em>斜</em></p>')
    assert md == '这是**粗**和*斜*', repr(md)

def test_blockquote():
    md, _ = w.html_to_markdown('<blockquote>引用句</blockquote>')
    assert md == '> 引用句', repr(md)

def test_bare_newlines_classic_editor():
    # WP classic editor stores soft line breaks as bare \n inside content
    md, _ = w.html_to_markdown('第一行\n第二行')
    assert md == '第一行\n第二行', repr(md)

# ---- links (known issue #1: href must survive) ----
def test_link():
    md, _ = w.html_to_markdown('<p>见<a href="https://x.cn/1">这里</a>结束</p>')
    assert md == '见[这里](https://x.cn/1)结束', repr(md)

def test_link_no_href_keeps_text():
    md, _ = w.html_to_markdown('<p>纯<a>文字</a></p>')
    assert md == '纯文字', repr(md)

# ---- images (known issue #2: gallery bullets; plus local path) ----
def test_image_made_root_relative():
    # Absolute wp-content URL -> root-relative so it resolves locally and in prod
    md, imgs = w.html_to_markdown(
        '<img src="https://huixianju.cn/wp-content/uploads/2022/09/p.jpg"/>')
    assert '![](/wp-content/uploads/2022/09/p.jpg)' in md, repr(md)
    assert imgs == ['https://huixianju.cn/wp-content/uploads/2022/09/p.jpg'], repr(imgs)

def test_external_image_kept_absolute():
    md, _ = w.html_to_markdown('<img src="https://other.com/x.png"/>')
    assert '![](https://other.com/x.png)' in md, repr(md)

def test_video_passthrough():
    md, _ = w.html_to_markdown(
        '<figure class="wp-block-video"><video controls src="https://x.com/v.mp4"></video></figure>')
    assert '<video controls src="https://x.com/v.mp4">' in md, repr(md)

def test_iframe_passthrough():
    md, _ = w.html_to_markdown('<iframe src="https://x.com/e"></iframe>')
    assert '<iframe src="https://x.com/e">' in md, repr(md)

def test_gallery_no_stray_bullets():
    item = ('<li class="blocks-gallery-item"><figure>'
            '<img src="https://huixianju.cn/wp-content/uploads/%s.jpg"/></figure></li>')
    htmls = ('<figure class="wp-block-gallery columns-1"><ul class="blocks-gallery-grid">'
             + (item % 'a') + (item % 'b') + '</ul></figure>')
    md, imgs = w.html_to_markdown(htmls)
    assert '- ' not in md, repr(md)
    assert ('uploads/a.jpg)' in md and 'uploads/b.jpg)' in md), repr(md)

def test_ul_gallery_no_stray_bullets():
    # Earlier Gutenberg galleries put wp-block-gallery on the <ul>, not a <figure>.
    # Its <li> items must NOT emit list bullets (would leave a stray '-' per image).
    item = ('<li class="blocks-gallery-item"><figure>'
            '<img src="https://maggiacito.com/wp-content/uploads/%s.jpg"/></figure></li>')
    htmls = ('<ul class="wp-block-gallery columns-2 is-cropped">'
             + (item % 'a') + (item % 'b') + '</ul>')
    md, _ = w.html_to_markdown(htmls)
    assert '- ' not in md and '\n-\n' not in ('\n' + md.strip() + '\n'), repr(md)
    assert ('uploads/a.jpg)' in md and 'uploads/b.jpg)' in md), repr(md)

# ---- front matter ----
def test_front_matter():
    post = {'id': 1488, 'title': '关于&门的动议', 'slug': 'x',
            'date': '2023-05-08 10:00:00', 'modified': '2023-05-09 11:00:00',
            'categories': ['其他', '业委会'], 'tags': ['通过'],
            'url': '/archives/1488/'}
    fm = w.build_front_matter(post)
    assert 'url: /archives/1488/' in fm, fm
    assert 'title: "关于&门的动议"' in fm, fm
    assert 'categories: ["其他", "业委会"]' in fm, fm
    assert 'tags: ["通过"]' in fm, fm
    assert fm.startswith('---\n') and fm.rstrip().endswith('---'), fm

def test_front_matter_quote_in_title():
    post = {'id': 1, 'title': '他说"好"', 'slug': 'x', 'date': '2020-01-01 00:00:00',
            'modified': '2020-01-01 00:00:00', 'categories': [], 'tags': [],
            'url': '/archives/1/'}
    fm = w.build_front_matter(post)
    assert 'title: "他说' in fm and '"好"' not in fm, fm  # inner quotes neutralized

# ---- next_archive_id ----
def test_next_archive_id():
    d = tempfile.mkdtemp()
    open(os.path.join(d, '1349.md'), 'w').write('---\nurl: /archives/1349/\n---\nx')
    open(os.path.join(d, '1488.md'), 'w').write('---\nurl: /archives/1488/\n---\ny')
    assert w.next_archive_id(d) == 1489

def test_next_archive_id_empty():
    d = tempfile.mkdtemp()
    assert w.next_archive_id(d) == 1

# ---- parse_items (WXR XML) ----
SAMPLE_WXR = '''<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<item>
  <title>第一篇</title>
  <link>https://huixianju.cn/archives/1</link>
  <wp:post_id>1</wp:post_id>
  <wp:post_date><![CDATA[2020-07-15 09:31:52]]></wp:post_date>
  <wp:post_name><![CDATA[hello]]></wp:post_name>
  <wp:status><![CDATA[publish]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <category domain="category" nicename="qita"><![CDATA[其他]]></category>
  <category domain="post_tag" nicename="t1"><![CDATA[标签甲]]></category>
  <content:encoded><![CDATA[<p>正文<a href="http://x.cn">链接</a></p>]]></content:encoded>
</item>
<item>
  <title>草稿不要</title>
  <link>https://huixianju.cn/archives/2</link>
  <wp:post_id>2</wp:post_id>
  <wp:post_date><![CDATA[2020-07-15 09:31:52]]></wp:post_date>
  <wp:post_name><![CDATA[draft]]></wp:post_name>
  <wp:status><![CDATA[draft]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <content:encoded><![CDATA[<p>x</p>]]></content:encoded>
</item>
<item>
  <title>关于</title>
  <link>https://huixianju.cn/about</link>
  <wp:post_id>9</wp:post_id>
  <wp:post_date><![CDATA[2020-07-15 09:31:52]]></wp:post_date>
  <wp:post_name><![CDATA[about]]></wp:post_name>
  <wp:status><![CDATA[publish]]></wp:status>
  <wp:post_type><![CDATA[page]]></wp:post_type>
  <content:encoded><![CDATA[<p>关于页</p>]]></content:encoded>
</item>
<item>
  <title>附件</title>
  <wp:post_id>5</wp:post_id>
  <wp:status><![CDATA[inherit]]></wp:status>
  <wp:post_type><![CDATA[attachment]]></wp:post_type>
  <content:encoded><![CDATA[]]></content:encoded>
</item>
</channel></rss>'''

def test_parse_posts_only_publish():
    posts = w.parse_items(SAMPLE_WXR, 'post')
    assert len(posts) == 1, [p['id'] for p in posts]   # draft excluded
    p = posts[0]
    assert p['id'] == 1
    assert p['title'] == '第一篇'
    assert p['url'] == '/archives/1/'           # trailing slash normalized
    assert p['categories'] == ['其他']           # only domain=category
    assert p['tags'] == ['标签甲']               # domain=post_tag
    assert '链接' in p['content']

PW_WXR = '''<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:wp="http://wordpress.org/export/1.2/">
<channel><item>
  <title>受保护</title><link>https://h.cn/archives/9</link>
  <wp:post_id>9</wp:post_id><wp:post_date><![CDATA[2020-01-01 00:00:00]]></wp:post_date>
  <wp:post_name><![CDATA[p]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <wp:post_password><![CDATA[secret]]></wp:post_password>
  <content:encoded><![CDATA[<p>机密</p>]]></content:encoded>
</item></channel></rss>'''

def test_password_protected_excluded():
    assert w.parse_items(PW_WXR, 'post') == []

CJK_WXR = '''<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:wp="http://wordpress.org/export/1.2/">
<channel><item>
  <title>二刷</title>
  <link>https://maggiacito.com/sculpting-in-time/%e4%ba%8c%e5%88%b7%e5%93%aa%e5%90%92/</link>
  <wp:post_id>30</wp:post_id><wp:post_date><![CDATA[2019-08-05 00:00:00]]></wp:post_date>
  <wp:post_name><![CDATA[x]]></wp:post_name><wp:status><![CDATA[publish]]></wp:status>
  <wp:post_type><![CDATA[post]]></wp:post_type>
  <content:encoded><![CDATA[<p>正文</p>]]></content:encoded>
</item></channel></rss>'''

def test_cjk_permalink_is_decoded():
    # WordPress percent-encodes CJK slugs in <link>. A static host decodes %xx
    # when matching the on-disk dir, so the url MUST be stored decoded (中文),
    # else Hugo makes a literal "%e4%.." dir that no decoded request can hit.
    p = w.parse_items(CJK_WXR, 'post')[0]
    assert p['url'] == '/sculpting-in-time/二刷哪吒/', repr(p['url'])

def test_modified_falls_back_to_date():
    posts = w.parse_items(SAMPLE_WXR, 'post')
    p = posts[0]
    assert p['modified'] == p['date']   # this WXR has no post_modified

def test_parse_pages():
    pages = w.parse_items(SAMPLE_WXR, 'page')
    assert len(pages) == 1
    assert pages[0]['slug'] == 'about'
    assert pages[0]['url'] == '/about/'

# ---- scaffolding page detection ----
def test_real_page_kept():
    assert w.is_real_page({'slug': 'about', 'title': '关于', 'content': '<p>我们是谁</p>'})

def test_empty_page_skipped():
    assert not w.is_real_page({'slug': 'archives', 'title': 'Archives', 'content': ''})

def test_shortcode_only_page_skipped():
    assert not w.is_real_page({'slug': 'login', 'title': '登录', 'content': '[xh_social_page_login]'})

def test_default_wp_slug_skipped():
    assert not w.is_real_page({'slug': 'sample-page', 'title': 'Sample Page',
                               'content': '<p>This is an example page.</p>'})


if __name__ == '__main__':
    fns = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    for fn in fns:
        fn()
        print('ok', fn.__name__)
    print('ALL PASS (%d tests)' % len(fns))
