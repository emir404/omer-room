"""The desk (walnut, mid-century: splayed tapered legs, brass ferrules, a hanging two-drawer unit),
the chair, and the small things on the desk that aren't clickable objects."""

import math

import bmesh
from mathutils import Matrix, Vector

from layout import CHAIR, DESK
from lib.core import DEG, group
from lib.geo import box, cyl, from_bm, jitter, lathe, rrect, sphere, thick_profile, torus, tube

TOP = DESK["top"]
X0, X1 = DESK["x"] - DESK["w"] / 2, DESK["x"] + DESK["w"] / 2
Y0, Y1 = DESK["y"] - DESK["d"] / 2, DESK["y"] + DESK["d"] / 2


def tapered_leg(name, top, foot, r_top, r_bottom, mat="walnut", ferrule=True):
    """A round tapered leg from `top` (x, y, z) to `foot` (x, y, z)."""
    a, b = Vector(top), Vector(foot)
    length = (a - b).length
    leg = cyl(name, r_bottom, length, mat=mat, r2=r_top, seg=24, bevel=0.002)
    direction = (a - b).normalized()
    leg.matrix_world = Matrix.Translation(b) @ direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    if ferrule:
        f = cyl(name + "_ferrule", r_bottom * 1.06, 0.045, mat="brass", r2=r_bottom * 1.12, seg=24, bevel=0.0012)
        f.matrix_world = Matrix.Translation(b) @ direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return leg


def desk():
    t = DESK["t"]
    rrect("desk_top", DESK["w"], DESK["d"], t, 0.018, loc=(DESK["x"], DESK["y"], TOP - t), mat="walnut", axis="Z", seg=6, bevel=0.007, anchor=(0, 0, -1))
    ax0, ax1, ay0, ay1 = X0 + 0.05, X1 - 0.05, Y0 + 0.05, Y1 - 0.04
    rail_h, rail_t = 0.07, 0.022
    zr = TOP - t - rail_h
    box("rail_back", (ax1 - ax0, rail_t, rail_h), loc=((ax0 + ax1) / 2, ay1 - rail_t / 2, zr), mat="walnut", bevel=0.003, anchor=(0, 0, -1))
    box("rail_left", (rail_t, ay1 - ay0, rail_h), loc=(ax0 + rail_t / 2, (ay0 + ay1) / 2, zr), mat="walnut", bevel=0.003, anchor=(0, 0, -1))
    box("rail_front", (0.9, rail_t, rail_h), loc=(ax0 + 0.45, ay0 + rail_t / 2, zr), mat="walnut", bevel=0.003, anchor=(0, 0, -1))
    # pencil drawer in the front rail
    box("pencil_drawer", (0.5, 0.012, rail_h - 0.014), loc=(0.46, ay0 - 0.004, zr + 0.007), mat="oak", bevel=0.003, anchor=(0, 0, -1))
    box("pencil_pull", (0.09, 0.012, 0.012), loc=(0.46, ay0 - 0.016, zr + rail_h / 2), mat="brass", bevel=0.004)
    # hanging two-drawer unit on the right
    ux1 = ax1 - 0.075
    ux0 = ux1 - 0.42
    uh = 0.27
    box("unit", (ux1 - ux0, ay1 - ay0, uh), loc=((ux0 + ux1) / 2, (ay0 + ay1) / 2, TOP - t - uh), mat="walnut", bevel=0.005, anchor=(0, 0, -1))
    for i in range(2):
        dz = TOP - t - uh + 0.012 + i * (uh - 0.012) / 2
        box(f"drawer_{i}", (ux1 - ux0 - 0.03, 0.016, (uh - 0.012) / 2 - 0.012), loc=((ux0 + ux1) / 2, ay0 - 0.006, dz), mat="oak", bevel=0.004, anchor=(0, 0, -1))
        cyl(f"knob_{i}", 0.012, 0.022, loc=((ux0 + ux1) / 2, ay0 - 0.014, dz + (uh - 0.012) / 4 - 0.006), rot=(90, 0, 0), mat="brass", seg=20, bevel=0.004)
    # legs, splayed 5° outward
    splay = math.tan(5 * DEG) * TOP
    for i, (x, y) in enumerate(((ax0 + 0.035, ay0 + 0.035), (ax0 + 0.035, ay1 - 0.035), (ax1 - 0.035, ay0 + 0.035), (ax1 - 0.035, ay1 - 0.035))):
        sx = -1 if x < DESK["x"] else 1
        sy = -1 if y < DESK["y"] else 1
        tapered_leg(f"desk_leg_{i}", (x, y, TOP - t), (x + sx * splay * 0.6, y + sy * splay * 0.6, 0.0), 0.026, 0.014)


