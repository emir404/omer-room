"""Render one prop module under studio light: Blender -b --factory-startup -P preview_prop.py -- <module> [samples] [item=<id>,<id>…]

Writes art/previews/props/<module>_<view>.png. Review every one before it goes into the room.
With item=<id> (shelf items, see lib.core.item) only that item renders, as you'd hold it: views
are relative to its face (+X), so `a` is straight on, `b` a 3/4 turn, `c` its back. Output:
art/previews/props/item_<id>_<view>.png."""

import importlib
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib import core, render  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
module = argv[0]
samples = int(argv[1]) if len(argv) > 1 else 96
views = [("a", -32, 24, 1.15), ("b", 28, 14, 1.0), ("c", 145, 30, 1.1)]
floor = None
items = []
for a in argv[2:]:
    if a.startswith("floor="):
        floor = float(a.split("=")[1])
    elif a.startswith("item="):
        items = a.split("=")[1].split(",")
    elif ":" in a:
        views = [tuple([v.split(":")[0]] + [float(x) for x in v.split(":")[1:]]) for v in a.split(",")]

core.reset()
scene = render.setup_render(1280, 960, samples=samples)
importlib.import_module(f"props.{module}").build()

meshes = [o for o in bpy.data.objects if o.type == "MESH"]


def tris(objs):
    n = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        m = o.evaluated_get(dg).to_mesh()
        m.calc_loop_triangles()
        n += len(m.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return n


if items:
    render.studio()
    out = os.path.join(render.PREVIEWS, "props")
    for iid in items:
        mine = [o for o in meshes if o.get("item") == iid]
        root = next(o for o in bpy.data.objects if o.get("contract") == f"item__{iid}")
        for o in meshes:
            o.hide_render = o not in mine
        # hold it up: move the item so its frame is the world frame, standing above a backdrop
        bpy.context.view_layer.update()
        to_local = root.matrix_world.to_3x3().normalized().to_4x4().inverted()
        saved = {o: o.matrix_world.copy() for o in mine}
        for o in mine:
            o.matrix_world = to_local @ o.matrix_world
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in mine for c in o.bound_box]
        mid = sum(pts, Vector()) / len(pts)
        for o in mine:
            o.matrix_world = Matrix.Translation(Vector((0, 0, 0.4)) - mid) @ o.matrix_world
        bpy.context.view_layer.update()
        lo = min((o.matrix_world @ Vector(c)).z for o in mine for c in o.bound_box)
        bd = render.backdrop(z=lo - 0.02)
        for name, az, el, margin in (("a", 90, 8, 1.25), ("b", 90 + 40, 18, 1.25), ("c", 90 + 160, 22, 1.3)):
            cam = render.frame_objects(mine, fov=26, azimuth=az, elevation=el, margin=margin)
            render.render_to(os.path.join(out, f"item_{iid}_{name}.png"), cam)
            bpy.data.objects.remove(cam)
        bpy.data.objects.remove(bd)
        for o, m in saved.items():
            o.matrix_world = m
        print(f"PREVIEW item {iid}: {len(mine)} meshes, {tris(mine):,} triangles")
    sys.exit(0)

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
print(f"PREVIEW {module}: {len(meshes)} meshes, {tris(meshes):,} triangles")
