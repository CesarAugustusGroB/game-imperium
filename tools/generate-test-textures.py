"""
Generate support textures (ID map, heightmap, normalmap, borders, topology)
derived from terrain_map.png as the source of truth.

Requires: pip install Pillow numpy
"""

import json
import math
import os
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUT_DIR = PROJECT_DIR / "public" / "textures"
DATA_DIR = PROJECT_DIR / "public" / "data"

random.seed(42)
np.random.seed(42)


def load_provinces():
    with open(DATA_DIR / "provinces.json") as f:
        data = json.load(f)
    return data["provinces"]


def generate_voronoi_provinces(provinces, width, height):
    """Generate Voronoi province ID map matching terrain dimensions."""
    num_provinces = len(provinces)
    seeds = []

    cols = int(math.ceil(math.sqrt(num_provinces * (width / height))))
    rows = int(math.ceil(num_provinces / cols))

    cell_w = width / cols
    cell_h = height / rows

    idx = 0
    for row in range(rows):
        for col in range(cols):
            if idx >= num_provinces:
                break
            cx = int(col * cell_w + cell_w * 0.5 + random.uniform(-cell_w * 0.3, cell_w * 0.3))
            cy = int(row * cell_h + cell_h * 0.5 + random.uniform(-cell_h * 0.3, cell_h * 0.3))
            cx = max(0, min(width - 1, cx))
            cy = max(0, min(height - 1, cy))
            seeds.append((cx, cy, idx))
            idx += 1

    id_map = np.zeros((height, width, 3), dtype=np.uint8)

    seed_x = np.array([s[0] for s in seeds])
    seed_y = np.array([s[1] for s in seeds])

    for y in range(height):
        dx = np.arange(width)[:, None] - seed_x[None, :]
        dy = y - seed_y
        dist = dx * dx + dy[None, :] * dy[None, :]
        nearest = np.argmin(dist, axis=1)

        for x in range(width):
            p_idx = nearest[x]
            if p_idx < len(provinces):
                color = provinces[p_idx]["color"]
                id_map[y, x] = color

    return Image.fromarray(id_map, 'RGB'), seeds


def generate_heightmap_from_terrain(terrain_img):
    """Derive heightmap from terrain image luminance."""
    gray = terrain_img.convert('L')
    # Slight blur to smooth out texture details
    gray = gray.filter(ImageFilter.GaussianBlur(radius=2))
    heightmap_data = np.array(gray, dtype=np.float64) / 255.0
    return heightmap_data


def heightmap_to_normalmap(heightmap_data, width, height, strength=3.0):
    """Convert heightmap to normal map using Sobel-like gradient."""
    normal = np.zeros((height, width, 3), dtype=np.uint8)

    for y in range(height):
        for x in range(width):
            left  = heightmap_data[y, max(0, x - 1)]
            right = heightmap_data[y, min(width - 1, x + 1)]
            up    = heightmap_data[max(0, y - 1), x]
            down  = heightmap_data[min(height - 1, y + 1), x]

            dx = (right - left) * strength
            dy = (down - up) * strength

            nx = -dx
            ny = -dy
            nz = 1.0

            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            if length > 0:
                nx /= length
                ny /= length
                nz /= length

            normal[y, x] = [
                int((nx * 0.5 + 0.5) * 255),
                int((ny * 0.5 + 0.5) * 255),
                int((nz * 0.5 + 0.5) * 255),
            ]

    return Image.fromarray(normal, 'RGB')


def generate_borders(id_map_img, width, height):
    """Generate border overlay from ID map edge detection."""
    id_arr = np.array(id_map_img)
    borders = np.zeros((height, width, 4), dtype=np.uint8)

    for y in range(height):
        for x in range(width):
            center = id_arr[y, x]
            is_border = False

            for dy, dx_off in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny = y + dy
                nx = x + dx_off
                if 0 <= ny < height and 0 <= nx < width:
                    neighbor = id_arr[ny, nx]
                    if not np.array_equal(center, neighbor):
                        is_border = True
                        break

            if is_border:
                borders[y, x] = [30, 25, 15, 200]

    return Image.fromarray(borders, 'RGBA')


