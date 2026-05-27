"""Generate README screenshots for AILatest Journal"""
import os
from PIL import Image, ImageDraw

BASE = '/Users/zhizhi/Library/CloudStorage/GoogleDrive-jiantaoweng@gmail.com/我的云端硬盘/AI 工作区/00_每日更新/ailatest-journal'
os.makedirs(f'{BASE}/screenshots', exist_ok=True)

w, h = 1200, 750

def rrect(draw, xy, fill, radius=4):
    x1,y1,x2,y2 = xy
    r = min(radius, (x2-x1)//2, (y2-y1)//2)
    if r <= 0:
        draw.rectangle([(x1, y1), (x2, y2)], fill=fill)
        return
    draw.rectangle([(x1+r, y1), (x2-r, y2)], fill=fill)
    draw.rectangle([(x1, y1+r), (x2, y2-r)], fill=fill)
    draw.ellipse([(x1, y1), (x1+2*r, y1+2*r)], fill=fill)
    draw.ellipse([(x2-2*r, y1), (x2, y1+2*r)], fill=fill)
    draw.ellipse([(x1, y2-2*r), (x1+2*r, y2)], fill=fill)
    draw.ellipse([(x2-2*r, y2-2*r), (x2, y2)], fill=fill)

# Screenshot 1: Main dashboard
img = Image.new('RGB', (w, h), (245, 246, 250))
d = ImageDraw.Draw(img)

# Sidebar
d.rectangle([(0, 0), (200, h)], fill=(30, 35, 50))
d.text((24, 24), 'AILatest Journal', fill=(255,255,255))
items = [('International', True), ('China', False), ('Favorites', False), ('Pick for Me', False)]
iy = 70
for label, active in items:
    if active:
        rrect(d, (16, iy, 184, iy+32), fill=(55, 60, 85), radius=6)
    d.text((26, iy+6), label, fill=(255,255,255) if active else (160,170,190))
    iy += 40

# Search bar
d.rectangle([(218, 18), (1180, 56)], fill=(255,255,255), outline=(220,222,228))
d.text((234, 30), 'Search: title / abbr / ISSN / Chinese name', fill=(160,165,175))

# Table header
d.rectangle([(218, 92), (1180, 118)], fill=(235, 237, 242))
d.text((234, 98), 'Title            SCIE  SSCI  CAS  JCR Q  IF      ESI Category', fill=(100,105,120))

# Rows
journals = [
    ('Nature', True, True, '1', 'Q1', '50.5', 'Multidisciplinary'),
    ('Science', True, False, '1', 'Q1', '56.9', 'Multidisciplinary'),
    ('Cell', True, True, '1', 'Q1', '64.5', 'Mol. Bio. & Genetics'),
    ('Adv. Materials', True, False, '1', 'Q1', '27.4', 'Materials Science'),
    ('Build. Environ.', True, False, '2', 'Q1', '7.1', 'Engineering'),
    ('Energy Build.', True, False, '2', 'Q1', '6.6', 'Engineering'),
]
y = 122
for i, (name, scie, ssci, cas, q, iff, esi) in enumerate(journals):
    bg = (255,255,255) if i%2==0 else (248,249,252)
    d.rectangle([(218, y), (1180, y+38)], fill=bg, outline=(232,234,240))
    d.text((234, y+10), name, fill=(30,35,55))
    if scie:
        d.rectangle([(400, y+8), (440, y+28)], fill=(40,120,200))
        d.text((406, y+12), 'SCIE', fill=(255,255,255))
    if ssci:
        d.rectangle([(444, y+8), (484, y+28)], fill=(200,80,70))
        d.text((450, y+12), 'SSCI', fill=(255,255,255))
    d.rectangle([(488, y+8), (528, y+28)], fill=(180,100,40))
    d.text((494, y+12), f'CAS {cas}', fill=(255,255,255))
    d.rectangle([(532, y+8), (578, y+28)], fill=(40,160,80))
    d.text((538, y+12), f'JCR {q}', fill=(255,255,255))
    d.text((594, y+10), iff, fill=(80,85,100))
    d.text((680, y+10), esi, fill=(140,145,155))
    y += 40

d.text((234, y+10), 'Showing 1-20 of 44,844 journals', fill=(120,125,140))

# Footer bar
d.rectangle([(0, h-36), (w, h)], fill=(30,35,50))
d.text((24, h-26), '44,844 journals  SCIE 9,527  SSCI 3,557  AHCI 1,819  ESCI 9,449  EI 4,503  Scopus 29,817  DOAJ 21,395', fill=(180,190,210))

img.save(f'{BASE}/screenshots/preview.png')
print(f'Done: preview.png')

# Screenshot 2: Pick for me
img2 = Image.new('RGB', (w, h), (245, 246, 250))
d2 = ImageDraw.Draw(img2)

d2.rectangle([(0, 0), (200, h)], fill=(30, 35, 50))
d2.text((24, 24), 'AILatest Journal', fill=(255,255,255))

d2.text((240, 24), 'Pick for Me - Journal Recommendation', fill=(30,35,55))
rrect(d2, (220, 60, 960, 130), fill=(255,255,255), radius=8)
d2.text((240, 76), 'Enter paper title, abstract or keywords...', fill=(150,155,165))
d2.text((240, 100), 'indoor air quality occupancy estimation machine learning', fill=(190,195,200))
d2.rectangle([(240, 108), (340, 124)], fill=(50, 110, 200))
d2.text((252, 110), 'Start', fill=(255,255,255))

d2.text((240, 150), 'Match Topics  IF > __  Scopus only  CAS Zone: All ▼  Exclude multidisciplinary', fill=(120,125,140))
d2.text((240, 178), 'Recommended — 35 journals matched', fill=(80,85,100))

cards = [
    ('Building and Environment', 12, 92, '#1a8b3c'),
    ('Energy and Buildings', 8, 78, '#2d9d5e'),
    ('Indoor Air', 5, 65, '#d4a017'),
    ('Sci. Technol. Built Environ.', 3, 42, '#5a8fc9'),
]
cy = 210
for name, count, score, color in cards:
    r, g, b = (26,139,60) if color=='#1a8b3c' else (45,157,94) if color=='#2d9d5e' else (212,160,23) if color=='#d4a017' else (90,143,201)
    rrect(d2, (220, cy, 960, cy+85), fill=(255,255,255), radius=6)
    d2.rectangle([(220, cy), (224, cy+85)], fill=(r,g,b))
    d2.text((240, cy+8), name, fill=(30,35,55))
    d2.text((240, cy+30), 'SCIE  CAS 2  JCR Q1', fill=(100,105,120))
    d2.text((860, cy+10), f'{count}', fill=(30,35,55))
    d2.text((878, cy+10), 'papers', fill=(140,145,155))
    d2.rectangle([(830, cy+40), (940, cy+48)], fill=(232,234,240))
    d2.rectangle([(830, cy+40), (830+int(110*score/100), cy+48)], fill=(r,g,b))
    d2.text((950, cy+36), f'{score}%', fill=(30,35,55))
    cy += 92

img2.save(f'{BASE}/screenshots/pick-tool.png')
print(f'Done: pick-tool.png')

# Screenshot 3: Journal detail drawer
img3 = Image.new('RGB', (w, h), (200, 205, 215))
d3 = ImageDraw.Draw(img3)

d3.rectangle([(0, 0), (w-380, h)], fill=(218, 220, 226))
d3.rectangle([(w-380, 0), (w, h)], fill=(255,255,255))

d3.text((w-360, 20), 'Building and Environment', fill=(30,35,55))
d3.text((w-360, 44), 'Build. Environ.  ISSN: 0360-1323', fill=(140,145,155))

d3.rectangle([(w-360, 72), (w-312, 90)], fill=(40,120,200))
d3.text((w-354, 74), 'SCIE', fill=(255,255,255))
d3.rectangle([(w-308, 72), (w-260, 90)], fill=(200,80,70))
d3.text((w-302, 74), 'SSCI', fill=(255,255,255))
d3.rectangle([(w-256, 72), (w-208, 90)], fill=(40,160,80))
d3.text((w-250, 74), 'JCR Q1', fill=(255,255,255))

info = [('IF 2024', '7.1'), ('CAS Zone', '2 区 \xb7 TOP'), ('ESI', 'Engineering'), ('Publisher', 'Elsevier'), ('Review Cycle', 'Median 78 days')]
iy = 106
for label, val in info:
    d3.text((w-360, iy), label, fill=(140,145,155))
    d3.text((w-360, iy+18), val, fill=(30,35,55))
    iy += 46

d3.text((w-360, iy+4), 'Research Topics', fill=(100,105,120))
topics = ['Indoor Air Quality', 'Building Energy', 'Thermal Comfort']
tx = w-360
for t in topics:
    rrect(d3, (tx, iy+24, tx+len(t)*7+16, iy+44), fill=(230,235,245), radius=10)
    d3.text((tx+8, iy+30), t, fill=(80,85,100))
    tx += len(t)*7 + 20

img3.save(f'{BASE}/screenshots/drawer.png')
print(f'Done: drawer.png')
