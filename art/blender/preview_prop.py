"""Render one prop module under studio light: Blender -b --factory-startup -P preview_prop.py -- <module> [samples]

Writes art/previews/props/<module>_<view>.png. Review every one before it goes into the room."""

import importlib
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib import core, render  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
module = argv[0]
samples = int(argv[1]) if len(argv) > 1 else 96
views = [("a", -32, 24, 1.15), ("b", 28, 14, 1.0), ("c", 145, 30, 1.1)]
floor = None
for a in argv[2:]:
    if a.startswith("floor="):
        floor = float(a.split("=")[1])
    elif ":" in a:
        views = [tuple([v.split(":")[0]] + [float(x) for x in v.split(":")[1:]]) for v in a.split(",")]

core.reset()
scene = render.setup_render(1280, 960, samples=samples)
importlib.import_module(f"props.{module}").build()
from mathutils import Vector  # noqa: E402

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
lo = min((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)
if floor is not None:
    lo = floor
    meshes = [o for o in meshes if max((o.matrix_world @ Vector(c)).z for c in o.bound_box) > floor + 0.001]
render.studio()
render.backdrop(z=lo - 0.0005)
out = os.path.join(render.PREVIEWS, "props")
for name, az, el, margin in views:
    cam = render.frame_objects(meshes, fov=26, azimuth=az, elevation=el, margin=margin)
    render.render_to(os.path.join(out, f"{module}_{name}.png"), cam)
    bpy.data.objects.remove(cam)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in meshes:
    m = o.evaluated_get(dg).to_mesh()
    m.calc_loop_triangles()
    tris += len(m.loop_triangles)
    o.evaluated_get(dg).to_mesh_clear()
print(f"PREVIEW {module}: {len(meshes)} meshes, {tris:,} triangles")
