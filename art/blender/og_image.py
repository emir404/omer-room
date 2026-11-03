"""Render the social preview (Open Graph) image of the room → src/app/opengraph-image.png

    Blender -b --factory-startup -P art/blender/og_image.py -- [samples]

Next.js picks the file up by convention (og:image + twitter:image)."""

import math
import os
import shutil
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from layout import CAMS  # noqa: E402
from lib import lights, render  # noqa: E402
from lib.mats import hex_rgba  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
samples = int(argv[0]) if argv else 256
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, "..", "out", "room.blend"))
scene = render.setup_render(1200, 630, samples=samples)
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"


def emissive(hex_color, strength):
    m = bpy.data.materials.new("og_" + hex_color)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hex_rgba(hex_color)
    b.inputs["Emission Color"].default_value = hex_rgba(hex_color)
    b.inputs["Emission Strength"].default_value = strength
    return m


# the live pictures, approximated: sky-blue window, a lit monitor, the LED ticker
for name, (c, s) in {"display__window": ("#9CC7E8", 1.8), "screen__computer": ("#3B5BA8", 1.3), "screen__phone": ("#E7C9A0", 1.0), "display__now": ("#FF9A3C", 1.6)}.items():
    ob = bpy.data.objects.get(name)
    if ob:
        ob.data.materials.clear()
        ob.data.materials.append(emissive(c, s))

lights.day()
pos, target = (Vector(p) for p in CAMS["room"])
target = target + Vector((0.2, -0.1, -0.35))
dist = 12.2
cam = render.camera("og_cam", target + (pos - target).normalized() * dist, target, fov=30)
out = os.path.join(HERE, "..", "previews", "opengraph-image.png")
render.render_to(out, cam)

# composite over the site's paper color (same as the page background)
import numpy as np  # noqa: E402
import OpenImageIO as oiio  # noqa: E402

px = oiio.ImageBuf(out).get_pixels(oiio.FLOAT)
paper = np.array([0xEE, 0xE7, 0xDB], np.float32) / 255
rgb = px[..., :3] * px[..., 3:4] + paper * (1 - px[..., 3:4])
h, w = rgb.shape[:2]
buf = oiio.ImageBuf(oiio.ImageSpec(w, h, 3, oiio.UINT8))
buf.set_pixels(oiio.ROI(0, w, 0, h, 0, 1, 0, 3), (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8))
dest = os.path.join(ROOT, "src", "app", "opengraph-image.png")
buf.write(dest)
shutil.copyfile(dest, os.path.join(ROOT, "src", "app", "twitter-image.png"))
print("OG ok →", dest)