def chair():
    cx, cy, _ = CHAIR
    yaw = -9
    m = Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(yaw * DEG, 4, "Z")

    def at(ob, loc, rot=(0, 0, 0)):
        ob.matrix_world = m @ Matrix.Translation(loc) @ (Matrix.Rotation(rot[2] * DEG, 4, "Z") @ Matrix.Rotation(rot[1] * DEG, 4, "Y") @ Matrix.Rotation(rot[0] * DEG, 4, "X"))
        return ob

    seat_z = 0.445
    at(rrect("chair_seat", 0.44, 0.42, 0.026, 0.05, mat="walnut", axis="Z", seg=6, bevel=0.006, anchor=(0, 0, -1)), (0, 0, seat_z - 0.026))
    at(rrect("chair_cushion", 0.41, 0.385, 0.05, 0.07, mat="cushion", axis="Z", seg=8, bevel=0.018, bseg=4, anchor=(0, 0, -1)), (0, 0.01, seat_z))
    # piping seam on the cushion
    # legs
    for i, (x, y) in enumerate(((-0.17, -0.16), (0.17, -0.16), (-0.17, 0.16), (0.17, 0.16))):
        top = m @ Vector((x, y, seat_z - 0.026))
        foot = m @ Vector((x * 1.18, y * 1.2, 0.0))
        tapered_leg(f"chair_leg_{i}", top, foot, 0.019, 0.012, ferrule=False)
    # stretchers
    for i, y in enumerate((-0.12, 0.12)):
        st = box(f"chair_stretcher_{i}", (0.36, 0.016, 0.016), mat="walnut", bevel=0.004)
        at(st, (0, y * 1.08, 0.16))
    # back posts + curved backrest (a slice of a cylinder)
    for i, x in enumerate((-0.185, 0.185)):
        post = box(f"chair_post_{i}", (0.026, 0.026, 0.42), mat="walnut", bevel=0.006, anchor=(0, 0, -1))
        at(post, (x, -0.185, seat_z - 0.03), rot=(8, 0, 0))
    bm = bmesh.new()
    R, arc, h, th = 0.42, 62 * DEG, 0.15, 0.018
    rings = []
    n = 24
    for k in range(n + 1):
        a = -arc / 2 + arc * k / n
        ring = []
        for (rr, zz) in ((R, 0), (R, h), (R + th, h), (R + th, 0)):
            ring.append(bm.verts.new((rr * math.sin(a), -rr * math.cos(a) + R - 0.0, zz)))
        rings.append(ring)
    for k in range(n):
        a, b = rings[k], rings[k + 1]
        for j in range(4):
            bm.faces.new((a[j], b[j], b[(j + 1) % 4], a[(j + 1) % 4]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    back = from_bm("chair_back", bm, "walnut", bevel=0.005, seg=2, smooth_angle=30)
    at(back, (0, -0.215, seat_z + 0.2), rot=(8, 0, 0))


def clutter():
    r = jitter(5)
    # coffee mug (cream glaze, terracotta band) with a handle
    mx, my = 1.2, 1.6
    lathe("mug", thick_profile([(0.036, 0.0), (0.039, 0.004), (0.04, 0.05), (0.041, 0.092)], 0.004), loc=(mx, my, TOP), mat="cream", seg=40)
    lathe("mug_band", [(0.0405, 0.0), (0.0412, 0.003), (0.0412, 0.016), (0.0405, 0.019)], loc=(mx, my, TOP + 0.034), mat="terracotta", seg=40)
    lathe("coffee", [(0.0, 0.0), (0.035, 0.0), (0.0, 0.001)], loc=(mx, my, TOP + 0.078), mat="walnut_dark", seg=24)
    torus("mug_handle", 0.022, 0.0055, loc=(mx + 0.045, my, TOP + 0.048), rot=(90, 100, 0), mat="cream", arc=200, seg=18, ring=8)
    # coaster
    cyl("coaster", 0.05, 0.004, loc=(mx, my, TOP), mat="cork", seg=32, bevel=0.0012)
    # pen cup with pencils and a ruler
    px, py = 1.12, 2.1
    lathe("pen_cup", thick_profile([(0.03, 0.0), (0.031, 0.002), (0.031, 0.1)], 0.003), loc=(px, py, TOP), mat="sage", seg=6, smooth_angle=20)
    for i in range(5):
        a = i * 1.3 + r.uniform(-0.3, 0.3)
        tilt = r.uniform(6, 14)
        col = ("mustard", "red", "navy", "mustard", "ink")[i]
        rp = 0.0035
        p0 = Vector((px + 0.012 * math.cos(a), py + 0.012 * math.sin(a), TOP + 0.005))
        d = Vector((math.cos(a) * math.sin(tilt * DEG), math.sin(a) * math.sin(tilt * DEG), math.cos(tilt * DEG)))
        L = r.uniform(0.15, 0.18)
        pen = cyl(f"pencil_{i}", rp, L, mat=col, seg=6, bevel=0.0006)
        pen.matrix_world = Matrix.Translation(p0) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        tip = cyl(f"pencil_tip_{i}", rp, 0.014, mat="birch", r2=0.0006, seg=6, bevel=0)
        tip.matrix_world = Matrix.Translation(p0 + d * L) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    # book stack (back-left corner) + a closed notebook with an elastic
    bx, by = -0.16, 2.08
    z = TOP
    for i, (w, d, h, col, rot) in enumerate(((0.24, 0.17, 0.034, "navy", 4), (0.22, 0.16, 0.026, "sage", -3), (0.2, 0.15, 0.03, "mustard", 9))):
        rrect(f"stack_book_{i}", w, d, h, 0.003, loc=(bx, by, z), rot=(0, 0, rot), mat=col, axis="Z", seg=2, bevel=0.002, anchor=(0, 0, -1))
        rrect(f"stack_pages_{i}", w - 0.012, d - 0.008, h - 0.006, 0.002, loc=(bx + 0.004, by, z + 0.003), rot=(0, 0, rot), mat="paper_warm", axis="Z", seg=2, bevel=0.0008, anchor=(0, 0, -1))
        z += h
    rrect("notebook", 0.15, 0.21, 0.014, 0.006, loc=(bx + 0.01, by - 0.005, z), rot=(0, 0, -6), mat="red", axis="Z", seg=3, bevel=0.002, anchor=(0, 0, -1))
    box("notebook_band", (0.006, 0.212, 0.0152), loc=(bx + 0.055, by - 0.005, z), rot=(0, 0, -6), mat="ink", bevel=0.0008, anchor=(0, 0, -1))
    # succulent in a tiny pot by the phone
    sx, sy = 1.24, 1.86
    lathe("succ_pot", [(0.0, 0.0), (0.03, 0.0), (0.034, 0.04), (0.036, 0.044), (0.0, 0.044)], loc=(sx, sy, TOP), mat="cream", seg=28)
    for k in range(9):
        a = k * 137.5 * DEG
        rr = 0.008 + 0.0035 * k
        lf = sphere(f"succ_leaf_{k}", 0.012, loc=(sx + rr * math.cos(a), sy + rr * math.sin(a), TOP + 0.05 + 0.002 * (8 - k)),
                    mat="leaf_light" if k % 2 else "sage", seg=10, rings=6, scale=(1.0, 0.55, 0.45))
        lf.rotation_euler = (0, -25 * DEG, a)


def build():
    with group("desk", own="decor:desk", bake="props"):
        desk()
    with group("chair", own="decor:chair", bake="props"):
        chair()
    with group("clutter", own="decor:clutter", bake="props"):
        clutter()
