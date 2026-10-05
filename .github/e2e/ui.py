# Reads an Android screen (uiautomator XML) for the emulator check (.github/e2e/shots.sh).
#   python3 ui.py screen.xml NAVTOP name            -> UI lines (every labelled element and its place) and OVERLAP lines
#   python3 ui.py screen.xml 0 tap 'regex' [last]   -> "x y" of the first (or the last) element whose text or
#                                                      description matches
#   python3 ui.py screen.xml NAVTOP bottom name     -> BOTTOM lines: every element, labelled or not, that reaches the
#                                                      last 400 px above the phone's bar (what sits at the bottom)
import re
import sys
import xml.etree.ElementTree as ET

path, navtop, name = sys.argv[1], int(sys.argv[2] or 0), sys.argv[3]
try:
    root = ET.parse(path).getroot()
except Exception as e:  # the dump can fail while the screen changes
    print('UI', name, 'unreadable', e)
    sys.exit(0)

def box(n):
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.get('bounds', ''))
    return tuple(int(x) for x in m.groups()) if m else None

nodes = []
for n in root.iter('node'):
    label = (n.get('content-desc') or '').strip() or (n.get('text') or '').strip()
    b = box(n)
    # a node scrolled out of its list comes with bounds turned inside out: not on screen
    if b and b[2] > b[0] and b[3] > b[1]: nodes.append((label, b, n))

if name == 'tap':
    rx = re.compile(sys.argv[4])
    hits = [b for label, b, n in nodes if label and rx.search(label) and b[2] > b[0] and b[3] > b[1]]
    if hits:
        b = hits[-1] if len(sys.argv) > 5 and sys.argv[5] == 'last' else hits[0]
        print((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
    sys.exit(0)

if name == 'bottom':
    who = sys.argv[4]
    for label, b, n in nodes:
        if navtop and b[3] >= navtop - 400:
            cls = (n.get('class') or '').split('.')[-1]
            print('BOTTOM', who, cls, ('[btn] ' if n.get('clickable') == 'true' else '') + label[:40].replace('\n', ' '), b)
    sys.exit(0)

content = next((b for label, b, n in nodes if n.get('resource-id') == 'android:id/content'), None)
print('UI', name, 'content', content, 'navtop', navtop)
for label, b, n in nodes:
    if not label: continue
    clickable = n.get('clickable') == 'true'
    print('UI', name, ('[btn] ' if clickable else '      ') + label[:70].replace('\n', ' '), b)
    if navtop and b[3] > navtop and b[1] < navtop + 4 and clickable:
        print('OVERLAP', name, label[:50], b, 'navtop', navtop)
    elif navtop and b[1] >= navtop:
        print('OVERLAP', name, '(under the bar)', label[:50], b, 'navtop', navtop)
