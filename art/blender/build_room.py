"""Assemble the room → art/out/room.blend

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/build_room.py

1. every prop module builds its objects (props/*.py)
2. modifiers are applied, multi-material meshes split, and meshes merged per (owner, pivot, material)
3. merged meshes get their scene-contract names (part__<id>__NN, decor__<name>[__NN]) and parents
   (obj__<id> roots, pivots); contract nodes (screens, displays, slots, hits…) keep their names
4. hit boxes, labels and the site's camera presets are added
5. UV1 "Lightmap" is unwrapped + packed per bake set; untextured meshes copy it into UV0
"""

import importlib
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from layout import CAMS  # noqa: E402
from lib import core  # noqa: E402
from lib.geo import box  # noqa: E402

OBJECT_IDS = ["shelf", "computer", "phone", "globe", "window", "letter", "contact", "hoop"]
MODULES = ["shell", "window", "desk", "computer", "desk_objects", "shelf", "walldecor", "door", "floor", "extras"]
OUT = os.path.abspath(os.path.join(HERE, "..", "out"))
EXPORT_PROPS = ("bake", "glow", "aspect", "dynamic")
LIGHTMAP_SETS = {"room": 0.006, "props": 0.0035}  # pack margin (fraction of the atlas)


def select_only(objs, active=None):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


def realize():
    for ob in list(bpy.data.objects):
        if ob.type in ("CURVE", "FONT"):
            core.apply_modifiers(ob)
    for ob in [o for o in bpy.data.objects if o.type == "MESH"]:
        core.apply_modifiers(ob)


def split_by_material(ob):
    used = {p.material_index for p in ob.data.polygons}
    if len(used) <= 1:
        if len(ob.data.materials) > 1 and used:
            keep = ob.data.materials[next(iter(used))]
            for p in ob.data.polygons:
                p.material_index = 0
            ob.data.materials.clear()
            ob.data.materials.append(keep)
        return [ob]
    before = set(bpy.data.objects)
    select_only([ob])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    pieces = [ob] + [o for o in bpy.data.objects if o not in before]
    for p in pieces:
        idx = {poly.material_index for poly in p.data.polygons}
        mat = p.data.materials[next(iter(idx))] if idx else None
        for poly in p.data.polygons:
            poly.material_index = 0
        p.data.materials.clear()
        if mat:
            p.data.materials.append(mat)
        for k in ob.keys():
            p[k] = ob[k]
    return pieces


def reparent(ob, parent):
    """Keep the world transform, end with an identity parent-inverse."""
    bpy.context.view_layer.update()  # fresh objects have a stale matrix_world until an update
    mw = ob.matrix_world.copy()
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.matrix_basis = (parent.matrix_world.inverted() @ mw) if parent else mw


def bake_into_parent_space(ob, parent):
    """Move the object's transform into its vertices so it sits at identity under `parent`."""
    bpy.context.view_layer.update()
    m = (parent.matrix_world.inverted() if parent else Matrix.Identity(4)) @ ob.matrix_world
    ob.data.transform(m)
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.matrix_basis = Matrix.Identity(4)


