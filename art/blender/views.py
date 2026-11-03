"""Pictures the room loads at runtime that come from photos/rasters rather than the bake:

  art/out/views/window_view.png  the view through the window: a rectilinear crop of a CC0 panorama
                                 (Poly Haven "Dry Orchard Meadow", Alexander Scholten), 2560×1440
  art/out/views/globe_map.png    the globe's map: Natural Earth "Cross Blended Hypso with Shaded
                                 Relief and Water" (public domain), equirectangular 4096×2048

    Blender -b --factory-startup -P art/blender/views.py -- [window|globe|candidates]

Sources live in art/src (git-ignored; fetched once, see art/README.md). `pnpm assets` turns the PNGs
into per-tier WebPs and lists them in src/lib/assets.manifest.json."""

import math
import os
import sys

import numpy as np
import OpenImageIO as oiio

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.abspath(os.path.join(HERE, ".."))
SRC = os.path.join(ART, "src")
OUT = os.path.join(ART, "out", "views")
PREVIEWS = os.path.join(ART, "previews")

# The window view: where the camera looks inside the panorama (degrees), and its field of view.
# The site maps the picture onto a plane far behind the window (src/components/room/WindowView.tsx),
# so the horizon sits at `WINDOW_HORIZON` of the picture's height.
WINDOW = {"src": "dry_orchard_meadow.jpg", "yaw": 120.0, "pitch": 4.0, "hfov": 104.0, "size": (2560, 1440)}


def read(path):
    buf = oiio.ImageBuf(path)
    if buf.has_error:
        raise SystemExit(f"can't read {path}: {buf.geterror()}")
    return buf.get_pixels(oiio.FLOAT)[..., :3]


def write(path, arr):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    arr = np.clip(arr, 0, 1)
    h, w = arr.shape[:2]
    buf = oiio.ImageBuf(oiio.ImageSpec(w, h, 3, oiio.UINT8))
    buf.set_pixels(oiio.ROI(0, w, 0, h, 0, 1, 0, 3), (arr * 255 + 0.5).astype(np.uint8))
    if not buf.write(path):
        raise SystemExit(f"can't write {path}: {buf.geterror()}")
    print("wrote", os.path.relpath(path, ART), f"{w}×{h}")


def bilinear(img, x, y):
    """Samples img (H×W×3) at float pixel coords, wrapping horizontally (a 360° panorama)."""
    h, w = img.shape[:2]
    x0 = np.floor(x).astype(np.int64)
    y0 = np.clip(np.floor(y).astype(np.int64), 0, h - 1)
    fx = (x - x0)[..., None]
    fy = (y - np.floor(y))[..., None]
    x1 = (x0 + 1) % w
    x0 %= w
    y1 = np.clip(y0 + 1, 0, h - 1)
    top = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    bottom = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return top * (1 - fy) + bottom * fy


def rectilinear(pano, yaw, pitch, hfov, size):
    """A pinhole view into an equirectangular panorama (yaw 0 = the panorama's center column)."""
    w, h = size
    ph, pw = pano.shape[:2]
    f = (w / 2) / math.tan(math.radians(hfov) / 2)
    xs = np.arange(w) + 0.5 - w / 2
    ys = -(np.arange(h) + 0.5 - h / 2)
    x, y = np.meshgrid(xs, ys)
    z = np.full_like(x, f)
    # pitch (around x), then yaw (around y)
    p = math.radians(pitch)
    y2 = y * math.cos(p) + z * math.sin(p)
    z2 = -y * math.sin(p) + z * math.cos(p)
    lon = np.arctan2(x, z2) + math.radians(yaw)
    lat = np.arctan2(y2, np.hypot(x, z2))
    u = (lon / (2 * math.pi) + 0.5) * pw
    v = (0.5 - lat / math.pi) * ph
    return bilinear(pano, u, v)


def window(candidates=False):
    pano = read(os.path.join(SRC, WINDOW["src"]))
    if candidates:
        small = pano[::4, ::4]
        for yaw in range(-180, 180, 30):
            write(os.path.join(PREVIEWS, f"window_yaw_{yaw:+04d}.jpg"), rectilinear(small, yaw, WINDOW["pitch"], WINDOW["hfov"], (640, 360)))
        return
    view = rectilinear(pano, WINDOW["yaw"], WINDOW["pitch"], WINDOW["hfov"], WINDOW["size"])
    write(os.path.join(OUT, "window_view.png"), view)


def box_down(img, factor):
    h, w = img.shape[:2]
    h2, w2 = h // factor, w // factor
    return img[: h2 * factor, : w2 * factor].reshape(h2, factor, w2, factor, 3).mean(axis=(1, 3))


def resize(img, w, h):
    """Area-average down to (w, h) via an integer box step, then bilinear for the remainder."""
    sh, sw = img.shape[:2]
    factor = max(1, min(sw // w, sh // h))
    if factor > 1:
        img = box_down(img, factor)
        sh, sw = img.shape[:2]
    xs = (np.arange(w) + 0.5) * sw / w - 0.5
    ys = (np.arange(h) + 0.5) * sh / h - 0.5
    x, y = np.meshgrid(xs, ys)
    return bilinear(img, np.clip(x, 0, sw - 1), np.clip(y, 0, sh - 1))


def globe():
    src = os.path.join(SRC, "hyp", "HYP_50M_SR_W.tif")
    raw = read(src)  # 10800 × 5400, sRGB-encoded
    w, h = 4096, 2048
    img = resize(raw, w, h)
    # a desk globe, not a satellite: lift the oceans a touch toward a printed teal, warm the land
    lum = img @ np.array([0.2126, 0.7152, 0.0722])
    water = (img[..., 2] > img[..., 0] + 0.06) & (img[..., 2] > img[..., 1] - 0.02)
    teal = np.array([0.43, 0.64, 0.72])
    img = np.where(water[..., None], img * 0.55 + teal * 0.45 * (0.75 + 0.5 * lum[..., None]), img)
    img = img * np.array([1.03, 1.0, 0.95])
    img = np.clip((img - 0.5) * 1.06 + 0.5, 0, 1)
    # graticule: 15° meridians and parallels, the equator and tropics a little stronger
    ink = np.array([0.20, 0.30, 0.36])
    yy, xx = np.mgrid[0:h, 0:w]
    lon = (xx + 0.5) / w * 360 - 180
    lat = 90 - (yy + 0.5) / h * 180
    px = 360 / w  # degrees per pixel

    def lines(coord, step, width_px):
        d = np.abs(((coord + step / 2) % step) - step / 2) / px
        return np.clip(1 - (d - width_px / 2), 0, 1)

    grid = np.maximum(lines(lon, 15, 1.4), lines(lat, 15, 1.4)) * 0.22
    special = np.zeros_like(grid)
    for la in (0.0, 23.44, -23.44):
        d = np.abs(lat - la) / px
        special = np.maximum(special, np.clip(1 - (d - 1.1), 0, 1) * (0.42 if la == 0 else 0.3))
    a = np.maximum(grid, special)[..., None]
    img = img * (1 - a) + ink * a
    write(os.path.join(OUT, "globe_map.png"), img)


argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
what = argv[0] if argv else "all"
if what == "candidates":
    window(candidates=True)
if what in ("window", "all"):
    window()
if what in ("globe", "all"):
    globe()
