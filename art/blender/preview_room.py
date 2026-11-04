"""Render the assembled room from the site's cameras: Blender -b -P preview_room.py -- [day|night] [cams] [samples] [width]

Writes art/previews/room_<cam>_<time>.png. Cameras frame like the site does (CameraRig: preset
direction, distance fitted to the free viewport, the panel's focal offset as a lens shift).
sec_<id> (sec_school, sec_olympiad, sec_mun, sec_books) frames a shelf section's opening from its
anchor__section_<id> (extras w, h)."""

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

VFOV = math.radians(32)
TOP_INSET, PANEL = 56, min(440, round(width * 0.36)) + 24  # src/lib/layout.ts (desktop: the panel on the right)


def usable(panel=True):
    """The site's free viewport (CameraRig.computePose): vertical and horizontal FOV left by the UI."""
    hfov = 2 * math.atan(math.tan(VFOV / 2) * width / height)
    v = 2 * math.atan(math.tan(VFOV / 2) * (height - TOP_INSET) / height)
    h = 2 * math.atan(math.tan(hfov / 2) * (width - (PANEL if panel else 0)) / width)
    return v, h


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def subtree(name):
    root = bpy.data.objects.get(name)
    out, stack = [], list(root.children) if root else []
    while stack:
        o = stack.pop()
        stack += list(o.children)
        if o.type == "MESH" and not o.name.startswith("hit__"):
            out.append(o)
    return out


def site_camera(cid):
    """Where the site puts the camera (direction from the preset, distance fitted to the free
    viewport, focal offset → lens shift). sec_<id> frames a shelf section's opening from its anchor."""
    if cid.startswith("sec_"):
        anchor = bpy.data.objects[f"anchor__section_{cid[4:]}"]
        target = anchor.matrix_world.translation.copy()
        w, h = float(anchor["w"]), float(anchor["h"])
        az, el = math.radians(16), math.radians(7)
        direction = Vector((math.cos(az) * math.cos(el), -math.sin(az) * math.cos(el), math.sin(el)))
        v, hz = usable()
        dist = max((h / 2 * 1.14) / math.tan(v / 2), (w / 2 * 1.1) / math.tan(hz / 2)) + 0.17
        return target + direction * dist, target, True
    pos, target = (Vector(p) for p in CAMS[cid])
    direction = (pos - target).normalized()
    if cid == "room":
        # CameraRig: distance = fit(roomSphere.radius * 0.74) for the usable vertical FOV
        v, _ = usable(panel=False)
        return target + direction * (3.63 * 0.74 / math.sin(v / 2)), target, False
    meshes = subtree(f"obj__{cid}")
    if not meshes:
        return pos, target, False
    lo, hi = bounds(meshes)
    radius = (hi - lo).length / 2
    v, hz = usable()
    dist = radius * 1.12 / math.sin(min(v, hz) / 2)
    return target + direction * dist, target, True


for cid in cams:
    pos, target, panel = site_camera(cid)
    cam = render.camera(f"cam_{cid}", pos, target, fov=32)
    if panel:  # the site re-centers the object in the space left of the panel
        cam.data.shift_x = (PANEL / 2) / width
        cam.data.shift_y = (TOP_INSET / 2) / width
    out = os.path.join(render.PREVIEWS, f"room_{cid}_{time}.png")
    render.render_to(out, cam)
    print("PREVIEW", out)
