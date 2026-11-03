"""Primitives with the house look baked in: bevelled edges, smooth shading, weighted normals.

All sizes are meters, rotations degrees. `anchor` picks the point of the shape that lands on `loc`:
(0, 0, -1) = bottom center (furniture standing on something), (0, 1, 0) = back center, etc.
Materials are palette names (see mats.py) or bpy materials.
"""

import math
import random

import bmesh
import bpy
from mathutils import Vector

from .core import DEG, apply_modifiers, finish, link, mesh_object, place
from .mats import M


def _mat(m):
    if m is None:
        return None
    if isinstance(m, (list, tuple)):
        return [_mat(x) for x in m]
    return M(m) if isinstance(m, str) else m


def _anchor_offset(size, anchor):
    return Vector((-anchor[0] * size[0] / 2, -anchor[1] * size[1] / 2, -anchor[2] * size[2] / 2))


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), mat="walnut", bevel=0.004, seg=3, anchor=(0, 0, 0), parent=None, **tags):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.translate(bm, vec=_anchor_offset(size, anchor), verts=bm.verts)
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, bevel, seg) if bevel else finish(ob, 0, wn=False)


def cyl(name, r, h, loc=(0, 0, 0), rot=(0, 0, 0), mat="walnut", seg=32, r2=None, bevel=0.002, bseg=2, cap=True, anchor_bottom=True, parent=None, **tags):
    """Cylinder/cone along local Z. anchor_bottom: loc is the bottom center."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if anchor_bottom:
        bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, bevel, bseg, angle=40, smooth_angle=50) if bevel else finish(ob, 0, smooth_angle=50)


def lathe(name, profile, loc=(0, 0, 0), rot=(0, 0, 0), mat="cream", seg=48, smooth_angle=50, parent=None, wn=False, **tags):
    """Revolve a (radius, z) profile around local Z. Points with r == 0 close the shape at the axis."""
    bm = bmesh.new()
    verts = [bm.verts.new((max(r, 0.0), 0.0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=seg, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    # collapse rings on the axis
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, 0, wn=wn, smooth_angle=smooth_angle)


def thick_profile(outer, wall):
    """A lathe profile for a hollow vessel: outer (r, z) points bottom→rim, then back down inside."""
    inner = [(max(r - wall, 0.0), z + (wall if i == 0 else 0)) for i, (r, z) in enumerate(outer)]
    rim_r, rim_z = outer[-1]
    lip = [(rim_r - wall * 0.5, rim_z + wall * 0.35)]
    pts = [(0.0, outer[0][1])] + outer + lip + list(reversed(inner))[0:] + [(0.0, inner[0][1])]
    return pts


def sphere(name, r, loc=(0, 0, 0), mat="ball", seg=32, rings=16, parent=None, rot=(0, 0, 0), scale=None, **tags):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    if scale:
        bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, 0, wn=False, smooth_angle=None)


def three_sphere(name, r, loc=(0, 0, 0), mat="globe_map", ws=96, hs=48, parent=None, **tags):
    """UV sphere with three.js SphereGeometry UVs (u = (lng+180)/360, v = 0 at the north pole),
    expressed in Blender coordinates, so globe pins (latLngToVector) and the ball texture line up."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    grid = []
    for iy in range(hs + 1):
        v = iy / hs
        row = []
        for ix in range(ws + 1):
            u = ix / ws
            tx = -math.cos(u * 2 * math.pi) * math.sin(v * math.pi)
            ty = math.cos(v * math.pi)
            tz = math.sin(u * 2 * math.pi) * math.sin(v * math.pi)
            # three (x, y, z) → blender (x, −z, y)
            row.append((bm.verts.new((tx * r, -tz * r, ty * r)), u, v))
        grid.append(row)
    for iy in range(hs):
        for ix in range(ws):
            a, b, c, d = grid[iy][ix + 1], grid[iy][ix], grid[iy + 1][ix], grid[iy + 1][ix + 1]
            quad = [a, b, c, d]
            if iy == 0:
                quad = [a, c, d]
            elif iy == hs - 1:
                quad = [a, b, c]
            f = bm.faces.new([q[0] for q in quad])
            for loop, q in zip(f.loops, quad):
                loop[uv_layer].uv = (q[1], 1 - q[2])  # blender v is up; glTF export flips it back
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    m = _mat(mat)
    if m:
        me.materials.append(m)
    me.shade_smooth()
    normals = [Vector(v.co).normalized() for v in me.vertices]
    me.normals_split_custom_set_from_vertices(normals)
    ob = link(bpy.data.objects.new(name, me))
    return place(ob, loc, (0, 0, 0), parent, **tags)


