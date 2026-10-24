"""Jewel icon family: four home-screen icons that belong together.

Every icon is the same recipe: a midnight square lit by a gemstone glow, and a
luminous glyph built from the same stroke weight. Only the gem and the glyph
change: Mongolian = sapphire, Life Hub = emerald, Gym = ruby, Portfolio = gold.

Shapes are signed distance fields (numpy), so edges are exact at any size.
Run:  py jewel_icons.py OUTDIR
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

N = 2048                      # render size; masters are downsampled to 1024
W = 0.062                     # the family's stroke weight (fraction of the icon)

GEMS = {
    #            base top     base bottom  glow         glyph light  glyph deep
    "sapphire": ("#0B1B3D", "#03060F", "#2F6BFF", "#E8F1FF", "#7FB0FF"),
    "emerald":  ("#06291F", "#020A07", "#14C98A", "#E6FFF4", "#62E3B0"),
    "ruby":     ("#3A0A18", "#0D0206", "#FF2E5B", "#FFE8EE", "#FF7D99"),
    "gold":     ("#2E2006", "#0B0702", "#F0A92A", "#FFF6DF", "#F6C65B"),
}


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


# ---- signed distance fields, in icon units (0..1) ---------------------------
_ax = (np.arange(N, dtype=np.float32) + 0.5) / N
X, Y = np.meshgrid(_ax, _ax)
PX = 1.0 / N


def circle(cx, cy, r):
    return np.hypot(X - cx, Y - cy) - r


def segment(ax, ay, bx, by, w=W):
    pax, pay, bax, bay = X - ax, Y - ay, bx - ax, by - ay
    h = np.clip((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1)
    return np.hypot(pax - bax * h, pay - bay * h) - w / 2


def polyline(pts, w=W):
    return np.minimum.reduce([segment(*a, *b, w=w) for a, b in zip(pts, pts[1:])])


def arc(cx, cy, r, a0, a1, w=W):
    """Clockwise from a0 to a1 (degrees, 0 = 12 o'clock), round caps."""
    ang = (np.degrees(np.arctan2(X - cx, -(Y - cy))) - a0) % 360
    on = ang <= (a1 - a0)
    d_ring = np.abs(np.hypot(X - cx, Y - cy) - r)
    ends = []
    for a in (a0, a1):
        t = np.radians(a)
        ends.append(np.hypot(X - (cx + r * np.sin(t)), Y - (cy - r * np.cos(t))))
    return np.where(on, d_ring, np.minimum(*ends)) - w / 2


def rbox(cx, cy, hw, hh, rad):
    qx, qy = np.abs(X - cx) - hw + rad, np.abs(Y - cy) - hh + rad
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - rad


def round_cone(ax, ay, r1, bx, by, r2):
    """Teardrop between a big circle (a, r1) and a small one (b, r2)."""
    px, py = X - ax, Y - ay
    L = np.hypot(bx - ax, by - ay)
    ux, uy = (bx - ax) / L, (by - ay) / L
    y = px * ux + py * uy                      # along the axis
    x = np.abs(-px * uy + py * ux)             # across it
    b = (r1 - r2) / L
    a = np.sqrt(1 - b * b)
    k = -x * b + y * a
    return np.where(k < 0, np.hypot(x, y) - r1,
                    np.where(k > a * L, np.hypot(x, y - L) - r2, x * a + y * b - r1))


def cover(sdf):
    return np.clip(0.5 - sdf / PX, 0, 1).astype(np.float32)


# ---- glyphs: each returns (main coverage, faint coverage) --------------------
def glyph_mongolian():
    # Soyombo crown: flame over sun over a cradling moon
    moon = np.maximum(circle(0.5, 0.585, 0.205), -circle(0.5, 0.505, 0.200))
    sun = circle(0.5, 0.468, 0.082)
    flame = round_cone(0.5, 0.318, 0.058, 0.5, 0.168, 0.014)
    return cover(np.minimum.reduce([moon, sun, flame])), None


def glyph_lifehub():
    # three habit rings: habits, rituals, goals
    rings = [(0.272, 305), (0.183, 245), (0.094, 335)]
    main = np.minimum.reduce([arc(0.5, 0.5, r, 0, sweep) for r, sweep in rings])
    track = np.minimum.reduce([arc(0.5, 0.5, r, 0, 359.99) for r, _ in rings])
    return cover(main), cover(track)


def glyph_gym():
    bar = rbox(0.5, 0.5, 0.20, 0.026, 0.026)
    inner = np.minimum(rbox(0.335, 0.5, 0.044, 0.165, 0.034), rbox(0.665, 0.5, 0.044, 0.165, 0.034))
    outer = np.minimum(rbox(0.237, 0.5, 0.036, 0.112, 0.030), rbox(0.763, 0.5, 0.036, 0.112, 0.030))
    caps = np.minimum(rbox(0.178, 0.5, 0.03, 0.026, 0.026), rbox(0.822, 0.5, 0.03, 0.026, 0.026))
    return cover(np.minimum.reduce([bar, inner, outer, caps])), None


def glyph_portfolio():
    pts = [(0.215, 0.665), (0.385, 0.525), (0.515, 0.6), (0.735, 0.345)]
    line = polyline(pts)
    dot = circle(*pts[-1], 0.058)
    halo = np.abs(circle(*pts[-1], 0.098)) - 0.012
    # soft area under the line, fading downward
    xs = np.array([p[0] for p in pts]); ys = np.array([p[1] for p in pts])
    top = np.interp(_ax, xs, ys)[None, :]
    sides = np.clip((X - pts[0][0]) / 0.10, 0, 1) * np.clip((pts[-1][0] - X) / 0.04, 0, 1)
    fade = np.clip(1 - (Y - top) / 0.30, 0, 1) ** 1.6
    area = np.where(Y > top, fade * sides * 0.9, 0).astype(np.float32)
    faint = np.maximum(area, cover(halo) * 0.55)
    return cover(np.minimum(line, dot)), faint


# ---- the shared recipe -------------------------------------------------------
def render(glyph, gem):
    top, bottom, glow, light, deep = map(rgb, GEMS[gem])
    main, faint = glyph()

    # midnight base, lit from the upper left
    t = np.clip(X * 0.35 + Y * 0.75, 0, 1)[..., None]
    img = top * (1 - t) + bottom * t

    # gemstone bloom behind the glyph
    d2 = ((X - 0.5) ** 2 + ((Y - 0.47) / 1.05) ** 2)[..., None]
    img = 1 - (1 - img) * (1 - glow * 0.42 * np.exp(-d2 / 0.055))
    # glassy sheen across the top
    sheen = np.clip(1 - Y / 0.5, 0, 1) ** 2 * np.exp(-((X - 0.3) ** 2) / 0.25) * 0.07
    img = img + sheen[..., None]

    def blur(a, r):
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L")
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r * N)), np.float32) / 255

    # shadow under, then a coloured glow around, the glyph
    shadow = np.roll(blur(main, 0.018), int(0.018 * N), axis=0)[..., None]
    img = img * (1 - 0.45 * shadow)
    halo = blur(main, 0.05)[..., None]
    img = 1 - (1 - img) * (1 - glow * 0.75 * halo)

    # luminous fill: near-white at the top of the glyph, gem colour below
    rows = np.where(main.max(axis=1) > 0.5)[0]
    y0, y1 = rows[0] / N, rows[-1] / N
    g = np.clip((Y - y0) / (y1 - y0), 0, 1)[..., None] ** 1.15
    fill = light * (1 - g) + deep * g
    if faint is not None:                      # ring tracks, chart area: a tint, not a shape
        f = faint[..., None] * 0.22
        img = img * (1 - f) + deep * f
    m = main[..., None]
    img = img * (1 - m) + fill * m
    # a hairline of light along each glyph's upper edge
    edge = np.clip(main - np.roll(main, int(0.006 * N), axis=0), 0, 1)[..., None]
    img = img + edge * 0.18

    out = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
    return out.resize((1024, 1024), Image.LANCZOS)


APPS = {
    "mongolian": (glyph_mongolian, "sapphire"),
    "life-hub": (glyph_lifehub, "emerald"),
    "gym": (glyph_gym, "ruby"),
    "portfolio": (glyph_portfolio, "gold"),
}

if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "jewel")
    only = sys.argv[2:] or list(APPS)
    rng = np.random.default_rng(7)
    for name in only:
        glyph, gem = APPS[name]
        master = render(glyph, gem)
        # a whisper of grain so the gradients never band
        a = np.asarray(master, np.float32) + rng.normal(0, 0.8, (1024, 1024, 1))
        master = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
        d = out / name
        d.mkdir(parents=True, exist_ok=True)
        master.save(d / "icon-1024.png", optimize=True)
        for size, fname in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")):
            master.resize((size, size), Image.LANCZOS).save(d / fname, optimize=True)
        print("wrote", d)