def compute_province_centers(id_map_img, provinces, width, height):
    """Compute centroid of each province as UV coords."""
    id_arr = np.array(id_map_img)
    sums = {}
    for p in provinces:
        key = tuple(p["color"])
        sums[key] = [0, 0, 0]

    for y in range(height):
        for x in range(width):
            key = tuple(id_arr[y, x])
            if key in sums:
                sums[key][0] += x
                sums[key][1] += y
                sums[key][2] += 1

    centers = {}
    for p in provinces:
        key = tuple(p["color"])
        s = sums[key]
        if s[2] > 0:
            centers[p["index"]] = [
                round(s[0] / s[2] / width, 4),
                round(s[1] / s[2] / height, 4),
            ]
        else:
            centers[p["index"]] = [0.5, 0.5]

    return centers


def compute_adjacency(id_map_img, provinces, width, height):
    """Detect province adjacency by scanning border pixels."""
    id_arr = np.array(id_map_img)

    color_to_idx = {}
    for p in provinces:
        key = tuple(p["color"])
        color_to_idx[key] = p["index"]

    adj_set = set()

    for y in range(height):
        for x in range(width):
            center = tuple(id_arr[y, x])
            ci = color_to_idx.get(center)
            if ci is None:
                continue
            for dy, dx_off in [(0, 1), (1, 0)]:
                ny = y + dy
                nx = x + dx_off
                if 0 <= ny < height and 0 <= nx < width:
                    neighbor = tuple(id_arr[ny, nx])
                    ni = color_to_idx.get(neighbor)
                    if ni is not None and ni != ci:
                        pair = (min(ci, ni), max(ci, ni))
                        adj_set.add(pair)

    adj = {}
    for p in provinces:
        adj[p["index"]] = []
    for a, b in adj_set:
        adj[a].append(b)
        adj[b].append(a)
    for k in adj:
        adj[k].sort()

    return adj


def main():
    print("Loading province data...")
    provinces = load_provinces()

    os.makedirs(OUT_DIR, exist_ok=True)

    # Source of truth: terrain_map.png
    terrain_path = OUT_DIR / "terrain_map.png"
    if not terrain_path.exists():
        print(f"ERROR: {terrain_path} not found. Place your terrain image there first.")
        return

    terrain_img = Image.open(terrain_path)
    WIDTH, HEIGHT = terrain_img.size
    print(f"Terrain source: {terrain_path} ({WIDTH}x{HEIGHT})")

    # 1. Generate Voronoi ID map at terrain dimensions
    print(f"Generating {len(provinces)} province Voronoi ID map ({WIDTH}x{HEIGHT})...")
    id_map_img, seeds = generate_voronoi_provinces(provinces, WIDTH, HEIGHT)
    id_map_img.save(OUT_DIR / "id-map.png")
    print("  Saved id-map.png")

    # 2. Compute topology
    print("Computing province centers...")
    centers = compute_province_centers(id_map_img, provinces, WIDTH, HEIGHT)

    print("Computing province adjacency...")
    adjacency = compute_adjacency(id_map_img, provinces, WIDTH, HEIGHT)

    topology = {
        "centers": {str(k): v for k, v in centers.items()},
        "adjacency": {str(k): v for k, v in adjacency.items()},
    }
    with open(DATA_DIR / "topology.json", "w") as f:
        json.dump(topology, f, indent=2)
    print(f"  Saved topology.json ({len(centers)} centers, {sum(len(v) for v in adjacency.values()) // 2} edges)")

    # 3. Derive heightmap from terrain luminance
    print("Deriving heightmap from terrain luminance...")
    heightmap_data = generate_heightmap_from_terrain(terrain_img)
    heightmap_uint8 = (heightmap_data * 255).astype(np.uint8)
    heightmap_img = Image.fromarray(heightmap_uint8, 'L')
    heightmap_img.save(OUT_DIR / "heightmap.png")
    print("  Saved heightmap.png")

    # 4. Derive normalmap from heightmap
    print("Generating normal map from heightmap...")
    normal_img = heightmap_to_normalmap(heightmap_data, WIDTH, HEIGHT, strength=3.0)
    normal_img.save(OUT_DIR / "normalmap.png")
    print("  Saved normalmap.png")

    # 5. Generate borders from ID map
    print("Generating border overlay from ID map...")
    borders_img = generate_borders(id_map_img, WIDTH, HEIGHT)
    borders_img.save(OUT_DIR / "borders.png")
    print("  Saved borders.png")

    print(f"\nAll support textures generated at {WIDTH}x{HEIGHT} (matching terrain_map.png)")
    print(f"Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