def torus(name, R, r, loc=(0, 0, 0), rot=(0, 0, 0), mat="brass", seg=48, ring=12, arc=360, parent=None, **tags):
    """Torus in local XY (axis Z). `arc` < 360 makes an open ring segment (e.g. a globe meridian)."""
    bm = bmesh.new()
    rings = []
    full = arc >= 360
    n = seg if full else seg + 1
    for i in range(n):
        u = (arc * DEG) * i / seg
        cu, su = math.cos(u), math.sin(u)
        ringv = []
        for j in range(ring):
            v = 2 * math.pi * j / ring
            x = (R + r * math.cos(v)) * cu
            y = (R + r * math.cos(v)) * su
            z = r * math.sin(v)
            ringv.append(bm.verts.new((x, y, z)))
        rings.append(ringv)
    for i in range(seg if full else seg):
        a, b = rings[i], rings[(i + 1) % n]
        for j in range(ring):
            bm.faces.new((a[j], b[j], b[(j + 1) % ring], a[(j + 1) % ring]))
    if not full:
        for cap in (rings[0], rings[-1]):
            bm.faces.new(cap)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, 0, wn=False, smooth_angle=None if full else 60)


def plane(name, w, h, loc=(0, 0, 0), rot=(0, 0, 0), mat="paper", parent=None, uv=True, **tags):
    """Quad in local XZ facing −Y (toward the visitor), UV 0..1 with v up (glTF: top row = v 0)."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    vs = [bm.verts.new(p) for p in ((-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2))]
    f = bm.faces.new(vs)
    for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv_layer].uv = (u, v)
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    return mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)


def rplane(name, w, h, r, loc=(0, 0, 0), rot=(0, 0, 0), mat="paper", seg=8, parent=None, **tags):
    """Rounded quad in local XZ facing −Y with planar UVs 0..1 (v up), like plane(): a phone screen."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in rrect_points(w, h, r, seg)])
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    for loop in f.loops:
        loop[uv_layer].uv = (loop.vert.co.x / w + 0.5, loop.vert.co.z / h + 0.5)
    return mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)


def rrect_points(w, h, r, seg=6):
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    pts = []
    corners = ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270))
    for cx, cy, a0 in corners:
        for i in range(seg + 1):
            a = (a0 + 90 * i / seg) * DEG
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def rrect(name, w, h, d, r, loc=(0, 0, 0), rot=(0, 0, 0), mat="cream", seg=8, bevel=0.002, bseg=2, axis="Y", anchor=(0, 0, 0), parent=None, **tags):
    """Rounded-rectangle prism. axis="Y": the w×h face lies in XZ (facing −Y), extruded d along +Y.
    axis="Z": w×h in XY, extruded d along +Z (a slab: keycaps, phone lying down, trays)."""
    bm = bmesh.new()
    pts = rrect_points(w, h, r, seg)
    if axis == "Y":
        verts = [bm.verts.new((x, -d / 2, z)) for x, z in pts]
        ext = Vector((0, d, 0))
    else:
        verts = [bm.verts.new((x, y, -d / 2)) for x, y in pts]
        ext = Vector((0, 0, d))
    face = bm.faces.new(verts)
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=ext, verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    size = (w, d, h) if axis == "Y" else (w, h, d)
    bmesh.ops.translate(bm, vec=_anchor_offset(size, anchor), verts=bm.verts)
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, bevel, bseg, angle=50, smooth_angle=50) if bevel else finish(ob, 0, smooth_angle=50)


def tube(name, pts, r, mat="ink", loc=(0, 0, 0), rot=(0, 0, 0), res=12, bevel_res=3, closed=False, kind="BEZIER", caps=True, taper=None, parent=None, **tags):
    """A round tube along points (cables, rods, wire, springs). Returns a mesh object."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = res
    cu.bevel_depth = r
    cu.bevel_resolution = bevel_res
    cu.use_fill_caps = caps
    if kind == "BEZIER":
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(pts) - 1)
        for bp, p in zip(sp.bezier_points, pts):
            bp.co = Vector(p)
            bp.handle_left_type = bp.handle_right_type = "AUTO"
    else:
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for pt, p in zip(sp.points, pts):
            pt.co = (*p, 1)
    sp.use_cyclic_u = closed
    ob = link(bpy.data.objects.new(name, cu))
    m = _mat(mat)
    if m:
        cu.materials.append(m)
    place(ob, loc, rot, parent, **tags)
    ob = apply_modifiers(ob)
    smooth_mesh(ob)
    return ob


def smooth_mesh(ob, angle=None):
    ob.data.shade_smooth()
    if angle:
        ob.data.set_sharp_from_angle(angle=angle * DEG)
    return ob


def text(name, body, size, loc=(0, 0, 0), rot=(0, 0, 0), mat="ink", extrude=0.0006, bevel=0.0, align="CENTER", font=None, spacing=1.0, parent=None, **tags):
    """3D lettering; by default it lies in local XY — rotate (90, 0, 0) to stand it facing −Y."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = 0
    cu.resolution_u = 3 if size < 0.05 else 5
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_character = spacing
    if font:
        cu.font = bpy.data.fonts.load(font, check_existing=True)
    ob = link(bpy.data.objects.new(name, cu))
    m = _mat(mat)
    if m:
        cu.materials.append(m)
    place(ob, loc, rot, parent, **tags)
    ob = apply_modifiers(ob)
    ob.data.shade_flat()
    return ob


def from_bm(name, bm, mat, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, seg=2, smooth_angle=40, wn=True, parent=None, **tags):
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, bevel, seg, smooth_angle=smooth_angle, wn=wn)


