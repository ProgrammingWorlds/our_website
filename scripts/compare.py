"""Side-by-side comparison sheets: reference crop vs. captured scene.

python scripts/compare.py [lang]   (default: en) -> screenshots/compare/<scene>-<lang>.png
The reference composite is 723x2172: dark column on the left, light on the right.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
REF = Image.open(ROOT / 'reference' / 'reference.png').convert('RGB')
K = REF.width / 666  # section bounds below were measured on a 666px-wide preview
BOUNDS = {
    'home': (0, 285), 'services': (285, 590), 'about': (590, 830), 'process': (830, 1050),
    'projects': (1050, 1320), 'future': (1320, 1590), 'contact': (1590, 1930), 'footer': (1930, 2000),
}
COL = REF.width // 2
W = 520
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
out = ROOT / 'screenshots' / 'compare'
out.mkdir(parents=True, exist_ok=True)


def fit(im, w=W):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


for scene, (y0, y1) in BOUNDS.items():
    tiles = []
    for i, theme in enumerate(['dark', 'light']):
        ref = REF.crop((i * COL + (1 if i else 0), round(y0 * K), (i + 1) * COL, round(y1 * K)))
        shot_path = ROOT / 'screenshots' / f'{theme}-{lang}-{scene}.png'
        tiles.append(('reference ' + theme, fit(ref)))
        if shot_path.exists():
            shot = Image.open(shot_path).convert('RGB')
            if scene == 'footer':
                shot = shot.crop((0, shot.height - 140, shot.width, shot.height))
            tiles.append((f'build {theme}-{lang}', fit(shot)))
    h = max(t.height for _, t in tiles) + 24
    sheet = Image.new('RGB', (W * len(tiles) + 10 * (len(tiles) - 1), h), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    for j, (label, t) in enumerate(tiles):
        x = j * (W + 10)
        d.text((x + 6, 4), label, fill=(230, 230, 230))
        sheet.paste(t, (x, 24))
    sheet.save(out / f'{scene}-{lang}.png')
    print('wrote', out / f'{scene}-{lang}.png')
