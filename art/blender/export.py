"""Export art/out/room.blend → art/out/room.glb (UV0 albedo + UV1 lightmap, node extras).

    Blender -b --factory-startup -P art/blender/export.py

Textures go out as PNG; scripts/build-assets.mjs re-encodes them (WebP) and compresses geometry."""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "out"))

bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, "room.blend"))
for ob in list(bpy.data.objects):
    if ob.type in ("LIGHT", "CAMERA") or ob.name.startswith("__"):
        bpy.data.objects.remove(ob)
# the hit material only has to exist; keep it plain
for m in bpy.data.materials:
    for n in [n for n in (m.node_tree.nodes if m.use_nodes else []) if n.name == "__bake__"]:
        m.node_tree.nodes.remove(n)
bad = [o.name for o in bpy.data.objects if not all(c.isalnum() or c == "_" for c in o.name) or o.name != o.name.lower()]
if bad:
    print("EXPORT error: names outside [a-z0-9_]:", bad[:20])
    sys.exit(1)
path = os.path.join(OUT, "room.glb")
bpy.ops.export_scene.gltf(
    filepath=path,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_extras=True,
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_vertex_color="NONE",
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_yup=True,
    export_unused_images=False,
    export_unused_textures=False,
)
print(f"EXPORT ok → {path} ({os.path.getsize(path) / 1e6:.2f} MB)")
