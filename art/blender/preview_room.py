"""Render the assembled room from the site's cameras: Blender -b -P preview_room.py -- [day|night] [cams] [samples] [width]

Writes art/previews/room_<cam>_<time>.png. The overview camera mimics the site's framing
(CameraRig: preset direction, distance fitted to the room)."""

import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from layout import CAMS, LAMP  # noqa: E402
from lib import lights, render  # noqa: E402
from lib.mats import hex_rgba  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
time = argv[0] if argv else "day"
cams = argv[1].split(",") if len(argv) > 1 else ["room"]
samples = int(argv[2]) if len(argv) > 2 else 128
width = int(argv[3]) if len(argv) > 3 else 1440
height = int(width * 900 / 1440)

bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, "..", "out", "room.blend"))
scene = render.setup_render(width, height, samples=samples)


def emissive(name, hex_color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hex_rgba(hex_color)
    b.inputs["Emission Color"].default_value = hex_rgba(hex_color)
    b.inputs["Emission Strength"].default_value = strength
    return m


# stand-ins for the live textures (the site draws these at runtime)
stand_ins = {
    "display__window": ("#A9CBE6", 1.6) if time == "day" else ("#1E2A4A", 0.6),
    "screen__computer": ("#3B5BA8", 1.2),
    "screen__phone": ("#E7C9A0", 1.0),
    "display__now": ("#FF9A3C", 1.5),
}
for name, (c, s) in stand_ins.items():
    ob = bpy.data.objects.get(name)
    if ob:
        ob.data.materials.clear()
        ob.data.materials.append(emissive(f"preview_{name}", c, s))

if time == "day":
    lights.day()
    scene.view_settings.exposure = 0.0
else:
    bulbs = [o.matrix_world.translation.copy() for o in bpy.data.objects if o.type == "MESH" and o.get("glow") == "string"]
    # one light per bulb mesh island: approximate with the merged mesh's vertices clustered
    pts = []
    for o in bpy.data.objects:
        if o.type == "MESH" and o.get("glow") == "string":
            vs = [o.matrix_world @ v.co for v in o.data.vertices]
            # cluster by 3 cm cells
            cells = {}
            for v in vs:
                key = (round(v.x / 0.03), round(v.y / 0.03), round(v.z / 0.03))
                cells.setdefault(key, []).append(v)
            for group in cells.values():
                pts.append(sum(group, Vector()) / len(group))
    # de-duplicate clusters closer than 6 cm
    uniq = []
    for p in pts:
        if all((p - q).length > 0.06 for q in uniq):
            uniq.append(p)
    lights.night(uniq)
    scene.view_settings.exposure = 1.2

for cid in cams:
    pos, target = CAMS[cid]
    pos, target = Vector(pos), Vector(target)
    if cid == "room":
        # CameraRig: distance = fit(roomSphere.radius * 0.74) for the usable vertical FOV
        vfov = math.radians(32)
        usable = 2 * math.atan(math.tan(vfov / 2) * (900 - 56) / 900)
        dist = 3.63 * 0.74 / math.sin(usable / 2)
        pos = target + (pos - target).normalized() * dist
    cam = render.camera(f"cam_{cid}", pos, target, fov=32)
    out = os.path.join(render.PREVIEWS, f"room_{cid}_{time}.png")
    render.render_to(out, cam)
    print("PREVIEW", out)
