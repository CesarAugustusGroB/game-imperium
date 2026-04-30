"""Generate placeholder PNGs for the campaign hex Pixi asset bundle (S31-01).

Real painterly art replaces these in S31-06 (terrain) and S31-08 (event icons).
Decoration art arrives whenever S31-07 lands.

Run: python tools/generate-campaign-placeholders.py
Outputs go to public/asset/campaign/{terrain,events,decoration}/.
"""

from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "asset" / "campaign"

TERRAIN_COLORS = {
    "plains":    (0x6b, 0x6f, 0x32),
    "forest":    (0x1f, 0x4a, 0x24),
    "hills":     (0x7a, 0x5b, 0x32),
    "mountains": (0x77, 0x70, 0x6a),
    "river":     (0x1e, 0x5d, 0x7a),
    "road":      (0x9b, 0x7a, 0x45),
    "camp":      (0x28, 0x4f, 0x35),
    "ruins":     (0x5a, 0x50, 0x46),
}

EVENT_COLORS = {
    "battle":   (0xc7, 0x50, 0x3a),
    "supply":   (0xd8, 0xaa, 0x55),
    "ambush":   (0xb0, 0x30, 0x30),
    "rest":     (0x55, 0xc7, 0x83),
    "merchant": (0xb4, 0x8c, 0xff),
    "story":    (0xe0, 0xd2, 0xa0),
    "elite":    (0xff, 0xcc, 0x55),
}

DECORATION_KEYS = ("tree-cluster", "peak", "ripple", "milestone", "ridge", "tent")

TERRAIN_SIZE = 128
EVENT_SIZE = 64
DECORATION_SIZE = 64


def hex_polygon(cx: float, cy: float, radius: float) -> list[tuple[float, float]]:
    """Pointy-top hex centered at (cx, cy)."""
    points: list[tuple[float, float]] = []
    for i in range(6):
        angle_deg = 60 * i - 30
        angle = math.radians(angle_deg)
        points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


def write_terrain(name: str, rgb: tuple[int, int, int]) -> Path:
    img = Image.new("RGBA", (TERRAIN_SIZE, TERRAIN_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = TERRAIN_SIZE / 2 - 2
    polygon = hex_polygon(TERRAIN_SIZE / 2, TERRAIN_SIZE / 2, radius)
    fill = (*rgb, 200)
    outline = tuple(max(0, c - 40) for c in rgb) + (255,)
    draw.polygon(polygon, fill=fill, outline=outline, width=2)
    out_path = OUT / "terrain" / f"{name}.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    return out_path


def write_event(name: str, rgb: tuple[int, int, int]) -> Path:
    img = Image.new("RGBA", (EVENT_SIZE, EVENT_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = EVENT_SIZE / 2, EVENT_SIZE / 2
    r_outer = EVENT_SIZE / 2 - 4
    r_inner = r_outer - 6
    draw.ellipse(
        (cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer),
        fill=(*rgb, 220),
        outline=(0, 0, 0, 200),
        width=2,
    )
    inner_rgb = tuple(min(255, c + 40) for c in rgb)
    draw.ellipse(
        (cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner),
        fill=(*inner_rgb, 255),
    )
    out_path = OUT / "events" / f"{name}.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    return out_path


def write_decoration(name: str) -> Path:
    img = Image.new("RGBA", (DECORATION_SIZE, DECORATION_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = DECORATION_SIZE / 2, DECORATION_SIZE / 2

    if name == "tree-cluster":
        for offset in ((-12, 4), (0, -2), (12, 4)):
            ox, oy = offset
            draw.polygon(
                [(cx + ox, cy + oy - 14), (cx + ox - 10, cy + oy + 10), (cx + ox + 10, cy + oy + 10)],
                fill=(0x1f, 0x4a, 0x24, 230),
                outline=(0x10, 0x28, 0x14, 255),
            )
    elif name == "peak":
        draw.polygon(
            [(cx, cy - 22), (cx - 22, cy + 18), (cx + 22, cy + 18)],
            fill=(0x77, 0x70, 0x6a, 230),
            outline=(0x44, 0x40, 0x3a, 255),
        )
        draw.polygon(
            [(cx, cy - 22), (cx - 6, cy - 8), (cx + 6, cy - 8)],
            fill=(0xee, 0xee, 0xf0, 230),
        )
    elif name == "ripple":
        for radius in (16, 10, 5):
            draw.arc(
                (cx - radius, cy - radius // 2, cx + radius, cy + radius // 2),
                start=200,
                end=340,
                fill=(0x6f, 0xb8, 0xd6, 230),
                width=2,
            )
    elif name == "milestone":
        draw.rectangle(
            (cx - 6, cy - 16, cx + 6, cy + 16),
            fill=(0x9b, 0x7a, 0x45, 230),
            outline=(0x4d, 0x3a, 0x1e, 255),
        )
        draw.line((cx - 4, cy - 8, cx + 4, cy - 8), fill=(0x2a, 0x1f, 0x10, 255), width=1)
        draw.line((cx - 4, cy, cx + 4, cy), fill=(0x2a, 0x1f, 0x10, 255), width=1)
    elif name == "ridge":
        # S32-10: hill ridge crest — three low triangle peaks, brown-gold tone.
        for ox in (-14, 0, 14):
            draw.polygon(
                [(cx + ox, cy + 4), (cx + ox - 9, cy + 14), (cx + ox + 9, cy + 14)],
                fill=(0x7a, 0x5b, 0x32, 230),
                outline=(0x4a, 0x36, 0x1e, 255),
            )
    elif name == "tent":
        # S32-10: simple tent silhouette + smoke wisp above.
        # Tent body: triangle with a small dark "entrance" notch at the base.
        draw.polygon(
            [(cx, cy - 6), (cx - 16, cy + 14), (cx + 16, cy + 14)],
            fill=(0xc8, 0xa0, 0x60, 235),
            outline=(0x5a, 0x40, 0x20, 255),
        )
        # Entrance: dark vertical slit at center base.
        draw.polygon(
            [(cx - 3, cy + 14), (cx + 3, cy + 14), (cx, cy + 4)],
            fill=(0x32, 0x22, 0x10, 255),
        )
        # Smoke wisp: three small grey ellipses rising from above the tent peak.
        for i, (sy, r) in enumerate(((-14, 3), (-20, 4), (-26, 5))):
            sx_offset = 2 if i % 2 else -2
            draw.ellipse(
                (cx + sx_offset - r, cy + sy - r, cx + sx_offset + r, cy + sy + r),
                fill=(0xb0, 0xb0, 0xb0, 180 - i * 30),
            )
    else:
        raise ValueError(f"Unknown decoration: {name}")

    out_path = OUT / "decoration" / f"{name}.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    return out_path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, rgb in TERRAIN_COLORS.items():
        written.append(write_terrain(name, rgb))
    for name, rgb in EVENT_COLORS.items():
        written.append(write_event(name, rgb))
    for name in DECORATION_KEYS:
        written.append(write_decoration(name))
    for path in written:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
