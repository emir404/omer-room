"""Scene + object helpers shared by every prop script.

Coordinates are Blender's: meters, Z up. The room's floor is z = 0, the back wall's inner face is
y = +2.25, the left wall's inner face is x = −2.25; the visitor looks in from the open front-right
(−y, +x). glTF export converts to Y-up: (x, y, z)_blender → (x, z, −y)_gltf.

Objects are built with descriptive names plus *tags* (custom properties). `build_room.py` reads the
tags to merge meshes and give them their scene-contract names, so prop code never deals with
`part__shelf__07`-style names:

    own       "shelf" | "computer" | …  (an OBJECT_ID → part__<id>__NN)  or  "decor:<name>"
    contract  exact contract name for special nodes (screen__computer, slot__book__01, …)
    pivot     pivot id this mesh moves with (globe, contact_flag, hoop_ball)
    bake      lightmap set ("room" | "props") or "none" (emissive / dynamic / hidden)
    glow      "lamp" | "monitor" | "string" — emissive at night
    dynamic   True → realtime-lit at runtime (it moves, so a baked lightmap would be wrong)
    shadow    False → doesn't cast shadows / occlude in bakes (moving things, glass)
"""

import contextlib
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

DEG = math.pi / 180

_state = {"coll": None, "tags": {}}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    _state["coll"] = sc.collection
    _state["tags"] = {}
    return sc


def collection(name, parent=None):
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if coll.name not in parent.children:
        parent.children.link(coll)
    return coll


@contextlib.contextmanager
def group(name, **tags):
    """Objects created inside land in collection `name` and inherit `tags`."""
    prev_coll, prev_tags = _state["coll"], dict(_state["tags"])
    _state["coll"] = collection(name, prev_coll if prev_coll is not bpy.context.scene.collection else None)
    _state["tags"] = {**prev_tags, **tags}
    try:
        yield _state["coll"]
    finally:
        _state["coll"], _state["tags"] = prev_coll, prev_tags


def tag(ob, **tags):
    for k, v in tags.items():
        if v is None:
            if k in ob:
                del ob[k]
        else:
            ob[k] = v
    return ob


def link(ob):
    (_state["coll"] or bpy.context.scene.collection).objects.link(ob)
    return ob


def place(ob, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, **tags):
    """rot in degrees (XYZ euler)."""
    ob.location = Vector(loc)
    ob.rotation_euler = [r * DEG for r in rot]
    if parent is not None:
        ob.parent = parent
    tag(ob, **{**_state["tags"], **tags})
    return ob


def mesh_object(name, bm, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, **tags):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    if mat is not None:
        for m in mat if isinstance(mat, (list, tuple)) else [mat]:
            me.materials.append(m)
    ob = link(bpy.data.objects.new(name, me))
    return place(ob, loc, rot, parent, **tags)


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, size=0.05):
    ob = link(bpy.data.objects.new(name, None))
    ob.empty_display_size = size
    ob.location = Vector(loc)
    ob.rotation_euler = [r * DEG for r in rot]
    if parent is not None:
        ob.parent = parent
    return ob


# ------------------------------------------------------------------ modifiers + shading


def bevel(ob, width, segments=3, angle=35, profile=0.5, clamp=True):
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = angle * DEG
    m.profile = profile
    m.miter_outer = "MITER_ARC"
    m.use_clamp_overlap = clamp
    return ob


def weighted_normals(ob):
    m = ob.modifiers.new("wn", "WEIGHTED_NORMAL")
    m.keep_sharp = True
    m.mode = "FACE_AREA"
    m.weight = 50
    return ob


def smooth(ob, angle=40):
    """Smooth shading with sharp edges above `angle` (degrees)."""
    me = ob.data
    me.shade_smooth()
    if angle is not None:
        me.set_sharp_from_angle(angle=angle * DEG)
    return ob


def finish(ob, bevel_width=0.0, segments=3, angle=35, wn=True, smooth_angle=40):
    """Standard look: bevel every hard edge, smooth shading, weighted normals."""
    if bevel_width > 0:
        bevel(ob, bevel_width, segments, angle)
    smooth(ob, smooth_angle)
    if wn:
        weighted_normals(ob)
    return ob


def apply_modifiers(ob):
    """Bake the modifier stack into the mesh (bevels, normals, deforms)."""
    if ob.type == "MESH" and not ob.modifiers:
        return ob
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    if ob.type != "MESH":
        mats = [s.material for s in ob.material_slots]
        mesh_ob = link_like(ob, new)
        for m in mats:
            if m and m.name not in [x.name for x in new.materials]:
                new.materials.append(m)
        bpy.data.objects.remove(ob)
        return mesh_ob
    old = ob.data
    ob.modifiers.clear()
    ob.data = new
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def link_like(src, mesh):
    """Replace a curve/text object by a mesh object with the same transform, parent and tags."""
    name = src.name
    ob = bpy.data.objects.new(name + "_m", mesh)
    for coll in src.users_collection:
        coll.objects.link(ob)
    ob.matrix_world = src.matrix_world.copy()
    ob.parent = src.parent
    if src.parent:
        ob.matrix_parent_inverse = src.matrix_parent_inverse.copy()
    for k in src.keys():
        ob[k] = src[k]
    return ob


def bm_transform(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=None):
    mat = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(rot[2] * DEG, 4, "Z") @ Matrix.Rotation(
        rot[1] * DEG, 4, "Y"
    ) @ Matrix.Rotation(rot[0] * DEG, 4, "X")
    if scale is not None:
        mat = mat @ Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=mat, verts=bm.verts)
    return bm


def merge_into(target_bm, ob):
    """Append a mesh object's geometry (in world space) into a bmesh."""
    tmp = bmesh.new()
    tmp.from_mesh(ob.data)
    bmesh.ops.transform(tmp, matrix=ob.matrix_world, verts=tmp.verts)
    me = bpy.data.meshes.new("_tmp")
    tmp.to_mesh(me)
    tmp.free()
    target_bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def world_bbox(obs):
    pts = []
    for ob in obs:
        if ob.type != "MESH":
            continue
        pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    if not pts:
        return None
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi
