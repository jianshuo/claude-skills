"""Assert every converted post's /archives/<id>/ URL is present in public/.

Run after `hugo --gc --minify`. Reads the WXR to know which post IDs were
published (excludes drafts, attachments, password-protected — matching the
converter), then checks public/archives/<id>/index.html exists for each.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import wxr_to_hugo as w


def main(xml_path):
    posts = w.parse_items(open(xml_path, encoding='utf-8').read(), 'post')
    missing = []
    for p in posts:
        url = p['url'].strip('/')                      # archives/123
        path = os.path.join('public', url, 'index.html')
        if not os.path.exists(path):
            missing.append(p['id'])
    print('checked %d posts, missing %d' % (len(posts), len(missing)))
    if missing:
        print('MISSING:', missing[:30])
        sys.exit(1)
    print('ALL ARCHIVE URLS PRESENT')


if __name__ == '__main__':
    xmls = [a for a in sys.argv[1:] if a.lower().endswith('.xml')]
    if not xmls:
        xmls = [f for f in os.listdir('.') if f.lower().endswith('.xml')]
    main(xmls[0])