def mesh_bbox_local(objs, frame):
    bpy.context.view_layer.update()
    inv = frame.matrix_world.inverted() if frame else Matrix.Identity(4)
    pts = [inv @ (o.matrix_world @ Vector(c)) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def descendants(ob):
    out = []
    for c in ob.children:
        out.append(c)
        out += descendants(c)
    return out


def assemble():
    contract = {o["contract"]: o for o in bpy.data.objects if "contract" in o.keys()}
    # ---- object roots
    roots = {}
    for oid in OBJECT_IDS:
        root = contract.get(f"obj__{oid}")
        if root is None:
            parts = [o for o in bpy.data.objects if o.type == "MESH" and o.get("own") == oid]
            lo, hi = core.world_bbox(parts)
            root = core.empty(f"obj__{oid}", ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        root.name = f"obj__{oid}"
        for k in list(root.keys()):
            del root[k]
        roots[oid] = root
    # ---- contract empties (pivots, anchors, labels) under their object roots
    for name, ob in contract.items():
        if ob.type != "EMPTY" or name.startswith("obj__"):
            continue
        owner = ob.get("own")
        ob.name = name
        if ob.parent is None and owner in roots:
            reparent(ob, roots[owner])
        for k in list(ob.keys()):
            del ob[k]
    # ---- contract meshes keep their transform; parent them to their object root
    for name, ob in contract.items():
        if ob.type != "MESH":
            continue
        ob.name = name
        ob.data.name = name
        owner = ob.get("own")
        if ob.parent is None and owner in roots:
            reparent(ob, roots[owner])
    # ---- merge everything else per (owner, pivot, material, bake, glow, dynamic, shadow)
    groups = {}
    for ob in [o for o in bpy.data.objects if o.type == "MESH" and "contract" not in o.keys()]:
        for piece in split_by_material(ob):
            mat = piece.data.materials[0].name if piece.data.materials else "none"
            key = (piece.get("own", "decor:misc"), piece.get("pivot"), mat, piece.get("bake", "props"), piece.get("glow"), bool(piece.get("dynamic")), piece.get("shadow", True))
            groups.setdefault(key, []).append(piece)
    decor_counts = {}
    for key in groups:
        if key[0].startswith("decor:"):
            decor_counts[key[0]] = decor_counts.get(key[0], 0) + 1
    part_n, decor_n = {}, {}
    pivots = {o.name.split("__")[1]: o for o in bpy.data.objects if o.type == "EMPTY" and o.name.startswith("pivot__")}
    for key in sorted(groups, key=lambda k: (k[0], str(k[1]), k[2])):
        own, pivot, mat, bake, glow, dynamic, shadow = key
        objs = groups[key]
        if len(objs) > 1:
            select_only(objs, objs[0])
            bpy.ops.object.join()
        ob = objs[0]
        parent = pivots.get(pivot) if pivot else roots.get(own)
        bake_into_parent_space(ob, parent)
        if own.startswith("decor:"):
            name = own[6:]
            if decor_counts[own] == 1:
                ob.name = f"decor__{name}"
            else:
                decor_n[name] = decor_n.get(name, 0) + 1
                ob.name = f"decor__{name}__{decor_n[name]:02d}"
        else:
            part_n[own] = part_n.get(own, 0) + 1
            ob.name = f"part__{own}__{part_n[own]:02d}"
        ob.data.name = ob.name
    # ---- hit boxes + labels for objects that didn't bring their own
    for oid, root in roots.items():
        meshes = [o for o in descendants(root) if o.type == "MESH" and not o.name.startswith("hit__")]
        if f"hit__{oid}" not in bpy.data.objects:
            lo, hi = mesh_bbox_local(meshes, root)
            pad = Vector((0.02, 0.02, 0.02))
            size = (hi - lo) + 2 * pad
            hit = box(f"hit__{oid}", tuple(size), loc=(0, 0, 0), mat="#ff00ff", bevel=0)
            hit.modifiers.clear()
            hit.parent = root
            hit.matrix_parent_inverse = Matrix.Identity(4)
            hit.location = (lo + hi) / 2
            hit.name = f"hit__{oid}"
            hit.data.name = hit.name
        if f"label__{oid}" not in bpy.data.objects:
            lo, hi = mesh_bbox_local(meshes, root)
            lab = core.empty(f"label__{oid}", ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z + 0.08), parent=root)
            lab.name = f"label__{oid}"
    # ---- the site's camera presets
    for fid, (pos, target) in CAMS.items():
        core.empty(f"cam__{fid}", pos).name = f"cam__{fid}"
        core.empty(f"cam__{fid}__target", target).name = f"cam__{fid}__target"


def ray_visibility():
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        if ob.name.startswith("hit__"):
            ob.hide_render = True
            continue
        if ob.get("shadow") is False or ob.get("bake") == "none":
            ob.visible_shadow = False
        if ob.name.startswith(("display__window",)):
            ob.visible_diffuse = False
            ob.visible_glossy = False


def clean_props():
    for ob in bpy.data.objects:
        keep = {}
        for k in EXPORT_PROPS:
            if k in ob.keys():
                keep[k] = ob[k]
        for k in list(ob.keys()):
            del ob[k]
        if ob.type != "MESH":
            continue
        if keep.get("bake") in (None, "none") or ob.name.startswith(("hit__", "screen__", "display__window", "display__now")):
            keep.pop("bake", None)
        for k, v in keep.items():
            if k == "dynamic" and not v:
                continue
            ob[k] = v


def cull_contact_faces(gap=0.0025):
    """Delete faces pressed against another surface (bottoms on the floor, backs on a wall): they
    can never be seen, and they'd waste lightmap space. A ray from each face center along its normal
    that hits something within `gap` marks it hidden."""
    import bmesh

    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    scene = bpy.context.scene
    removed = 0
    for ob in [o for o in bpy.data.objects if o.type == "MESH" and o.get("bake") in LIGHTMAP_SETS]:
        if ob.name.startswith(("screen__", "display__", "hit__")):
            continue
        mw = ob.matrix_world
        nmat = mw.to_3x3().inverted().transposed()
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.faces.ensure_lookup_table()
        doomed = []
        for f in bm.faces:
            if f.calc_area() < 1e-8:
                continue
            c = mw @ f.calc_center_median()
            n = (nmat @ f.normal).normalized()
            hit, loc, _, _, hit_ob, _ = scene.ray_cast(dg, c + n * 0.0004, n, distance=gap)
            if hit and hit_ob is not None and hit_ob.name != ob.name and not hit_ob.name.startswith(("hit__",)):
                doomed.append(f)
        if doomed and len(doomed) < len(bm.faces):
            bmesh.ops.delete(bm, geom=doomed, context="FACES")
            bm.to_mesh(ob.data)
            removed += len(doomed)
        bm.free()
    print(f"  culled {removed:,} contact faces")


def mesh_area(ob):
    m = ob.matrix_world
    s = abs(m.to_3x3().determinant()) ** (2 / 3)
    return sum(p.area for p in ob.data.polygons) * s


def unwrap_lightmaps():
    sets = {}
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ob.get("bake") in LIGHTMAP_SETS:
            sets.setdefault(ob["bake"], []).append(ob)
    for ob in [o for o in bpy.data.objects if o.type == "MESH"]:
        me = ob.data
        # UVMap must be first (TEXCOORD_0) and Lightmap second (TEXCOORD_1); drop anything else
        for layer in [l for l in me.uv_layers if l.name not in ("UVMap", "Lightmap")]:
            me.uv_layers.remove(layer)
        if "UVMap" not in me.uv_layers:
            if "Lightmap" in me.uv_layers:
                me.uv_layers.remove(me.uv_layers["Lightmap"])
            me.uv_layers.new(name="UVMap")
        if ob.get("bake") in LIGHTMAP_SETS:
            lm = me.uv_layers.get("Lightmap") or me.uv_layers.new(name="Lightmap")
            me.uv_layers.active = lm
    for name, objs in sets.items():
        select_only(objs, objs[0])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.uv.average_islands_scale()
        bpy.ops.object.mode_set(mode="OBJECT")
        # small, dense things (keycaps, fringe, leaves, net, springs…) get less lightmap resolution
        for ob in objs:
            area = mesh_area(ob)
            density = len(ob.data.vertices) / max(area, 1e-6)
            k = 1.0
            if area < 0.004 or density > 60000:
                k = 0.3
            elif area < 0.03 or density > 20000:
                k = 0.55
            if k < 1.0:
                lm = ob.data.uv_layers["Lightmap"]
                for d in lm.data:
                    d.uv = d.uv * k
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.select_all(action="SELECT")
        bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method="FRACTION", margin=LIGHTMAP_SETS[name], shape_method="CONCAVE")
        bpy.ops.object.mode_set(mode="OBJECT")
        print(f"  lightmap set {name}: {len(objs)} meshes")
    # untextured meshes: UV0 = UV1 (keeps TEXCOORD_0 meaningful and cheap to compress)
    for ob in [o for o in bpy.data.objects if o.type == "MESH"]:
        me = ob.data
        textured = any(m and m.use_nodes and any(n.type == "TEX_IMAGE" for n in m.node_tree.nodes) for m in me.materials)
        is_uv_contract = ob.name.startswith(("slot__", "screen__", "display__"))
        uv0, lm = me.uv_layers["UVMap"], me.uv_layers.get("Lightmap")
        if lm is not None and not textured and not is_uv_contract:
            for a, b in zip(uv0.data, lm.data):
                a.uv = b.uv
        me.uv_layers.active = uv0
        uv0.active_render = True


def main():
    core.reset()
    for m in MODULES:
        importlib.import_module(f"props.{m}").build()
    realize()
    assemble()
    ray_visibility()
    clean_props()
    cull_contact_faces()
    unwrap_lightmaps()
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "room.blend")
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    print(f"BUILD ok → {path}: {len(bpy.data.objects)} objects, {len(meshes)} meshes, {tris:,} triangles")


main()