def jitter(seed):
    return random.Random(seed)


# ------------------------------------------------------------------ compound shapes


def _ring(bm, pts2d, plane_value, axis="Y"):
    if axis == "Y":
        return [bm.verts.new((x, plane_value, z)) for x, z in pts2d]
    return [bm.verts.new((x, y, plane_value)) for x, y in pts2d]


def _bridge(bm, a, b):
    n = len(a)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))


def loft(name, sections, loc=(0, 0, 0), rot=(0, 0, 0), mat="cream", seg=8, axis="Y", cap_start=True, cap_end=True, dish=0.0, parent=None, smooth_angle=50, bevel=0.0, **tags):
    """Loft rounded rectangles. sections: [(w, h, r, offset[, shift]), ...] along +axis (Y: w×h in XZ).
    `shift` moves a section's center along its h direction (a sloped toe, a leaning neck).
    dish > 0 sinks the end cap's center (keycaps)."""
    bm = bmesh.new()
    rings = []
    for sec in sections:
        w, h, r, off = sec[:4]
        shift = sec[4] if len(sec) > 4 else 0.0
        pts = [(x, y + shift) for x, y in rrect_points(w, h, r, seg)]
        rings.append(_ring(bm, pts, off, axis))
    for a, b in zip(rings, rings[1:]):
        _bridge(bm, a, b)
    if cap_start:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end:
        if dish:
            last = sections[-1]
            c = bm.verts.new((0, last[3] + (dish if axis == "Y" else 0), 0) if axis == "Y" else (0, 0, last[3] - dish))
            ring = rings[-1]
            for i in range(len(ring)):
                bm.faces.new((ring[i], ring[(i + 1) % len(ring)], c))
        else:
            bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm, _mat(mat), loc, rot, parent, **tags)
    return finish(ob, bevel, 2, angle=50, smooth_angle=smooth_angle)


def frame(name, w, h, iw, ih, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat="walnut", r=0.0, ir=0.0, seg=6, recess=0.0, back=True, bevel=0.003, inner_mat=None, ioff=(0.0, 0.0), parent=None, **tags):
    """A flat frame in XZ facing −Y: outer w×h, opening iw×ih, `depth` along +Y.
    The opening's walls run `recess` deep (0 = through-hole) and end in a back panel (inner_mat)."""
    bm = bmesh.new()
    n_pts = max(seg, 1)

    def rect(w_, h_, r_):
        if r_ <= 0:
            return [(w_ / 2, h_ / 2), (-w_ / 2, h_ / 2), (-w_ / 2, -h_ / 2), (w_ / 2, -h_ / 2)]
        return rrect_points(w_, h_, r_, n_pts)

    outer = rect(w, h, r)
    inner = [(x + ioff[0], z + ioff[1]) for x, z in rect(iw, ih, ir)]
    of = _ring(bm, outer, 0.0)
    inf = _ring(bm, inner, 0.0)
    _bridge(bm, inf, of)  # front face ring
    ob_ = _ring(bm, outer, depth)
    _bridge(bm, of, ob_)  # outer sides
    rec = recess if recess > 0 else depth
    ib = _ring(bm, inner, rec)
    _bridge(bm, ib, inf)  # opening walls
    if recess > 0:
        if back:
            bm.faces.new(list(reversed(ob_)))  # closed back behind the pocket
        f = bm.faces.new(ib)  # pocket floor
        f.material_index = 1 if inner_mat is not None else 0
    elif back:
        _bridge(bm, ob_, ib)  # through-hole: the back is a ring
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mats = [_mat(mat)] + ([_mat(inner_mat)] if inner_mat is not None else [])
    o = mesh_object(name, bm, mats, loc, rot, parent, **tags)
    return finish(o, bevel, 2, angle=50, smooth_angle=50)


def keycap_bm(w, d, h, gap=0.0025, top_inset=0.0032, r_bottom=0.0016, r_top=0.0026, dish=0.0006, seg=3):
    """One keycap: a rounded truncated pyramid with a dished top, base at z=0 (bmesh, not linked)."""
    bm = bmesh.new()
    bw, bd = w - gap, d - gap
    tw, td = bw - 2 * top_inset, bd - 2 * top_inset
    base = _ring(bm, rrect_points(bw, bd, r_bottom, seg), 0.0, "Z")
    mid = _ring(bm, rrect_points(bw - 0.0004, bd - 0.0004, r_bottom, seg), h * 0.25, "Z")
    top = _ring(bm, rrect_points(tw, td, r_top, seg), h, "Z")
    _bridge(bm, base, mid)
    _bridge(bm, mid, top)
    c = bm.verts.new((0, 0, h - dish))
    for i in range(len(top)):
        bm.faces.new((top[i], top[(i + 1) % len(top)], c))
    bm.faces.new(list(reversed(base)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def join_bms(parts):
    """[(bmesh, matrix)] → one bmesh."""
    out = bmesh.new()
    for bm, mat in parts:
        me = bpy.data.meshes.new("_j")
        bmesh.ops.transform(bm, matrix=mat, verts=bm.verts)
        bm.to_mesh(me)
        bm.free()
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
    return out
