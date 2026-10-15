"""Turns each minimap image into a walkable-floor grid for src/map-grids.ts.

Usage: python3 scripts/gen-map-grids.py   (needs Pillow and numpy)

The images show floor as grey or yellow on white; walls and void are white. The map is cut into
100 x 100 cells, and a cell is floor when at least 30% of its pixels are not white. A closing of one
cell then seals the thin white outlines drawn inside the floor, so doorways stay open. Rows are
strings of '#' (floor) and '.' (wall). The layout points are forced onto floor when the grid is
read (src/map-nav.ts), so a point never sits in a wall.
"""
from pathlib import Path

import numpy as np  # noqa: E402
from PIL import Image

N = 100
MAPS = ['Abyss', 'Bind', 'Breeze', 'Haven', 'Icebox', 'Lotus', 'Sunset']
root = Path(__file__).resolve().parent.parent


def dilate(cells):
    out = cells.copy()
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            out |= np.roll(np.roll(cells, dx, 0), dy, 1)
    return out


def close(cells):
    return ~dilate(~dilate(cells))


def grid(name: str):
    pixels = np.array(Image.open(root / 'src/assets/maps' / f'{name.lower()}.png').convert('RGB')).astype(int)
    floor = pixels.min(axis=2) < 235
    height, width = floor.shape
    cells = np.zeros((N, N), dtype=bool)
    for j in range(N):
        for i in range(N):
            cell = floor[int(j * height / N):int((j + 1) * height / N), int(i * width / N):int((i + 1) * width / N)]
            cells[j, i] = cell.mean() >= 0.3
    cells = close(cells)
    return [''.join('#' if on else '.' for on in row) for row in cells]


lines = [
    '// Walkable floor of each minimap, as a 100 x 100 grid: `#` is floor, `.` is wall or void.',
    '// Generated from src/assets/maps by scripts/gen-map-grids.py. Do not edit by hand.',
    '',
    'export const mapGrids: Record<string, string[]> = {',
]
for name in MAPS:
    lines.append(f"  {name}: [")
    lines.extend(f"    '{row}'," for row in grid(name))
    lines.append('  ],')
lines.append('}')
(root / 'src/map-grids.ts').write_text('\n'.join(lines) + '\n')
