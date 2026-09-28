"""
Draws the home-screen icon: a ticked box, the app's one action, in the
mockup's green and paper colours.

    py tools/icons.py        # writes src/icons/*.png (needs Pillow)

The PNGs are committed, so this only runs again if the design changes.
Drawn 4x larger and scaled down, since Pillow doesn't smooth its edges.
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "src" / "icons"
GREEN = "#2F5D50"  # --green
PAPER = "#F5F1E8"  # --paper
SS = 4


def icon(size: int) -> Image.Image:
    n = size * SS
    img = Image.new("RGB", (n, n), GREEN)  # full bleed: iOS rounds the corners itself
    d = ImageDraw.Draw(img)
    # The box sits well inside the middle 80%, so Android's round masks keep it whole.
    box = n * 0.50
    x0 = (n - box) / 2
    d.rounded_rectangle([x0, x0, x0 + box, x0 + box], radius=box * 0.22, fill=PAPER)
    # The tick from ui/html.js (M5 12.5 l4.5 4.5 L19 7.5 on a 24 grid), inside the box.
    u = box / 24
    pts = [(x0 + x * u, x0 + y * u) for x, y in [(5.6, 12.6), (9.8, 16.8), (18.4, 7.8)]]
    w = round(3.0 * u)
    d.line(pts, fill=GREEN, width=w, joint="curve")
    for x, y in (pts[0], pts[-1]):  # round ends
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=GREEN)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
        icon(size).save(OUT / name, optimize=True)
        print(OUT / name)


if __name__ == "__main__":
    main()
