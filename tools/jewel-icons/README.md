# Jewel icons

The home-screen icons of Fred's four web apps, drawn by one script so they stay a
family: a full-bleed midnight square, a gemstone-coloured glow and a luminous glyph in
one shared stroke weight. Made 24 Oct 2026. Life Hub is the hub, so the generator lives
here; it is a tool only and is never published (`tools/build.py` copies `src/` alone).

| App | Gem | Glyph |
|---|---|---|
| Mongolian | sapphire | the Soyombo flame over sun and moon |
| Life Hub | emerald | three progress rings |
| Gym | ruby | a dumbbell |
| Portfolio Tracker | gold | a rising chart line |

## Run

Needs Pillow and numpy (`py -m pip install --user pillow numpy` if either is missing).
Run it from a **short** working-directory path (for example `C:\icons`, or this
folder): Windows' path-length limit broke `py` when it was started from a very long cwd.

```
py jewel_icons.py OUTDIR [app ...]     # app: mongolian, life-hub, gym, portfolio (default: all four)
py mockup.py OUTDIR                    # homescreen.png: the four icons on a dark and a light wallpaper
```

`OUTDIR/<app>/` gets `icon-1024.png` (the master, never shipped), `icon-512.png`,
`icon-192.png`, `apple-touch-icon.png` (180 px) and `favicon-32.png`. `mockup.py` reads
the masters, so run `jewel_icons.py` first. All files are opaque, square and not rounded:
iOS and Android apply their own mask, and the glyph sits inside the maskable safe zone,
so the one 512 file serves both `"purpose": "any"` and `"maskable"`.

Run all four apps together to get the shipped files byte for byte. The film grain that
stops gradients banding is seeded once per run, so generating a single app alone differs
from the shipped file by up to 3/255 in a few pixels (invisible, but not identical).

## Where the output goes

Each app is its own repository and ships its own copy of these files:

- **Life Hub** (this repo): `src/icons/` (`icon-512`, `icon-192`, `apple-touch-icon`,
  `favicon-32`), linked from `src/index.html` and `src/manifest.webmanifest`.
- **Mongolian**, **Gym** and **Portfolio Tracker** ship this generator's output too.
  Redraw here and copy that app's folder across; don't edit their icons by hand.

A phone keeps the old icon until the home-screen shortcut is removed and added again.
