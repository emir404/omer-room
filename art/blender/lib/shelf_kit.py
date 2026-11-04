"""Builders for the library (props/shelf.py): books, binders, ribbons, medals, frames and stands.

Everything is modeled closed (items are picked up and turned in the hand) and placed with a world
matrix, so props/shelf.py only decides where things go. Meters; Blender axes (Z up).

Book frame ("bm" frame, as the old book_bm): spine faces +X, front board +Y, z = 0 at the tail.
An upright spine-out book on the left-wall shelf is that frame unrotated; its item frame (+X out of
the front cover, +Z up) is the bm frame turned 90° about Z.
"""

import math

import bmesh
from mathutils import Matrix, Vector

from .core import DEG, basis, item
from .geo import box, cyl, frame, from_bm, lathe, plane, torus
from .mats import M

CORNER_UV = (0.004, 0.996)  # top-left texel of a slot's atlas cell (glTF v is flipped)
BM_TO_ITEM = Matrix.Rotation(90 * DEG, 4, "Z")  # book/binder bm frame → item frame


def put(ob, mw):
    ob.matrix_world = mw
    return ob


def rot_only(m):
    return m.to_3x3().normalized().to_4x4()


# ------------------------------------------------------------------ extrusions


def prism_bm(pts, width):
    """An (x, z) outline extruded along Y, centered (width along Y). Concave outlines are fine."""
    bm = bmesh.new()
    a = [bm.verts.new((x, -width / 2, z)) for x, z in pts]
    b = [bm.verts.new((x, width / 2, z)) for x, z in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def slab_bm(pts, depth, z0=0.0):
    """An (x, y) outline extruded along Z from z0 by depth (bottom and top capped)."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y, z0)) for x, y in pts]
    b = [bm.verts.new((x, y, z0 + depth)) for x, y in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def arc(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos((a0 + (a1 - a0) * i / n) * DEG), cy + r * math.sin((a0 + (a1 - a0) * i / n) * DEG)) for i in range(n + 1)]


def strip_bm(path, side, widths, thick):
    """A flat band (ribbon, strap, twine-flat) along `path`; `side` is the width direction (one
    vector, or one per point), `widths` one per point. Closed: a thin box section, capped."""
    bm = bmesh.new()
    rings = []
    n = len(path)
    pts = [Vector(p) for p in path]
    for i, p in enumerate(pts):
        tan = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        s = Vector(side[i] if isinstance(side, list) else side)
        s = (s - tan * s.dot(tan)).normalized()
        nrm = tan.cross(s).normalized()
        hw = max(widths[i], 0.0008) / 2
        ht = thick / 2
        rings.append([bm.verts.new(p + s * hw * a + nrm * ht * b) for a, b in ((1, 1), (-1, 1), (-1, -1), (1, -1))])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((ra[k], ra[(k + 1) % 4], rb[(k + 1) % 4], rb[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def taper_widths(path, width, ends=(True, True)):
    """Full width along the path, narrowing to a point over width/2 at the chosen ends: the V fold
    of a medal ribbon."""
    pts = [Vector(p) for p in path]
    s = [0.0]
    for a, b in zip(pts, pts[1:]):
        s.append(s[-1] + (b - a).length)
    total = s[-1]
    out = []
    for d in s:
        k = 1.0
        if ends[0]:
            k = min(k, d / (width / 2))
        if ends[1]:
            k = min(k, (total - d) / (width / 2))
        out.append(width * max(0.0, min(1.0, k)))
    return out


def ribbon(name, path, side, width, thick, mat, ends=(True, True)):
    """`path` must have points at width/2 from each tapered end (see loop_over)."""
    ob = from_bm(name, strip_bm(path, side, taper_widths(path, width, ends), thick), mat, wn=False, smooth_angle=50)
    return ob


def loop_over(tip_front, tip_back, bar, r, width, steps=8):
    """Ribbon centerline (x, z in some plane): from `tip_front` up to a bar of radius r (center
    `bar`), over it, and down to `tip_back`; extra points at width/2 from each tip so the taper
    reads as a clean V."""
    tf, tb, c = Vector(tip_front), Vector(tip_back), Vector(bar)
    front_top = Vector((c.x + r, c.y - 0.004))
    back_top = Vector((c.x - r, c.y - 0.004))
    pts = [tf, tf + (front_top - tf).normalized() * width / 2, tf + (front_top - tf) * 0.55, front_top]
    for i in range(steps + 1):
        a = math.pi * i / steps
        pts.append(Vector((c.x + r * math.cos(a), c.y + r * math.sin(a))))
    pts += [back_top, tb + (back_top - tb) * 0.55, tb + (back_top - tb).normalized() * width / 2, tb]
    return pts


# ------------------------------------------------------------------ books


def book_shell_bm(w, h, d, t, bulge, n=6):
    """Cover shell (bm frame): spine + boards, a C-shape extruded to height h. The spine's outer face
    spans UV 0..1 (u along +Y, v up); every other face sits on the corner texel."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    pts = [(d / 2 + bulge * math.sin(math.pi * k / n), -w / 2 + w * k / n, k) for k in range(n + 1)]
    pts += [(-d / 2, w / 2, None), (-d / 2, w / 2 - t, None)]
    pts += [(d / 2 - t + bulge * 0.6 * math.sin(math.pi * (n - k) / n), w / 2 - t - (w - 2 * t) * k / n, None) for k in range(n + 1)]
    pts += [(-d / 2, -w / 2 + t, None), (-d / 2, -w / 2, None)]
    bot = [bm.verts.new((x, y, 0.0)) for x, y, _ in pts]
    top = [bm.verts.new((x, y, h)) for x, y, _ in pts]
    N = len(pts)
    for i in range(N):
        j = (i + 1) % N
        f = bm.faces.new((bot[i], bot[j], top[j], top[i]))
        spine = pts[i][2] is not None and pts[j][2] is not None
        for loop in f.loops:
            if spine:
                k = pts[i][2] if loop.vert in (bot[i], top[i]) else pts[j][2]
                loop[uv].uv = (k / n, 1.0 if loop.vert in top else 0.0)
            else:
                loop[uv].uv = CORNER_UV
    for ring, flip in ((top, False), (bot, True)):
        f = bm.faces.new(list(reversed(ring)) if flip else ring)
        for loop in f.loops:
            loop[uv].uv = CORNER_UV
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


HARD = (0.0025, 0.0032, 0.003)  # board thickness, spine round, squares (boards past the pages)
SOFT = (0.0007, 0.0, 0.0004)


def book(n, spec, m_bm, section="books", faceout=False):
    """A book you can pick up: item__book_NN = slot__book__NN (cover shell, its spine painted at
    runtime), slot__cover__NN (a plane 0.3 mm proud of the front board, UV 0..1 over the cover)
    and the page block. spec = (w, h, d, "hard" | "soft", color); m_bm places the bm frame."""
    w, h, d, kind, color = spec
    t, bulge, sq = HARD if kind == "hard" else SOFT
    with item(f"book_{n:02d}", rot_only(m_bm) @ BM_TO_ITEM, section, faceout):
        shell = put(from_bm(f"book_{n:02d}", book_shell_bm(w, h, d, t, bulge), M(color), wn=False, smooth_angle=35, contract=f"slot__book__{n:02d}"), m_bm)
        shell["aspect"] = w / h
        cover = plane(f"cover_{n:02d}", d, h, mat=M(color), contract=f"slot__cover__{n:02d}")
        put(cover, m_bm @ Matrix.Translation((0, w / 2 + 0.0003, h / 2)) @ Matrix.Rotation(180 * DEG, 4, "Z"))
        cover["aspect"] = d / h
        x0, x1 = -d / 2 + sq, d / 2 - t - 0.0004
        pages = box(f"pages_{n:02d}", (x1 - x0, w - 2 * t - 0.0006, h - 2 * sq), mat="paper_warm" if n % 3 else "paper", bevel=0)
        put(pages, m_bm @ Matrix.Translation(((x0 + x1) / 2, 0, h / 2)))
    return shell


def plain_book(name, spec, m_bm, pages_mat="paper_warm"):
    """A book that isn't an item (decor, the LGS stack): same shell + pages, no slots."""
    w, h, d, kind, color = spec
    t, bulge, sq = HARD if kind == "hard" else SOFT
    put(from_bm(name, book_shell_bm(w, h, d, t, bulge, n=4 if kind == "hard" else 1), M(color), wn=False, smooth_angle=35), m_bm)
    x0, x1 = -d / 2 + sq, d / 2 - t - 0.0004
    put(box(f"{name}_pages", (x1 - x0, w - 2 * t - 0.0006, h - 2 * sq), mat=pages_mat, bevel=0), m_bm @ Matrix.Translation(((x0 + x1) / 2, 0, h / 2)))


def book_matrix(spec, center, x_item, z_item=(0, 0, 1)):
    """World matrix of a book's bm frame so that the book's middle sits at `center`, its front
    cover faces `x_item` and its head points along `z_item`."""
    h = spec[1]
    return Matrix.Translation(Vector(center)) @ basis(x_item, z_item) @ BM_TO_ITEM.inverted() @ Matrix.Translation((0, 0, -h / 2))


# ------------------------------------------------------------------ binders


def binder(n, w, h, d, color, m_bm, section="school", tab_mat=None):
    """A ring binder standing spine-out (bm frame like a book): polypropylene boards and spine with
    rounded corners, a two-ring mechanism on a steel plate, an A4 page block with dividers, a
    finger hole, and the label sleeve on the spine (slot__binder__NN, UV 0..1, printed at runtime)."""
    t, r = 0.0024, 0.0075
    outer = [(-d / 2, w / 2)] + arc(d / 2 - r, w / 2 - r, r, 90, 0, 3) + arc(d / 2 - r, -w / 2 + r, r, 0, -90, 3) + [(-d / 2, -w / 2)]
    inner = [(-d / 2, -w / 2 + t)] + arc(d / 2 - r, -w / 2 + r, r - t, -90, 0, 3) + arc(d / 2 - r, w / 2 - r, r - t, 0, 90, 3) + [(-d / 2, w / 2 - t)]
    with item(f"binder_{n:02d}", rot_only(m_bm) @ BM_TO_ITEM, section):
        put(from_bm(f"binder_{n:02d}", slab_bm(outer + inner, h), color, wn=False, smooth_angle=40), m_bm)
        # A4 pages + three dividers whose tabs reach the fore-edge
        px0, px1 = -d / 2 + 0.009, d / 2 - 0.05
        pw = w - 2 * t - 0.012
        put(box(f"binder_{n:02d}_pages", (px1 - px0, pw, 0.297), mat="paper", bevel=0.0006, seg=1), m_bm @ Matrix.Translation(((px0 + px1) / 2, 0, h / 2)))
        for k, (dy, dz) in enumerate(((-0.3, 0.06), (0.05, 0.13), (0.32, 0.2))):
            put(box(f"binder_{n:02d}_tab{k}", (0.008, 0.0012, 0.032), mat=tab_mat or color, bevel=0), m_bm @ Matrix.Translation((px0 - 0.004, dy * pw, h * 0.12 + dz)))
        # ring mechanism: a plate on the spine wall, two rings through the punched holes
        put(box(f"binder_{n:02d}_plate", (0.003, min(0.03, w - 2 * t - 0.006), 0.21), mat="steel", bevel=0.0008, seg=1),
            m_bm @ Matrix.Translation((d / 2 - t - 0.0016, 0, h / 2)))
        rr = (w - 2 * t) / 2 - 0.006
        for k, dz in enumerate((-0.04, 0.04)):
            put(torus(f"binder_{n:02d}_ring{k}", rr, 0.0017, mat="steel", seg=12, ring=4), m_bm @ Matrix.Translation((d / 2 - t - 0.004 - rr, 0, h / 2 + dz)))
        # finger hole: a steel grommet around a dark hole
        hole = m_bm @ Matrix.Translation((d / 2 + 0.0002, 0, 0.052)) @ Matrix.Rotation(90 * DEG, 4, "Y")
        put(cyl(f"binder_{n:02d}_hole", 0.0105, 0.0016, mat="ink", seg=16, bevel=0, anchor_bottom=False), hole @ Matrix.Translation((0, 0, -0.0006)))
        put(torus(f"binder_{n:02d}_grommet", 0.0118, 0.0016, mat="steel", seg=16, ring=4), hole)
        # label sleeve on the spine; the label itself is the slot
        lw, lh, lz = w - 2 * r + 0.002, 0.15, h * 0.6
        sleeve = frame(f"binder_{n:02d}_sleeve", lw + 0.004, lh + 0.004, lw, lh, 0.0009, mat=color, r=0.0, ir=0.0, seg=1, bevel=0, back=False)
        put(sleeve, m_bm @ Matrix.Translation((d / 2 + 0.0009, 0, lz)) @ Matrix.Rotation(90 * DEG, 4, "Z"))
        label = plane(f"binder_{n:02d}_label", lw, lh, mat="paper", contract=f"slot__binder__{n:02d}")
        put(label, m_bm @ Matrix.Translation((d / 2 + 0.0004, 0, lz)) @ Matrix.Rotation(90 * DEG, 4, "Z"))
        label["aspect"] = lw / lh


# ------------------------------------------------------------------ medals


# (r, z) lathe profiles for R = 35 mm, face toward +z: a domed boss, a flat field, the rim, a flat back
MEDAL_GOLD = [(0.0, 0.0029), (0.006, 0.0027), (0.0108, 0.0021), (0.0121, 0.0011), (0.0133, 0.0008), (0.0262, 0.0008), (0.0276, 0.0016),
              (0.029, 0.0025), (0.0333, 0.0026), (0.0347, 0.0018), (0.035, 0.0), (0.0347, -0.0016), (0.0335, -0.0022), (0.0, -0.0022)]
# the team medals: a smaller, flatter boss inside a sunburst (a big dome reads as a bullseye)
MEDAL_RING = [(0.0, 0.0021), (0.0045, 0.002), (0.0082, 0.0015), (0.0092, 0.0009), (0.0102, 0.0008), (0.0262, 0.0008), (0.0276, 0.0016),
              (0.029, 0.0025), (0.0333, 0.0026), (0.0347, 0.0018), (0.035, 0.0), (0.0347, -0.0016), (0.0335, -0.0022), (0.0, -0.0022)]


def face_frame(m_item):
    """Medal-local frame: x right, y up, z out of the face (= the item's +X)."""
    return m_item @ Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def _leaf_outline(length, width, n=4):
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((length * t, width / 2 * math.sin(math.pi * t) ** 0.8))
    for i in range(n - 1, 0, -1):
        t = i / n
        pts.append((length * t, -width / 2 * math.sin(math.pi * t) ** 0.8))
    return pts


def _place2d(pts, origin, angle):
    c, s = math.cos(angle), math.sin(angle)
    return [(origin[0] + x * c - y * s, origin[1] + x * s + y * c) for x, y in pts]


def star_outline(r_out, r_in, points=5):
    out = []
    for i in range(points * 2):
        a = math.pi / 2 + math.pi * i / points
        r = r_out if i % 2 == 0 else r_in
        out.append((r * math.cos(a), r * math.sin(a)))
    return out


def medal(name, m_item, metal, R=0.035, laurel=False, seg=48):
    """A medal disc in relief: domed center with a star, a laurel wreath (or a raised ring
    border), the rim; an eyelet ring on top. Its face looks along the item's +X. Returns the
    medal-local frame and the point (item space) where a ribbon's V should end."""
    f = face_frame(m_item)
    k = R / 0.035
    prof = [(r * k, z) for r, z in (MEDAL_GOLD if laurel else MEDAL_RING)]
    put(lathe(f"{name}_disc", prof, mat=metal, seg=seg, smooth_angle=34), f)
    # the star on the boss
    star = star_outline((0.0072 if laurel else 0.0058) * k, (0.003 if laurel else 0.0024) * k)
    z_star = 0.0025 if laurel else 0.0017
    put(from_bm(f"{name}_star", slab_bm(star, 0.0013, z_star), metal, bevel=0.00025, seg=1, wn=False, smooth_angle=30), f)
    if laurel:
        leaves = bmesh.new()
        rb = 0.0196 * k
        for side in (1, -1):
            for i in range(11):
                a = (-80 + 146 * i / 10) * DEG
                ang = a if side > 0 else math.pi - a
                tang = ang + math.pi / 2 * side
                tilt = (0.5 if i % 2 else -0.5) * side
                grow = 1.0 - 0.3 * i / 10  # leaves get smaller toward the top
                origin = (rb * math.cos(ang), rb * math.sin(ang))
                outline = _place2d(_leaf_outline(0.0079 * k * grow, 0.0032 * k * grow), origin, tang + tilt)
                part = slab_bm(outline, 0.0009, 0.0005)
                me_tmp = _bm_to_mesh(part)
                leaves.from_mesh(me_tmp)
                _drop_mesh(me_tmp)
        put(from_bm(f"{name}_laurel", leaves, metal, wn=False, smooth_angle=30), f)
        for side in (1, -1):  # the two stems, meeting at the bottom
            stem = torus(f"{name}_stem{side}", rb, 0.00045, mat=metal, seg=16, ring=3, arc=140)
            put(stem, f @ Matrix.Translation((0, 0, 0.0008)) @ Matrix.Rotation((-82 if side > 0 else 122) * DEG, 4, "Z"))
    else:
        rays = bmesh.new()
        for i in range(18):
            a = 2 * math.pi * i / 18
            r0, r1, w0, w1 = 0.0118 * k, 0.0238 * k, 0.0021 * k, 0.0011 * k
            c, sn = math.cos(a), math.sin(a)
            quad = [(r0 * c - w0 / 2 * -sn, r0 * sn - w0 / 2 * c), (r1 * c - w1 / 2 * -sn, r1 * sn - w1 / 2 * c),
                    (r1 * c + w1 / 2 * -sn, r1 * sn + w1 / 2 * c), (r0 * c + w0 / 2 * -sn, r0 * sn + w0 / 2 * c)]
            me_tmp = _bm_to_mesh(slab_bm(quad, 0.00085, 0.00045))
            rays.from_mesh(me_tmp)
            _drop_mesh(me_tmp)
        put(from_bm(f"{name}_rays", rays, metal, wn=False, smooth_angle=30), f)
    ring_r = 0.0042 * k
    put(torus(f"{name}_eyelet", ring_r, 0.0011, mat=metal, seg=12, ring=5), f @ Matrix.Translation((0, R + ring_r - 0.0006, 0)))
    tip = (f @ Vector((0, R + 2 * ring_r - 0.0016, 0)))
    return f, tip


def _bm_to_mesh(bm):
    import bpy

    me = bpy.data.meshes.new("_tmp")
    bm.to_mesh(me)
    bm.free()
    return me


def _drop_mesh(me):
    import bpy

    bpy.data.meshes.remove(me)


# ------------------------------------------------------------------ frames + stands


def photo_frame(name, slot, pw, ph, border, depth, mat, m_item, inner="paper", lean=12.0, mat_board=0.0):
    """A standing photo frame facing the item's +X (m_item leans it back by `lean`°): moulding, a
    recessed print (the slot plane `slot`), a closed back and a kickstand that reaches the shelf."""
    R = m_item @ Matrix.Rotation(90 * DEG, 4, "Z")  # frame()/plane() face −Y locally → item +X
    ow, oh = pw + 2 * (border + mat_board), ph + 2 * (border + mat_board)
    iw, ih = pw + 2 * mat_board - 0.003, ph + 2 * mat_board - 0.003
    put(frame(name, ow, oh, iw, ih, depth, mat=mat, r=0.0, ir=0.0, seg=1, recess=depth * 0.42, inner_mat=inner, bevel=min(0.003, border * 0.18)), R)
    pic = plane(f"{name}_pic", pw, ph, mat="#9C9488", contract=slot)
    pic["aspect"] = pw / ph
    put(pic, R @ Matrix.Translation((0, depth * 0.42 - 0.0004, 0)))
    if lean > 0:
        beta = lean + 14.0  # strut angle from the frame's back
        length = 0.68 * oh * math.cos(lean * DEG) / math.cos((beta - lean) * DEG) - 0.0012  # its back edge just reaches the shelf
        st = box(f"{name}_strut", (0.024, 0.0035, length), mat=mat, bevel=0.001, seg=1, anchor=(0, 0, 1))
        put(st, R @ Matrix.Translation((0, depth + 0.0017, oh * 0.18)) @ Matrix.Rotation(beta * DEG, 4, "X"))


def wedge_stand(name, width, lean, mat="walnut_dark", base=0.072, back_h=0.12, lip=0.016):
    """A book/plate stand: base, a slanted back at `lean` degrees and a front lip. Local frame:
    +X toward the room, the back's foot at x = 0, base from x = 0 to `base`. Returns the object and
    (x, z) of the ledge corner where a leaning thing's front-bottom edge rests."""
    t = 0.008
    c, s = math.cos(lean * DEG), math.sin(lean * DEG)
    pts = [(-t * c, 0.0), (base + t, 0.0), (base + t, lip), (base, lip), (base, t), (0.0, t),
           (-back_h * s, back_h * c), (-back_h * s - t * c, back_h * c - t * s)]
    ob = from_bm(name, prism_bm(pts, width), mat, bevel=0.0018, seg=2, smooth_angle=35)
    return ob


def lean_frame(lean_deg, yaw_deg=0.0):
    """Item rotation for something standing on the shelf, facing the room (+X) and leaning back."""
    yaw = Matrix.Rotation(yaw_deg * DEG, 4, "Z")
    c, s = math.cos(lean_deg * DEG), math.sin(lean_deg * DEG)
    return yaw @ basis((c, 0, s), (-s, 0, c))


__all__ = ["CORNER_UV", "BM_TO_ITEM", "put", "rot_only", "prism_bm", "slab_bm", "arc", "strip_bm", "taper_widths", "ribbon", "loop_over",
           "book_shell_bm", "book", "plain_book", "book_matrix", "binder", "medal", "face_frame", "star_outline", "photo_frame",
           "wedge_stand", "lean_frame"]
