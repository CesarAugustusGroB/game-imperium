#!/usr/bin/env python
"""Tightly crop + recenter the stat medallion icons.

The raw `stat-*-generated.png` assets are 768x768 with the medallion off-center
and, for some, a faint detached element below the disc (a stray shadow/ellipse).
This trims each icon to just the main disc (dropping anything separated by a gap
of empty rows/columns) and recenters it on a square canvas with a small uniform
margin, so every stat icon reads at a consistent size and has nothing "below".

Idempotent — safe to re-run (e.g. after the icons are regenerated from source).

    python tools/crop-stat-icons.py
"""
from PIL import Image
import numpy as np
import glob
import os

ICONS_GLOB = 'src/assets/ui/icons/stat-*-generated.png'
ALPHA_T = 24    # ignore faint detached bits below this alpha
FILL = 0.92     # disc fills 92% of the square → small uniform margin, centered


def main_run(counts):
    """(start, end) of the contiguous occupied run containing the peak count."""
    occ = counts > 0
    runs, s = [], None
    for i, v in enumerate(occ):
        if v and s is None:
            s = i
        if (not v) and s is not None:
            runs.append((s, i - 1)); s = None
    if s is not None:
        runs.append((s, len(occ) - 1))
    peak = int(np.argmax(counts))
    for r in runs:
        if r[0] <= peak <= r[1]:
            return r, runs
    return (0, len(counts) - 1), runs


def crop_icon(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)[:, :, 3]
    (ry0, ry1), rruns = main_run((a >= ALPHA_T).sum(axis=1))
    (cx0, cx1), cruns = main_run((a[ry0:ry1 + 1, :] >= ALPHA_T).sum(axis=0))
    disc = im.crop((cx0, ry0, cx1 + 1, ry1 + 1))
    cw, ch = disc.size
    side = round(max(cw, ch) / FILL)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(disc, ((side - cw) // 2, (side - ch) // 2), disc)
    canvas.save(path)
    return cw, ch, side, (len(rruns) - 1) + (len(cruns) - 1)


def main():
    files = sorted(glob.glob(ICONS_GLOB))
    if not files:
        print(f'No icons matched {ICONS_GLOB}'); return
    for f in files:
        cw, ch, side, dropped = crop_icon(f)
        print(f'{os.path.basename(f):28} disc {cw}x{ch} -> {side}x{side}  (dropped {dropped} detached run(s))')


if __name__ == '__main__':
    main()
