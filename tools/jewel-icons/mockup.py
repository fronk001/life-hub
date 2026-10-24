"""Home-screen mockup: the four icons on a dark and a light wallpaper."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

src = sys.argv[1]
names = [("mongolian", "Mongolian"), ("life-hub", "Life Hub"), ("gym", "Gym"), ("portfolio", "Portfolio")]
ICON, GAP, PAD = 180, 74, 70
Wd = PAD * 2 + ICON * 4 + GAP * 3
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 30)

def squircle(n):
    m = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, n * 4 - 1, n * 4 - 1], radius=int(n * 4 * 0.225), fill=255)
    return m.resize((n, n), Image.LANCZOS)

def wallpaper(w, h, cols):
    y, x = np.mgrid[0:h, 0:w] / max(w, h)
    img = np.zeros((h, w, 3), np.float32) + np.array(cols[0], np.float32)
    for (cx, cy, r, c) in cols[1:]:
        img += np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / r)[..., None] * np.array(c, np.float32)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

mask = squircle(ICON)
rows = [
    ("dark", wallpaper(Wd, 330, [(14, 14, 24), (0.15, 0.1, 0.08, (60, 40, 120)), (0.85, 0.5, 0.1, (20, 70, 90))]), (255, 255, 255)),
    ("light", wallpaper(Wd, 330, [(232, 226, 236), (0.2, 0.2, 0.08, (10, 20, 30)), (0.8, 0.6, 0.1, (-20, 0, 15))]), (255, 255, 255)),
]
big = Image.new("RGB", (Wd, 330 * 2), 0)
for r, (kind, wp, ink) in enumerate(rows):
    d = ImageDraw.Draw(wp)
    for i, (key, label) in enumerate(names):
        ic = Image.open(f"{src}/{key}/icon-1024.png").resize((ICON, ICON), Image.LANCZOS)
        x, y = PAD + i * (ICON + GAP), 50
        sh = Image.new("L", wp.size, 0); sh.paste(mask, (x, y + 6)); sh = sh.filter(ImageFilter.GaussianBlur(10))
        wp = Image.composite(Image.new("RGB", wp.size, (0, 0, 0)), wp, sh.point(lambda v: v * 0.35))
        wp.paste(ic, (x, y), mask)
        d = ImageDraw.Draw(wp)
        tw = d.textlength(label, font=font)
        d.text((x + ICON / 2 - tw / 2 + 1, y + ICON + 18 + 1), label, font=font, fill=(0, 0, 0, 80))
        d.text((x + ICON / 2 - tw / 2, y + ICON + 18), label, font=font, fill=ink)
    big.paste(wp, (0, r * 330))
big.save(f"{src}/homescreen.png")
print("ok")
