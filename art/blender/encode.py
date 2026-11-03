"""Encode baked lightmaps (art/out/lightmaps/den_*.exr) into per-tier PNGs + lightmaps.json.

    Blender -b --factory-startup -P art/blender/encode.py

day/night → RGBM with a squared multiplier (value = rgb · a² · RANGE · scale), linear 8-bit RGBA
mask      → R lamp, G monitor, B string; each channel / its own scale, sRGB 8-bit
Resizing happens on the linear HDR data, before encoding."""

import json
import os
import sys
import time

import numpy as np
import OpenImageIO as oiio

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.abspath(os.path.join(HERE, "..", "out", "lightmaps"))
RGBM_RANGE = 16.0
# (day, mask) sizes per tier and set: night lighting is soft, so the mask can be half-res
TIERS = {"desktop": {"props": (2048, 1024), "room": (1024, 512)}, "mobile": {"props": (1024, 512), "room": (512, 256)}}
MASK_PCT = {"lamp": 99.5, "monitor": 99.5, "string": 99.0}
BURIED = 0.004  # raw day radiance below this = no light path reached the texel


def read(path):
    return oiio.ImageBuf(path).get_pixels(oiio.FLOAT)[..., :3].astype(np.float32)


def resize(arr, size):
    h, w, c = arr.shape
    if w == size:
        return arr
    b = oiio.ImageBuf(oiio.ImageSpec(w, h, c, oiio.FLOAT))
    b.set_pixels(oiio.ROI(0, w, 0, h, 0, 1, 0, c), arr)
    r = oiio.ImageBufAlgo.resize(b, filtername="lanczos3", roi=oiio.ROI(0, size, 0, size, 0, 1, 0, c))
    return np.maximum(r.get_pixels(oiio.FLOAT), 0)


def write_png(path, arr):
    h, w, c = arr.shape
    buf = oiio.ImageBuf(oiio.ImageSpec(w, h, c, oiio.UINT8))
    buf.set_pixels(oiio.ROI(0, w, 0, h, 0, 1, 0, c), (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8))
    buf.write(path)


def to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def rgbm(arr, scale):
    v = np.maximum(arr, 0) / scale
    m = np.clip(v.max(axis=-1, keepdims=True) / RGBM_RANGE, 0, 1.0)
    a = np.maximum(np.ceil(np.sqrt(m) * 255) / 255, 1 / 255)
    rgb = np.clip(v / (a * a * RGBM_RANGE), 0, 1)
    return np.concatenate([rgb, a], axis=-1)


def box3(a):
    """3×3 box sum (edges clamp)."""
    p = np.pad(a, [(1, 1), (1, 1)] + [(0, 0)] * (a.ndim - 2), mode="edge")
    out = np.zeros_like(a)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            out += p[dy : dy + a.shape[0], dx : dx + a.shape[1]]
    return out


def refill(img, valid, iterations=24):
    """Grow valid texels into invalid ones (buried texels, then the gutters) by averaging."""
    img = img.copy()
    valid = valid.copy()
    for _ in range(iterations):
        v = valid.astype(np.float32)
        s_acc = box3(img * v[..., None])
        s_v = box3(v)
        grow = (~valid) & (s_v > 0)
        if not grow.any():
            break
        img[grow] = s_acc[grow] / s_v[grow][..., None]
        valid |= grow
    return img


def soften(img):
    """One pass of a [1/4 1/2 1/4] kernel: turns stair-stepped crease texels into a soft line."""
    k = (0.25, 0.5, 0.25)
    out = img
    for axis in (0, 1):
        p = np.pad(out, [(1, 1) if a == axis else (0, 0) for a in range(img.ndim)], mode="edge")
        n = out.shape[axis]
        sl = lambda i: tuple(slice(i, i + n) if a == axis else slice(None) for a in range(img.ndim))  # noqa: E731
        out = k[0] * p[sl(0)] + k[1] * p[sl(1)] + k[2] * p[sl(2)]
    return out


def main():
    sets = sorted({f.split("_")[1] for f in os.listdir(DIR) if f.startswith("den_")})
    manifest = {"version": int(time.time()), "rgbmRange": RGBM_RANGE, "sets": {}, "files": {}}
    for s in sets:
        day_raw = read(os.path.join(DIR, f"raw_{s}_day.exr"))
        cover = day_raw.max(axis=-1) > 1e-6
        maps = {p: np.maximum(read(os.path.join(DIR, f"den_{s}_{p}.exr")), 0) for p in ("day", "lamp", "monitor", "string")}
        # Texels buried under touching geometry (the wall under a casing, the door under its panels)
        # get no light at all, even indirect: a lit room never bakes that dark. Refill them (and
        # the gutters) from valid neighbors, or bilinear filtering draws dotted black seams.
        valid = day_raw.max(axis=-1) >= BURIED
        print(f"  {s}: refilling {int((cover & ~valid).sum()):,} buried texels")
        maps = {p: soften(refill(m, valid)) for p, m in maps.items()}
        entry = {}
        for key in ("day",):
            peak = float(np.percentile(maps[key].max(axis=-1)[cover], 99.98))
            entry[key] = max(peak / RGBM_RANGE, 1e-5)
        entry["mask"] = [max(float(np.percentile(maps[p].mean(axis=-1)[cover], MASK_PCT[p])), 1e-5) for p in ("lamp", "monitor", "string")]
        entry["coverage"] = round(float(cover.mean()), 3)
        manifest["sets"][s] = entry
        for tier, sizes in TIERS.items():
            size, msize = sizes[s]
            files = {}
            name = f"lm_{s}_day_{size}.png"
            write_png(os.path.join(DIR, name), rgbm(resize(maps["day"], size), entry["day"]))
            files["day"] = name
            mask = np.stack([resize(maps[p], msize).mean(axis=-1) / sc for p, sc in zip(("lamp", "monitor", "string"), entry["mask"])], axis=-1)
            name = f"lm_{s}_mask_{msize}.png"
            write_png(os.path.join(DIR, name), to_srgb(mask))
            files["mask"] = name
            manifest["files"].setdefault(tier, {})[s] = files
    with open(os.path.join(DIR, "lightmaps.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("ENCODE ok", json.dumps(manifest["sets"]))


main()
