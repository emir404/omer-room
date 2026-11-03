"""Procedural albedo textures → art/out/tex/*.png (numpy + OpenImageIO, both bundled with Blender).

    Blender -b --factory-startup -P art/blender/textures.py

Everything is generated from code (no downloaded art). The globe uses Natural Earth's public-domain
110m land polygons (cached in art/out/ne_110m_land.geojson).
"""

import json
import math
import os
import sys
import urllib.request

import numpy as np
import OpenImageIO as oiio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.mats import TEX_DIR  # noqa: E402

OUT_DIR = os.path.dirname(TEX_DIR)
rng = np.random.default_rng(7)


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


def save(name, img):
    os.makedirs(TEX_DIR, exist_ok=True)
    img = np.clip(img, 0, 1)
    arr = (img * 255 + 0.5).astype(np.uint8)
    h, w, c = arr.shape
    buf = oiio.ImageBuf(oiio.ImageSpec(w, h, c, oiio.UINT8))
    buf.set_pixels(oiio.ROI(0, w, 0, h, 0, 1, 0, c), arr)
    path = os.path.join(TEX_DIR, name)
    buf.write(path)
    print(f"  {name} {w}×{h}")


def upsample(grid, W, H, wrap=False):
    gh, gw = grid.shape
    ys = np.linspace(0, gh - (0 if wrap else 1), H, endpoint=not wrap)
    xs = np.linspace(0, gw - (0 if wrap else 1), W, endpoint=not wrap)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = (ys - y0)[:, None]
    fx = (xs - x0)[None, :]
    if wrap:
        y1, x1 = (y0 + 1) % gh, (x0 + 1) % gw
        y0, x0 = y0 % gh, x0 % gw
    else:
        y1, x1 = np.minimum(y0 + 1, gh - 1), np.minimum(x0 + 1, gw - 1)
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    a, b = grid[y0][:, x0], grid[y0][:, x1]
    c, d = grid[y1][:, x0], grid[y1][:, x1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def fbm(W, H, base=8, octaves=4, wrap=False, aspect=1.0):
    out = np.zeros((H, W), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gw = max(2, int(base * 2**o))
        gh = max(2, int(base * 2**o * H / W * aspect))
        out += amp * upsample(rng.random((gh, gw)).astype(np.float32), W, H, wrap)
        total += amp
        amp *= 0.5
    return out / total


# ------------------------------------------------------------------ floor: oak planks


def floor_planks(W=2048, H=2048, room=4.5):
    """Planks run along v (toward the back wall). 1 px ≈ 2.2 mm."""
    px = W / room
    plank_w = int(0.142 * px)
    img = np.zeros((H, W, 3), np.float32)
    base = hexc("#C79A67")
    tones = [hexc(h) for h in ("#C99B69", "#BF8F5E", "#D2A574", "#B8875A", "#CDA06C", "#C4945F")]
    grain_fine = fbm(W, H, base=6, octaves=3, aspect=0.04)  # long streaks along v
    grain = fbm(W, H, base=40, octaves=4, aspect=0.02)
    mottling = fbm(W, H, base=6, octaves=3)
    cols = int(math.ceil(W / plank_w))
    gap = np.zeros((H, W), np.float32)
    for c in range(cols):
        x0, x1 = c * plank_w, min(W, (c + 1) * plank_w)
        y = -int(rng.random() * 1.6 * px)
        while y < H:
            length = int((0.9 + rng.random() * 1.1) * px)
            y0, y1 = max(0, y), min(H, y + length)
            if y1 > y0:
                tone = tones[rng.integers(len(tones))] * (0.94 + rng.random() * 0.1)
                img[y0:y1, x0:x1] = tone
                # plank end joint
                if y0 > 0:
                    gap[y0 : y0 + 2, x0:x1] = 1.0
            y += length
        gap[:, x0 : x0 + 2] = np.maximum(gap[:, x0 : x0 + 2], 1.0)
    streak = (grain_fine - 0.5) * 0.16 + (grain - 0.5) * 0.12
    img *= (1 + streak)[..., None]
    img *= (0.95 + 0.1 * mottling)[..., None]
    # soft darkening next to joints (micro bevel)
    soft = np.maximum(gap, np.roll(gap, 1, 1) * 0.45)
    soft = np.maximum(soft, np.roll(gap, -1, 1) * 0.3)
    img *= (1 - 0.55 * soft)[..., None]
    img = img * 0.98 + base * 0.02
    save("floor_planks.png", img)


# ------------------------------------------------------------------ rug: kilim


def rug_kilim(cw=104, ch=68, cell=10):
    """A flat-woven kilim on a coarse grid (one cell = one woven 'pixel'), then upscaled."""
    P = {
        "red": hexc("#A9452F"),
        "red2": hexc("#B9553A"),
        "navy": hexc("#2E3F5E"),
        "saffron": hexc("#D9A441"),
        "cream": hexc("#EDE1C8"),
        "brown": hexc("#5B3B2A"),
        "sage": hexc("#7F9573"),
        "rose": hexc("#C97A68"),
    }
    g = np.empty((ch, cw), dtype=object)
    g[:] = "red"
    # border bands
    def band(d, color):
        g[d, d : cw - d] = color
        g[ch - 1 - d, d : cw - d] = color
        g[d : ch - d, d] = color
        g[d : ch - d, cw - 1 - d] = color

    band(0, "brown")
    band(1, "cream")
    for d in range(2, 7):
        band(d, "navy")
    band(7, "cream")
    band(8, "saffron")
    # running zig-zag inside the navy border
    for x in range(2, cw - 2):
        y = 3 + (x % 4 if (x // 4) % 2 == 0 else 3 - x % 4) // 1
        if 2 <= y <= 6:
            g[min(y, 5), x] = "cream" if (x // 8) % 2 == 0 else "saffron"
            g[ch - 1 - min(y, 5), x] = "cream" if (x // 8) % 2 == 0 else "saffron"
    for y in range(2, ch - 2):
        x = 3 + (y % 4 if (y // 4) % 2 == 0 else 3 - y % 4)
        g[y, min(x, 5)] = "cream"
        g[y, cw - 1 - min(x, 5)] = "cream"
    # field: three stepped medallions with hooks
    cy = ch // 2
    for k, cx in enumerate((cw * 0.22, cw * 0.5, cw * 0.78)):
        R = 14
        for y in range(ch):
            for x in range(cw):
                d = abs(x - cx) * 0.62 + abs(y - cy)
                if 9 <= x < cw - 9 and 9 <= y < ch - 9:
                    if d < R * 0.35:
                        g[y, x] = "saffron" if k != 1 else "cream"
                    elif d < R * 0.55:
                        g[y, x] = "navy"
                    elif d < R * 0.72:
                        g[y, x] = "cream" if k != 1 else "saffron"
                    elif d < R * 0.9:
                        g[y, x] = "brown" if ((x + y) % 2 == 0 and d > R * 0.82) else "rose"
                    elif d < R * 1.02 and (int(x - cx) % 3 == 0):
                        g[y, x] = "navy"  # hooks
        # center cross
        for t in range(-2, 3):
            g[cy + t, int(cx)] = "red"
            g[cy, int(cx) + t] = "red"
    # small elibelinde-ish motifs between medallions
    for cx in (cw * 0.36, cw * 0.64):
        for dy in (-1, 1):
            y0 = int(cy + dy * 18)
            for t in range(-3, 4):
                if 9 <= y0 + t < ch - 9:
                    g[y0 + t, int(cx)] = "cream"
                g[y0, int(cx) + t] = "cream"
            g[y0 - 3, int(cx) - 1 : int(cx) + 2] = "saffron"
            g[y0 + 3, int(cx) - 1 : int(cx) + 2] = "saffron"
    # corner sage accents
    for (yy, xx) in ((12, 12), (12, cw - 13), (ch - 13, 12), (ch - 13, cw - 13)):
        for t in range(-2, 3):
            g[yy + t, xx] = "sage"
            g[yy, xx + t] = "sage"

    H, W = ch * cell, cw * cell
    img = np.zeros((H, W, 3), np.float32)
    for y in range(ch):
        row_var = 1 + (rng.random() - 0.5) * 0.06  # abrash: wool batches differ row to row
        for x in range(cw):
            img[y * cell : (y + 1) * cell, x * cell : (x + 1) * cell] = P[g[y, x]] * row_var
    # weave texture: weft ridges + wool noise
    yy = np.arange(H)[:, None]
    ridges = 0.94 + 0.06 * np.sin(yy / cell * math.pi * 4) ** 2
    wool = 0.92 + 0.16 * fbm(W, H, base=60, octaves=3)
    img *= (ridges * wool)[..., None]
    save("rug_kilim.png", img)


# ------------------------------------------------------------------ globe: vintage map


def load_land():
    cache = os.path.join(OUT_DIR, "ne_110m_land.geojson")
    if not os.path.exists(cache):
        url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson"
        os.makedirs(OUT_DIR, exist_ok=True)
        urllib.request.urlretrieve(url, cache)
    with open(cache) as f:
        data = json.load(f)
    rings = []
    for feat in data["features"]:
        geom = feat["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for poly in polys:
            for ring in poly:
                rings.append(np.array(ring, np.float64))
    return rings


def rasterize(rings, W, H):
    """Even-odd scanline fill of lon/lat rings onto an equirectangular grid (row 0 = north)."""
    mask = np.zeros((H, W), bool)
    for row in range(H):
        lat = 90 - (row + 0.5) / H * 180
        xs = []
        for ring in rings:
            a, b = ring[:-1], ring[1:]
            cond = (a[:, 1] <= lat) != (b[:, 1] <= lat)
            if not cond.any():
                continue
            aa, bb = a[cond], b[cond]
            t = (lat - aa[:, 1]) / (bb[:, 1] - aa[:, 1])
            xs.extend((aa[:, 0] + t * (bb[:, 0] - aa[:, 0])).tolist())
        if not xs:
            continue
        xs = np.sort(np.array(xs))
        cols = (xs + 180) / 360 * W
        for i in range(0, len(cols) - 1, 2):
            c0, c1 = int(round(cols[i])), int(round(cols[i + 1]))
            mask[row, max(c0, 0) : min(c1, W)] ^= True
    return mask


def globe_map(W=2048, H=1024):
    land = rasterize(load_land(), W, H)
    lat = (90 - (np.arange(H) + 0.5) / H * 180)[:, None] * np.ones((1, W))
    ocean = np.empty((H, W, 3), np.float32)
    deep, shallow = hexc("#2F6F86"), hexc("#4A8EA0")
    t = (np.cos(np.radians(lat)) ** 2)[..., None]
    ocean[:] = deep * (1 - 0.4 * t) + shallow * 0.4 * t
    # coastal shallows: blur the land mask a few px
    soft = land.astype(np.float32)
    for _ in range(6):
        soft = (soft + np.roll(soft, 1, 0) + np.roll(soft, -1, 0) + np.roll(soft, 1, 1) + np.roll(soft, -1, 1)) / 5
    ocean = ocean * (1 - 0.35 * soft[..., None]) + hexc("#7DB3B8") * 0.35 * soft[..., None]
    paper = hexc("#ECDDB5")
    green = hexc("#B8BE8A")
    noise = fbm(W, H, base=10, octaves=4, wrap=True)
    landc = paper * (1 - 0.35 * noise[..., None]) + green * 0.35 * noise[..., None]
    polar = np.clip((np.abs(lat) - 62) / 12, 0, 1)[..., None]
    landc = landc * (1 - polar) + hexc("#F3EEE2") * polar
    img = np.where(land[..., None], landc, ocean)
    # coastline
    edge = land ^ np.roll(land, 1, 0) | land ^ np.roll(land, 1, 1)
    img[edge] = img[edge] * 0.55 + hexc("#5E4A33") * 0.45
    # graticule every 30°, equator + tropics
    for lng in range(-180, 180, 30):
        c = int((lng + 180) / 360 * W)
        img[:, c : c + 2] = img[:, c : c + 2] * 0.7 + hexc("#F6EBD0") * 0.3
    for la in (-60, -30, 30, 60):
        r = int((90 - la) / 180 * H)
        img[r : r + 2] = img[r : r + 2] * 0.7 + hexc("#F6EBD0") * 0.3
    for la, strength in ((0, 0.55), (23.44, 0.3), (-23.44, 0.3)):
        r = int((90 - la) / 180 * H)
        img[r : r + 3] = img[r : r + 3] * (1 - strength) + hexc("#C9533A") * strength
    img *= (0.96 + 0.06 * fbm(W, H, base=24, octaves=3, wrap=True))[..., None]
    save("globe_map.png", img)


# ------------------------------------------------------------------ basketball


def basketball(W=1024, H=512):
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    uu, vv = np.meshgrid(u, v)
    # three.js SphereGeometry convention (matches lib.geo.three_sphere)
    x = -np.cos(uu * 2 * np.pi) * np.sin(vv * np.pi)
    y = np.cos(vv * np.pi)
    z = np.sin(uu * 2 * np.pi) * np.sin(vv * np.pi)
    w = 0.011
    seam = (np.abs(y) < w) | (np.abs(x) < w)
    # the two curved side seams
    curve = np.abs(np.abs(z) - 0.62 * (1 - y**2) ** 0.9 - 0.12)
    seam |= (curve < w * 1.15) & (np.abs(z) > 0.2)
    base = hexc("#D46A2C")
    pebble = fbm(W, H, base=180, octaves=2, wrap=True)
    img = np.empty((H, W, 3), np.float32)
    img[:] = base
    img *= (0.9 + 0.16 * pebble)[..., None]
    img *= (0.95 + 0.08 * fbm(W, H, base=6, octaves=3, wrap=True))[..., None]
    img[seam] = hexc("#2A1D18")
    save("basketball.png", img)


# ------------------------------------------------------------------ posters + cork


def poster_money(W=640, H=880):
    img = np.empty((H, W, 3), np.float32)
    img[:] = hexc("#24375A")
    yy, xx = np.mgrid[0:H, 0:W]
    m = 46
    inner = (xx > m) & (xx < W - m) & (yy > m) & (yy < H - m)
    img[~inner] = hexc("#F1E7D2")
    # grid
    for gx in range(m, W - m, 56):
        img[m : H - m, gx : gx + 1] = img[m : H - m, gx : gx + 1] * 0.6 + hexc("#3F5680") * 0.4
    for gy in range(m, H - m, 56):
        img[gy : gy + 1, m : W - m] = img[gy : gy + 1, m : W - m] * 0.6 + hexc("#3F5680") * 0.4
    # candlesticks
    r = np.random.default_rng(3)
    price = 0.25
    n = 13
    for i in range(n):
        x = int(m + 40 + i * (W - 2 * m - 80) / (n - 1))
        open_ = price
        price = min(0.92, max(0.08, price + (r.random() - 0.32) * 0.12))
        hi, lo = max(open_, price) + r.random() * 0.04, min(open_, price) - r.random() * 0.04
        up = price >= open_
        col = hexc("#D9A441") if up else hexc("#C9533A")
        def ypx(p):
            return int(H - m - 60 - p * (H - 2 * m - 260))
        img[ypx(hi) : ypx(lo), x - 2 : x + 2] = col
        y0, y1 = sorted((ypx(open_), ypx(price)))
        img[y0 : max(y1, y0 + 6), x - 12 : x + 12] = col
    # trend line
    for x in range(m + 30, W - m - 30):
        t = (x - m - 30) / (W - 2 * m - 60)
        y = int(H - m - 120 - t**1.3 * (H - 2 * m - 330))
        img[y - 2 : y + 3, x] = hexc("#F1E7D2")
    # title block (abstract "type" bars)
    img[m + 40 : m + 78, m + 36 : W - m - 120] = hexc("#F1E7D2")
    img[m + 96 : m + 114, m + 36 : W - m - 260] = hexc("#D9A441")
    save("poster_money.png", img)


def poster_kozan(W=640, H=880):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.empty((H, W, 3), np.float32)
    sky_t = (yy / H)[..., None]
    img[:] = hexc("#F3C77A") * (1 - sky_t) + hexc("#F08A4B") * sky_t
    # sun
    sun = (xx - W * 0.5) ** 2 + (yy - H * 0.42) ** 2 < (W * 0.26) ** 2
    img[sun] = hexc("#FBE3A6")
    # castle hill (Kozan castle silhouette, simplified)
    hill = yy > H * 0.6 - 90 * np.exp(-(((xx - W * 0.38) / (W * 0.22)) ** 2)) - 40 * np.sin(xx / W * 5)
    img[hill] = hexc("#8A4B3A")
    for cx in (0.3, 0.38, 0.46):
        tower = (np.abs(xx - W * cx) < 14) & (yy > H * 0.49 - (12 if cx == 0.38 else 0)) & (yy < H * 0.6)
        img[tower] = hexc("#6E3A2E")
    # orchard rows
    for i in range(6):
        y = H * 0.68 + i * 30
        for k in range(14):
            x = (k + (i % 2) * 0.5) * W / 13
            tree = (xx - x) ** 2 + (yy - y) ** 2 < (13 + i * 1.6) ** 2
            img[tree] = hexc("#3F6B3A")
            fruit = (xx - x - 4) ** 2 + (yy - y + 3) ** 2 < 9
            img[fruit] = hexc("#F08A2B")
    img[yy > H * 0.9] = hexc("#5A3A2A")
    # frame + title bar
    m = 30
    border = (xx < m) | (xx > W - m) | (yy < m) | (yy > H - m)
    img[border] = hexc("#F4ECDC")
    img[int(H * 0.08) : int(H * 0.08) + 44, int(W * 0.2) : int(W * 0.8)] = hexc("#5A3A2A")
    save("poster_kozan.png", img)


def cork(W=512, H=512):
    n1 = fbm(W, H, base=64, octaves=3, wrap=True)
    n2 = rng.random((H, W)).astype(np.float32)
    img = np.empty((H, W, 3), np.float32)
    img[:] = hexc("#C49A6C")
    img *= (0.78 + 0.35 * n1)[..., None]
    img[n2 > 0.93] *= 0.62
    img[n2 < 0.05] *= 1.18
    save("cork.png", img)


if __name__ == "__main__":
    print("textures →", TEX_DIR)
    floor_planks()
    rug_kilim()
    globe_map()
    basketball()
    poster_money()
    poster_kozan()
    cork()
