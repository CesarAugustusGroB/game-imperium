"""Slice the Roman icon sprite-sheet into individual transparent PNGs.

The sheet is icons on a pure-white background, arranged in rows. We segment by
projecting the non-white mask onto Y (rows) then X (columns within each row),
crop each icon to a centered square, and flood-fill the border white to alpha 0
so each icon ends up on a transparent background (interior whites are preserved
because they're enclosed by non-white pixels).

Order matches the inventory list given to the user (33 icons across 6 rows).
"""
from PIL import Image
import numpy as np
from collections import deque
import os

SRC = r"C:\Users\Henrich von Kleist\Downloads\ChatGPT Image 1 jun 2026, 15_36_31.png"
OUT = r"C:\Users\Henrich von Kleist\workspace\Map2D\.claude\worktrees\experimentation\src\assets\ui\icons"
os.makedirs(OUT, exist_ok=True)

NAMES_BY_ROW = [
    # Row 1 — Hub sidebar nav + tutorial/abandon/collapse
    ["nav-forum", "nav-provinciae", "nav-consilium", "nav-exercitus", "nav-doctrinae",
     "nav-decreta", "nav-tutorial", "nav-abandon", "nav-prev", "nav-next"],
    # Row 2 — NODE_ICONS
    ["node-battle", "node-event", "node-rest", "node-boss"],
    # Row 3 — Hub misc (LinkButton arrow, supplies chip, treasury deltas)
    ["arrow-right", "supplies-crate", "delta-up", "delta-down"],
    # Row 4 — Campaign resources (CampaignResourceBar)
    ["res-soldiers", "res-morale", "res-discipline", "res-supplies", "res-threat"],
    # Row 5 — Operation card categories
    ["cat-logistica", "cat-movimiento", "cat-inteligencia", "cat-coercion",
     "cat-diplomacia", "cat-postura", "cat-operaciones", "cat-crisis"],
    # Row 6 — OperationCard quest / final battle
    ["op-quest", "op-final-battle"],
]

img = Image.open(SRC).convert("RGBA")
W, H = img.size
arr = np.array(img)
rgb = arr[:, :, :3].astype(np.int16)
white = (rgb[:, :, 0] > 238) & (rgb[:, :, 1] > 238) & (rgb[:, :, 2] > 238)
content = ~white


def segments(mask_1d, thr, min_len):
    out, start, inb = [], 0, False
    for i, v in enumerate(mask_1d):
        if v > thr and not inb:
            start, inb = i, True
        elif v <= thr and inb:
            out.append((start, i)); inb = False
    if inb:
        out.append((start, len(mask_1d)))
    return [(a, b) for (a, b) in out if b - a >= min_len]


def flood_clear(im):
    a = np.array(im)
    h, w = a.shape[:2]
    rf = a[:, :, :3].astype(np.int16)
    is_white = (rf[:, :, 0] > 232) & (rf[:, :, 1] > 232) & (rf[:, :, 2] > 232)
    visited = np.zeros((h, w), bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_white[y, x] and not visited[y, x]:
                visited[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_white[y, x] and not visited[y, x]:
                visited[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_white[ny, nx]:
                visited[ny, nx] = True; dq.append((ny, nx))
    a[visited, 3] = 0
    return Image.fromarray(a)


rows = segments(content.sum(axis=1), thr=5, min_len=30)
print(f"Detected {len(rows)} rows")

total = 0
for ri, (ya, yb) in enumerate(rows):
    band = content[ya:yb, :]
    cols = segments(band.sum(axis=0), thr=3, min_len=20)
    names = NAMES_BY_ROW[ri] if ri < len(NAMES_BY_ROW) else None
    exp = len(names) if names else "?"
    print(f"Row {ri}: {len(cols)} icons (expected {exp})")
    for ci, (xa, xb) in enumerate(cols):
        pad = 6
        x0, x1, y0, y1 = xa - pad, xb + pad, ya - pad, yb + pad
        side = max(x1 - x0, y1 - y0)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        x0, y0 = cx - side // 2, cy - side // 2
        x1, y1 = x0 + side, y0 + side
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        crop = flood_clear(img.crop((x0, y0, x1, y1)))
        if names and ci < len(names):
            name = names[ci]
        else:
            name = f"row{ri}-extra{ci}"
        crop.save(os.path.join(OUT, name + ".png"))
        total += 1

print("TOTAL", total)
