"""Stack per-scene captures into one full-page image per state: screenshots/<state>-full.png"""
from pathlib import Path
from PIL import Image
D = Path(__file__).resolve().parent.parent / 'screenshots'
SCENES = ['home', 'services', 'about', 'process', 'projects', 'future', 'contact', 'footer']
for state in ['dark-en', 'light-en', 'dark-ar', 'light-ar']:
    ims = []
    for s in SCENES:
        p = D / f'{state}-{s}.png'
        if not p.exists():
            continue
        im = Image.open(p).convert('RGB')
        if s == 'footer':
            im = im.crop((0, im.height - 140, im.width, im.height))
        ims.append(im)
    if not ims:
        continue
    w = 720
    ims = [i.resize((w, round(i.height * w / i.width)), Image.LANCZOS) for i in ims]
    out = Image.new('RGB', (w, sum(i.height for i in ims)))
    y = 0
    for i in ims:
        out.paste(i, (0, y)); y += i.height
    out.save(D / f'{state}-full.png', optimize=True)
    print('wrote', D / f'{state}-full.png')
