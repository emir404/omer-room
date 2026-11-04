"""Assemble the room → art/out/room.blend

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/build_room.py

1. every prop module builds its objects (props/*.py)
2. modifiers are applied, multi-material meshes split, and meshes merged per (owner, pivot, item,
   material)
3. merged meshes get their scene-contract names (part__<id>__NN, decor__<name>[__NN],
   item__<id>__NN) and parents (obj__<id> roots, pivots, item empties); contract nodes (screens,
   displays, slots, hits…) keep their names
4. hit boxes, labels and the site's camera presets are added
5. UV1 "Lightmap" is unwrapped + packed per bake set; untextured meshes copy it into UV0

Items (shelf things you can pick up, tag item="<id>", see lib.core.item): an empty item__<id> at
the item's middle under obj__shelf, oriented by the prop (+X out of the face you'd show someone,
+Z up); its meshes merge per material under it, its slot planes keep their names. Items are never
contact-culled (they're seen from every side in hand) and never cause culling on what they rest
on (it shows when they're lifted); their hidden faces get a small share of the lightmap instead.
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
EXPORT_PROPS = ("bake", "glow", "aspect", "dynamic", "section")  # mesh custom props → glTF extras
NODE_EXTRAS = ("section", "faceout", "w", "h", "open")  # empty custom props → glTF extras
LIGHTMAP_SETS = {"room": 0.006, "props": 0.0035}  # pack margin (fraction of the atlas)
HIDDEN_LM = 0.15  # lightmap density of item faces pressed against something (spine-out boards…)
EXTRAS = {}  # final empty name → extras to export
LM_SCALE = {}  # final mesh name → lightmap density factor (tag `lm`)


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


def item_empties(contract, roots):
    """item__<id> empties: moved to the middle of their meshes (measured in the item's own frame,
    so the orientation the prop gave them stays), parented under their object root."""
    items = {}
    for name, ob in contract.items():
        if ob.type != "EMPTY" or not name.startswith("item__"):
            continue
        iid = name[len("item__"):]
        members = [o for o in bpy.data.objects if o.type == "MESH" and o.get("item") == iid]
        if not members:
            raise RuntimeError(f"{name} has no meshes")
        bpy.context.view_layer.update()
        rot = ob.matrix_world.to_3x3().normalized()
        inv = rot.transposed()
        pts = [inv @ (o.matrix_world @ v.co) for o in members for v in o.data.vertices]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        ob.matrix_world = Matrix.Translation(rot @ ((lo + hi) / 2)) @ rot.to_4x4()
        ob.name = name
        EXTRAS[name] = {k: ob[k] for k in NODE_EXTRAS if k in ob.keys()}
        reparent(ob, roots[ob.get("own", "shelf")])
        for k in list(ob.keys()):
            del ob[k]
        items[iid] = ob
    return items


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
    items = item_empties(contract, roots)
    # ---- contract empties (pivots, anchors, labels) under their object roots
    for name, ob in contract.items():
        if ob.type != "EMPTY" or name.startswith(("obj__", "item__")):
            continue
        owner = ob.get("own")
        ob.name = name
        extras = {k: ob[k] for k in NODE_EXTRAS if k in ob.keys()}
        if extras:
            EXTRAS[name] = extras
        if ob.parent is None and owner in roots:
            reparent(ob, roots[owner])
        for k in list(ob.keys()):
            del ob[k]
    # ---- contract meshes keep their transform; parent them to their item or object root
    for name, ob in contract.items():
        if ob.type != "MESH":
            continue
        ob.name = name
        ob.data.name = name
        if "lm" in ob.keys():
            LM_SCALE[name] = float(ob["lm"])
        owner = ob.get("own")
        if ob.get("item"):
            reparent(ob, items[ob["item"]])
        elif ob.parent is None and owner in roots:
            reparent(ob, roots[owner])
    # ---- merge everything else per (owner, pivot, item, material, bake, glow, dynamic, shadow, lm)
    groups = {}
    for ob in [o for o in bpy.data.objects if o.type == "MESH" and "contract" not in o.keys()]:
        for piece in split_by_material(ob):
            mat = piece.data.materials[0].name if piece.data.materials else "none"
            key = (piece.get("own", "decor:misc"), piece.get("pivot"), piece.get("item"), mat, piece.get("bake", "props"), piece.get("glow"),
                   bool(piece.get("dynamic")), piece.get("shadow", True), piece.get("lm"))
            groups.setdefault(key, []).append(piece)
    decor_counts = {}
    for key in groups:
        if key[0].startswith("decor:"):
            decor_counts[key[0]] = decor_counts.get(key[0], 0) + 1
    part_n, decor_n, item_n = {}, {}, {}
    pivots = {o.name.split("__")[1]: o for o in bpy.data.objects if o.type == "EMPTY" and o.name.startswith("pivot__")}
    for key in sorted(groups, key=lambda k: (k[0], str(k[1]), str(k[2]), k[3], str(k[8]))):
        own, pivot, iid, mat, bake, glow, dynamic, shadow, lm = key
        objs = groups[key]
        if len(objs) > 1:
            select_only(objs, objs[0])
            bpy.ops.object.join()
        ob = objs[0]
        parent = items[iid] if iid else pivots.get(pivot) if pivot else roots.get(own)
        bake_into_parent_space(ob, parent)
        if iid:
            item_n[iid] = item_n.get(iid, 0) + 1
            ob.name = f"item__{iid}__{item_n[iid]:02d}"
        elif own.startswith("decor:"):
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
        if lm is not None:
            LM_SCALE[ob.name] = float(lm)
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
            for k, v in EXTRAS.get(ob.name, {}).items():
                ob[k] = v
            continue
        if keep.get("bake") in (None, "none") or ob.name.startswith(("hit__", "screen__", "display__window", "display__now")):
            keep.pop("bake", None)
        if not ob.name.startswith("slot__label__"):
            keep.pop("section", None)  # items carry their section on the item empty
        for k, v in keep.items():
            if k == "dynamic" and not v:
                continue
            ob[k] = v


def in_item(ob):
    p = ob.parent
    while p is not None:
        if p.name.startswith("item__"):
            return True
        p = p.parent
    return False


def contact_faces(dg, ob, bm, gap, ignore=()):
    """Faces of `ob` (bmesh `bm`) pressed against another surface: rays along the face normal from
    its center and from near each corner all hit something (not itself, not a hit proxy, nothing in
    `ignore`) within `gap`. Testing the corners too keeps a big face that's only partly covered
    (a shelf lip behind a name plate, a floor under a rug) from being taken for hidden."""
    scene = bpy.context.scene
    mw = ob.matrix_world
    nmat = mw.to_3x3().inverted().transposed()

    def other(hit_ob):
        return hit_ob is not None and hit_ob.name != ob.name and not hit_ob.name.startswith("hit__") and hit_ob.name not in ignore

    def covered(p, n):
        hit, _, _, _, hit_ob, _ = scene.ray_cast(dg, p + n * 0.0004, n, distance=gap)
        if hit and other(hit_ob):
            return True
        # or the point sits just behind another surface (sunk a little into the floor or a wall):
        # looking back along −n, the first thing within `gap` is that surface's back side
        hit, _, hn, _, hit_ob, _ = scene.ray_cast(dg, p + n * 0.0001, -n, distance=gap)
        return bool(hit and other(hit_ob) and hn.dot(-n) > 0)

    scale = abs(mw.to_3x3().determinant()) ** (2 / 3)
    out = []
    for f in bm.faces:
        area = f.calc_area() * scale
        if area < 1e-8:
            continue
        c = f.calc_center_median()
        n = (nmat @ f.normal).normalized()
        samples = [c]
        if area > 0.002:  # big faces must be covered near their corners too (small ones: the center will do)
            corners = [v.co for v in f.verts]
            samples += [c.lerp(v, 0.8) for v in corners[:: max(1, len(corners) // 8)]]
        if all(covered(mw @ p, n) for p in samples):
            out.append(f)
    return out


def cull_contact_faces(gap=0.0025):
    """Delete faces pressed against another surface (bottoms on the floor, backs on a wall): they
    can never be seen, and they'd waste lightmap space. A ray from each face center along its normal
    that hits something within `gap` marks it hidden. Items are exempt both ways: they're seen from
    every side once picked up, and lifting one shows what it stood on."""
    import bmesh

    items = {o.name for o in bpy.data.objects if o.type == "MESH" and in_item(o)}
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    removed = 0
    for ob in [o for o in bpy.data.objects if o.type == "MESH" and o.get("bake") in LIGHTMAP_SETS]:
        if ob.name.startswith(("screen__", "display__", "hit__")) or ob.name in items:
            continue
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.faces.ensure_lookup_table()
        doomed = contact_faces(dg, ob, bm, gap, ignore=items)
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


def lightmap_density(objs):
    """Texels per meter on a 1024 px atlas for full-density faces (the 90th percentile by area)."""
    rows = []
    for ob in objs:
        m = ob.matrix_world
        s = abs(m.to_3x3().determinant()) ** (2 / 3)
        uv = ob.data.uv_layers["Lightmap"].data
        for p in ob.data.polygons:
            if p.area <= 1e-9:
                continue
            pts = [uv[li].uv for li in p.loop_indices]
            a = 0.0
            for i in range(1, len(pts) - 1):
                a += abs((pts[i] - pts[0]).cross(pts[i + 1] - pts[0])) / 2
            rows.append(((a / (p.area * s)) ** 0.5 * 1024, p.area * s))
    rows.sort()
    total = sum(w for _, w in rows)
    acc = 0.0
    for d, w in rows:
        acc += w
        if acc >= 0.9 * total:
            return d
    return 0.0


def shrink_hidden_item_faces(objs, gap=0.004):
    """Items keep the faces they rest on or press against (a book's boards between its neighbors,
    every bottom), but at rest nobody sees them: shrink their lightmap islands to HIDDEN_LM about
    their own center, so the packer spends the atlas on what shows. Each shrunk face becomes its
    own island (lightmap seams on hidden faces don't show)."""
    import bmesh

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    shrunk = 0
    for ob in objs:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.faces.ensure_lookup_table()
        bm.faces.index_update()
        hidden = [f.index for f in contact_faces(dg, ob, bm, gap)]
        bm.free()
        # write through the mesh API (a bmesh round trip could drop the custom normals items keep)
        uv = ob.data.uv_layers["Lightmap"].data
        for i in hidden:
            loops = list(ob.data.polygons[i].loop_indices)
            c = sum((uv[li].uv for li in loops), Vector((0.0, 0.0))) / len(loops)
            for li in loops:
                uv[li].uv = c + (uv[li].uv - c) * HIDDEN_LM
        shrunk += len(hidden)
    print(f"  shrank the lightmap of {shrunk:,} hidden item faces")


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
            k = LM_SCALE.get(ob.name, k)
            if k != 1.0:
                lm = ob.data.uv_layers["Lightmap"]
                for d in lm.data:
                    d.uv = d.uv * k
        shrink_hidden_item_faces([o for o in objs if in_item(o)])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.select_all(action="SELECT")
        bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method="FRACTION", margin=LIGHTMAP_SETS[name], shape_method="CONCAVE")
        bpy.ops.object.mode_set(mode="OBJECT")
        print(f"  lightmap set {name}: {len(objs)} meshes, {lightmap_density(objs):.0f} texels/m at 1024 px (full density)")
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
