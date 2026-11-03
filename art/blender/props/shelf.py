"""obj__shelf — the academic bit. A walnut bookcase on the left wall:
  row 0  books (slot__book__01..12, clickable spines) + a bookend, a lying stack and a crate
  row 1  Model UN: delegate placard, gavel, three photo frames (slot__photo__01..03)
  row 2  olympiad: trophy + five medals on ribbons (gold, 2 silver, 2 bronze) on a peg rail
  row 3  school: binders, a magazine file, papers, a keepsake box, a little cactus
  top    a trailing pothos and a woven basket
Spines face +X (into the room). Slot meshes keep their transform; their front face spans UV 0..1."""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from layout import LEFT_X
from lib.core import DEG, group, tag
from lib.geo import box, cyl, frame, from_bm, jitter, lathe, plane, rrect, sphere, text, thick_profile, torus, tube
from lib.mats import M
from lib.plants import curve_points, leaf_bm, place_bm

BX = LEFT_X  # back of the case
FX = LEFT_X + 0.34  # front edge of the case
Y0, Y1 = 0.6, 1.9
T = 0.035  # side panel thickness
ROWS = [0.1, 0.585, 1.085, 1.585, 2.09]  # floor of each row (and the top's underside)
CORNER_UV = (0.004, 0.996)
COVERS = ["#7A2E2E", "#2E4A62", "#4E6B4A", "#C9A45C", "#6B4B7A", "#B5573A", "#3D5C5C", "#8C7A5B", "#2F3A4A", "#9E3D3D", "#5A6E3A", "#C47F45"]


def case():
    box("side_front", (0.34, T, 2.12), loc=(BX + 0.17, Y0 + T / 2, 0), mat="walnut", bevel=0.006, anchor=(0, 0, -1))
    box("side_back", (0.34, T, 2.12), loc=(BX + 0.17, Y1 - T / 2, 0), mat="walnut", bevel=0.006, anchor=(0, 0, -1))
    box("top", (0.356, Y1 - Y0 + 0.024, 0.036), loc=(BX + 0.178, (Y0 + Y1) / 2, 2.09), mat="walnut", bevel=0.008, anchor=(0, 0, -1))
    inner = Y1 - Y0 - 2 * T
    box("bottom", (0.325, inner, 0.025), loc=(BX + 0.1625, (Y0 + Y1) / 2, 0.075), mat="walnut", bevel=0.003, anchor=(0, 0, -1))
    box("plinth", (0.02, inner, 0.075), loc=(FX - 0.03, (Y0 + Y1) / 2, 0), mat="walnut_dark", bevel=0.003, anchor=(0, 0, -1))
    for i, z in enumerate(ROWS[1:4]):
        box(f"board_{i}", (0.325, inner, 0.025), loc=(BX + 0.1625, (Y0 + Y1) / 2, z - 0.025), mat="walnut", bevel=0.004, anchor=(0, 0, -1))
        box(f"board_lip_{i}", (0.012, inner, 0.03), loc=(FX - 0.012, (Y0 + Y1) / 2, z - 0.03), mat="walnut", bevel=0.004, anchor=(0, 0, -1))
    box("back", (0.012, inner, 2.09 - 0.1), loc=(BX + 0.006, (Y0 + Y1) / 2, 0.1), mat="oak_light", bevel=0.0, anchor=(0, 0, -1))


def book_bm(w, h, d, bulge=0.0035, t=0.0028, n=6):
    """Hardcover: a C-shaped shell (spine + boards) extruded to height h. Spine faces +X, the
    spine's outer surface gets UV 0..1 (u along +Y, v up); everything else the corner texel."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    pts = []
    for k in range(n + 1):
        pts.append((d / 2 + bulge * math.sin(math.pi * k / n), -w / 2 + w * k / n, "spine", k))
    pts += [(-d / 2, w / 2, "c", 0), (-d / 2, w / 2 - t, "c", 0), (d / 2 - t, w / 2 - t, "c", 0)]
    for k in range(n + 1):
        pts.append((d / 2 - t + bulge * 0.6 * math.sin(math.pi * (n - k) / n), w / 2 - t - (w - 2 * t) * k / n, "c", 0))
    pts += [(-d / 2, -w / 2 + t, "c", 0), (-d / 2, -w / 2, "c", 0)]
    bot = [bm.verts.new((x, y, 0.0)) for x, y, _, _ in pts]
    top = [bm.verts.new((x, y, h)) for x, y, _, _ in pts]
    N = len(pts)
    for i in range(N):
        j = (i + 1) % N
        f = bm.faces.new((bot[i], bot[j], top[j], top[i]))
        spine = pts[i][2] == "spine" and pts[j][2] == "spine"
        for loop in f.loops:
            if spine:
                k = pts[i][3] if loop.vert in (bot[i], top[i]) else pts[j][3]
                loop[uv].uv = (k / n, 1.0 if loop.vert in top else 0.0)
            else:
                loop[uv].uv = CORNER_UV
    for ring, flip in ((top, False), (bot, True)):
        f = bm.faces.new(list(reversed(ring)) if flip else ring)
        for loop in f.loops:
            loop[uv].uv = CORNER_UV
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def books():
    r = jitter(21)
    y = Y0 + T + 0.012
    z = ROWS[0]
    pages = []
    for i in range(12):
        w = r.choice((0.028, 0.032, 0.036, 0.04, 0.045, 0.05, 0.055))
        h = r.uniform(0.24, 0.335)
        d = r.uniform(0.165, 0.215)
        x = FX - 0.012 - d / 2
        ob = from_bm(f"book_{i + 1:02d}", book_bm(w, h, d), M(COVERS[i % len(COVERS)]), loc=(x, y + w / 2, z), wn=False, smooth_angle=35,
                     contract=f"slot__book__{i + 1:02d}")
        ob["aspect"] = w / h
        pages.append((x, y + w / 2, z, w, h, d))
        y += w + 0.003
    # page blocks (one mesh)
    bm = bmesh.new()
    for x, yy, zz, w, h, d in pages:
        t = 0.0028
        b = bmesh.ops.create_cube(bm, size=1.0)
        vs = b["verts"]
        bmesh.ops.scale(bm, vec=(d - t - 0.003, w - 2 * t - 0.0008, h - 0.008), verts=vs)
        bmesh.ops.translate(bm, vec=(x - 0.0015 - t / 2, yy, zz + h / 2), verts=vs)
    from_bm("book_pages", bm, "paper_warm", bevel=0.0008, seg=1, wn=False)
    # bookend
    box("bookend_upright", (0.11, 0.0035, 0.16), loc=(FX - 0.075, y + 0.004, z), mat="brass", bevel=0.0012, anchor=(0, 0, -1))
    box("bookend_foot", (0.11, 0.07, 0.0025), loc=(FX - 0.075, y - 0.032, z), mat="brass", bevel=0.0008, anchor=(0, 0, -1))
    # lying stack
    zz = z
    for k, (w, d, h, col) in enumerate(((0.23, 0.17, 0.035, "#2E4A62"), (0.21, 0.16, 0.028, "#C9A45C"), (0.2, 0.15, 0.032, "#7A2E2E"))):
        rrect(f"lying_{k}", d, w, h, 0.002, loc=(FX - 0.02 - d / 2, y + 0.16, zz), rot=(0, 0, 4 - k * 5), mat=col, axis="Z", seg=2, bevel=0.0015, anchor=(0, 0, -1))
        rrect(f"lying_pages_{k}", d - 0.008, w - 0.012, h - 0.006, 0.001, loc=(FX - 0.024 - d / 2, y + 0.16, zz + 0.003), rot=(0, 0, 4 - k * 5), mat="paper_warm", axis="Z", seg=2, bevel=0.0006, anchor=(0, 0, -1))
        zz += h
    # wooden crate with rolled papers
    cy = Y1 - T - 0.14
    frame("crate", 0.22, 0.24, 0.2, 0.22, 0.2, loc=(FX - 0.13, cy, z + 0.2), rot=(-90, 0, 0), mat="oak", r=0.0, ir=0.0, seg=1, back=True, recess=0.19, inner_mat="oak", bevel=0.003)
    for k in range(4):
        cyl(f"roll_{k}", 0.018, 0.26, loc=(FX - 0.17 + (k % 2) * 0.05, cy - 0.04 + k * 0.025, z + 0.02), rot=(0, 12 - k * 6, 0), mat="paper", seg=16, bevel=0.002)


def mun_row():
    z = ROWS[1]
    # delegate placard: a folded tent card
    py = Y0 + T + 0.14
    xc = FX - 0.085
    for k, (dx, ang) in enumerate(((0.047, -28), (-0.047, 28))):
        b = box(f"placard_{k}", (0.0016, 0.24, 0.1), mat="paper", bevel=0.0004, seg=1, anchor=(0, 0, -1))
        b.matrix_world = Matrix.Translation((xc + dx, py, z)) @ Matrix.Rotation(ang * DEG, 4, "Y")
    tilt = Matrix.Rotation(62 * DEG, 4, "Y") @ Matrix.Rotation(90 * DEG, 4, "Z")
    normal = Vector((math.cos(28 * DEG), 0, math.sin(28 * DEG)))
    up = Vector((-math.sin(28 * DEG), 0, math.cos(28 * DEG)))
    center = Vector((xc + 0.0235, py, z + 0.044)) + normal * 0.0014
    t1 = text("placard_text", "MUNDP", 0.028, mat="navy", extrude=0.0004, spacing=1.08)
    t1.matrix_world = Matrix.Translation(center + up * 0.012) @ tilt
    t2 = text("placard_sub", "DEPUTY SECRETARY-GENERAL", 0.0078, mat="red", extrude=0.0003)
    t2.matrix_world = Matrix.Translation(center - up * 0.016) @ tilt
    # gavel + sound block
    gy = py + 0.2
    cyl("sound_block", 0.04, 0.018, loc=(FX - 0.13, gy - 0.02, z), mat="walnut_dark", seg=32, bevel=0.003)
    hc = Vector((FX - 0.1, gy + 0.05, z + 0.022))
    head = cyl("gavel_head", 0.022, 0.085, mat="walnut", seg=28, bevel=0.004, anchor_bottom=False)
    head.matrix_world = Matrix.Translation(hc) @ Matrix.Rotation(90 * DEG, 4, "Y")
    for sgn in (-1, 1):
        band = cyl(f"gavel_band_{sgn}", 0.0226, 0.008, mat="brass", seg=28, bevel=0.0015, anchor_bottom=False)
        band.matrix_world = Matrix.Translation(hc + Vector((sgn * 0.028, 0, 0))) @ Matrix.Rotation(90 * DEG, 4, "Y")
    handle = cyl("gavel_handle", 0.0062, 0.2, mat="walnut", seg=16, r2=0.0075, bevel=0.002)
    handle.matrix_world = Matrix.Translation(hc) @ Matrix.Rotation(8 * DEG, 4, "Z") @ Matrix.Rotation((-90 + 4.3) * DEG, 4, "X")
    # three photo frames on the right
    frame_mats = ("walnut_dark", "ink", "oak")
    for i in range(3):
        fy = Y0 + 0.62 + i * 0.205
        lean = -11 + i * 3
        fw, fh, pw, ph = 0.22, 0.175, 0.19, 0.1425
        R = Matrix.Rotation(90 * DEG, 4, "Z") @ Matrix.Rotation(lean * DEG, 4, "X")
        base = Vector((FX - 0.1, fy, z + fh / 2 * math.cos(lean * DEG) + 0.002))
        fr = frame(f"photo_frame_{i}", fw, fh, pw + 0.004, ph + 0.004, 0.016, mat=frame_mats[i], r=0.0, ir=0.0, seg=1, recess=0.006,
                   inner_mat="paper", bevel=0.0025)
        fr.matrix_world = Matrix.Translation(base) @ R
        ph_ob = plane(f"photo_{i + 1:02d}", pw, ph, mat="#9C9488", contract=f"slot__photo__{i + 1:02d}")
        ph_ob.matrix_world = Matrix.Translation(base + R @ Vector((0, 0.0052, 0))) @ R
        ph_ob["aspect"] = pw / ph
        # kickstand
        st = box(f"photo_stand_{i}", (0.03, 0.004, 0.12), mat=frame_mats[i], bevel=0.001, anchor=(0, 0, -1))
        st.matrix_world = Matrix.Translation(base + R @ Vector((0, 0.03, -0.07))) @ R @ Matrix.Rotation(-22 * DEG, 4, "X")


def olympiad_row():
    z = ROWS[2]
    tx, ty = FX - 0.15, Y0 + T + 0.16
    box("trophy_base", (0.12, 0.12, 0.05), loc=(tx, ty, z), mat="walnut_dark", bevel=0.004, anchor=(0, 0, -1))
    box("trophy_base2", (0.09, 0.09, 0.03), loc=(tx, ty, z + 0.05), mat="walnut", bevel=0.003, anchor=(0, 0, -1))
    box("trophy_plaque", (0.003, 0.07, 0.026), loc=(tx + 0.0605, ty, z + 0.012), mat="brass", bevel=0.0008, anchor=(0, 0, -1))
    cup = [(0.0, 0.0), (0.036, 0.0), (0.038, 0.006), (0.022, 0.014), (0.009, 0.024), (0.008, 0.07), (0.016, 0.078), (0.016, 0.084), (0.009, 0.09),
           (0.014, 0.1), (0.034, 0.118), (0.05, 0.15), (0.058, 0.188), (0.062, 0.2), (0.057, 0.2), (0.052, 0.19), (0.044, 0.155), (0.0, 0.135)]
    lathe("trophy_cup", cup, loc=(tx, ty, z + 0.08), mat="gold", seg=56)
    for sgn in (-1, 1):
        z0 = z + 0.08
        tube(f"trophy_handle_{sgn}", [(tx, ty + sgn * 0.05, z0 + 0.178), (tx, ty + sgn * 0.08, z0 + 0.172), (tx, ty + sgn * 0.088, z0 + 0.145),
                                      (tx, ty + sgn * 0.072, z0 + 0.118), (tx, ty + sgn * 0.04, z0 + 0.112)], 0.0052, mat="gold", res=8, bevel_res=3)
    # peg rail + medals on ribbons
    rail_z = ROWS[3] - 0.07
    ry0, ry1 = Y0 + 0.4, Y1 - T - 0.04
    box("peg_rail", (0.022, ry1 - ry0, 0.03), loc=(BX + 0.023, (ry0 + ry1) / 2, rail_z), mat="walnut", bevel=0.004, anchor=(0, 0, -1))
    medals = [("gold", "red"), ("silver", "navy"), ("silver", "navy"), ("bronze", "teal"), ("bronze", "teal")]
    n = len(medals)
    for i, (metal, ribbon) in enumerate(medals):
        py = ry0 + 0.07 + i * (ry1 - ry0 - 0.14) / (n - 1)
        peg_x = BX + 0.034
        cyl(f"peg_{i}", 0.005, 0.026, loc=(peg_x, py, rail_z + 0.015), rot=(0, 90, 0), mat="brass", seg=12, bevel=0.0012)
        drop = 0.15 + (0.012 if i % 2 else 0)
        mz = rail_z + 0.015 - drop
        mx = peg_x + 0.02 + 0.004 * (i % 2)
        bm = bmesh.new()
        for sgn in (-1, 1):
            quad = [(peg_x + 0.012, py + sgn * 0.004, rail_z + 0.03), (peg_x + 0.012, py + sgn * 0.026, rail_z + 0.03),
                    (mx, py + sgn * 0.01, mz + 0.046), (mx, py + sgn * 0.0005, mz + 0.046)]
            vs = [bm.verts.new(q) for q in quad]
            bm.faces.new(vs if sgn > 0 else list(reversed(vs)))
        rib = from_bm(f"ribbon_{i}", bm, ribbon, wn=False, smooth_angle=None)
        sol = rib.modifiers.new("t", "SOLIDIFY")
        sol.thickness = 0.0016
        torus(f"medal_ring_{i}", 0.006, 0.0014, loc=(mx, py, mz + 0.042), rot=(0, 90, 0), mat=metal, seg=16, ring=6)
        disc = lathe(f"medal_{i}", [(0.0, -0.003), (0.034, -0.003), (0.036, -0.0015), (0.036, 0.0015), (0.034, 0.003), (0.03, 0.003), (0.029, 0.0022),
                                    (0.02, 0.0022), (0.018, 0.0034), (0.0, 0.0036)], mat=metal, seg=48)
        disc.matrix_world = Matrix.Translation((mx + 0.003, py, mz)) @ Matrix.Rotation(90 * DEG, 4, "Y")


def school_row():
    z = ROWS[3]
    y = Y0 + T + 0.01
    for i, col in enumerate(("navy", "red", "sage", "mustard", "cream")):
        w = 0.058
        box(f"binder_{i}", (0.27, w, 0.31), loc=(FX - 0.02 - 0.135, y + w / 2, z), mat=col, bevel=0.004, anchor=(0, 0, -1))
        box(f"binder_label_{i}", (0.002, 0.036, 0.1), loc=(FX - 0.019, y + w / 2, z + 0.17), mat="paper", bevel=0.0005, seg=1, anchor=(0, 0, -1))
        torus(f"binder_hole_{i}", 0.009, 0.0022, loc=(FX - 0.019, y + w / 2, z + 0.07), rot=(0, 90, 0), mat="ink", seg=20, ring=6)
        y += w + 0.002
    # magazine file with papers
    my = y + 0.06
    bm = bmesh.new()
    prof = [(0.0, 0.0), (0.24, 0.0), (0.24, 0.12), (0.12, 0.29), (0.0, 0.29)]
    for side in (-1, 1):
        vs = [bm.verts.new((FX - 0.03 - px, my + side * 0.045, z + pz)) for px, pz in prof]
        bm.faces.new(vs)
    file_ob = from_bm("mag_file", bm, "#B8966A", wn=False, smooth_angle=None)
    sol = file_ob.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.003
    box("mag_file_bottom", (0.24, 0.09, 0.004), loc=(FX - 0.15, my, z), mat="#B8966A", bevel=0.0008, anchor=(0, 0, -1))
    box("mag_file_back", (0.004, 0.09, 0.29), loc=(FX - 0.272, my, z), mat="#B8966A", bevel=0.0008, anchor=(0, 0, -1))
    for k in range(3):
        box(f"mag_{k}", (0.22, 0.012, 0.25 - k * 0.02), loc=(FX - 0.15, my - 0.026 + k * 0.026, z + 0.004), rot=(0, 0, k - 1), mat=("paper", "#E8D7B0", "#D9E3E8")[k], bevel=0.001, anchor=(0, 0, -1))
    # paper stack
    sy = my + 0.2
    for k in range(4):
        box(f"paper_{k}", (0.21, 0.297, 0.012), loc=(FX - 0.14, sy, z + k * 0.012), rot=(0, 0, (k % 3 - 1) * 1.5), mat="paper" if k % 2 else "paper_warm", bevel=0.0015, anchor=(0, 0, -1))
    # keepsake box
    ky = Y1 - T - 0.2
    box("keep_box", (0.18, 0.16, 0.1), loc=(FX - 0.12, ky, z), mat="oak", bevel=0.004, anchor=(0, 0, -1))
    box("keep_lid", (0.186, 0.166, 0.022), loc=(FX - 0.12, ky, z + 0.1), mat="walnut", bevel=0.004, anchor=(0, 0, -1))
    # little cactus
    cx, cy = FX - 0.1, Y1 - T - 0.06
    lathe("shelf_pot", [(0.0, 0.0), (0.03, 0.0), (0.035, 0.05), (0.0, 0.05)], loc=(cx, cy, z), mat="cream", seg=28)
    body = lathe("shelf_cactus", [(0.0, 0.0), (0.022, 0.004), (0.026, 0.04), (0.02, 0.075), (0.0, 0.085)], loc=(cx, cy, z + 0.048), mat="leaf", seg=16, smooth_angle=None)
    for v in body.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        k = 0.85 + 0.15 * abs(math.cos(a * 5))
        v.co.x *= k
        v.co.y *= k


def top_things():
    z = 2.126
    # woven basket
    lathe("basket", thick_profile([(0.08, 0.0), (0.086, 0.01), (0.092, 0.1)], 0.005), loc=(FX - 0.17, Y0 + 0.24, z), mat="#C9A36B", seg=40)
    for k in range(5):
        lathe(f"basket_band_{k}", [(0.0865 + k * 0.0012, 0.0), (0.0885 + k * 0.0012, 0.005), (0.0865 + k * 0.0012, 0.01)], loc=(FX - 0.17, Y0 + 0.24, z + 0.015 + k * 0.018),
              mat="#A9824E", seg=40)
    # pothos
    px, py = FX - 0.12, Y1 - 0.2
    lathe("pothos_pot", thick_profile([(0.06, 0.0), (0.066, 0.006), (0.07, 0.1), (0.075, 0.11)], 0.006), loc=(px, py, z), mat="terracotta", seg=40)
    lathe("pothos_soil", [(0.0, 0.0), (0.066, 0.0), (0.0, 0.003)], loc=(px, py, z + 0.092), mat="soil", seg=24)
    r = jitter(9)
    leaves_light, leaves_dark = [], []
    vines = [
        [(px, py, z + 0.1), (px + 0.08, py - 0.02, z + 0.12), (FX + 0.03, py - 0.05, z + 0.04), (FX + 0.05, py - 0.08, z - 0.25), (FX + 0.04, py - 0.1, z - 0.48)],
        [(px, py, z + 0.1), (px + 0.06, py + 0.05, z + 0.12), (FX + 0.02, py + 0.07, z + 0.02), (FX + 0.035, py + 0.09, z - 0.18), (FX + 0.03, py + 0.1, z - 0.34)],
        [(px, py, z + 0.1), (px - 0.02, py - 0.09, z + 0.13), (FX - 0.02, py - 0.2, z + 0.06), (FX + 0.03, py - 0.27, z - 0.12), (FX + 0.03, py - 0.32, z - 0.3), (FX + 0.02, py - 0.33, z - 0.62)],
        [(px, py, z + 0.1), (px + 0.02, py + 0.02, z + 0.18), (px + 0.05, py + 0.03, z + 0.22)],
        [(px, py, z + 0.1), (px - 0.04, py + 0.04, z + 0.16), (px - 0.06, py + 0.07, z + 0.2)],
    ]
    for vi, pts in enumerate(vines):
        tube(f"pothos_vine_{vi}", pts, 0.0022, mat="stem", res=10, bevel_res=2)
        samples = curve_points(pts, n=14 if vi < 3 else 5)
        for k, (pos, tan) in enumerate(samples[1:]):
            side = 1 if k % 2 else -1
            size = r.uniform(0.04, 0.062) * (0.75 if vi >= 3 else 1)
            out = tan.cross(Vector((0, 0, 1)))
            if out.length < 1e-4:
                out = Vector((1, 0, 0))
            out.normalize()
            direction = (out * side * 0.9 + Vector((0.6, 0, 0.25)) + Vector((r.uniform(-0.2, 0.2), r.uniform(-0.2, 0.2), r.uniform(-0.1, 0.3)))).normalized()
            lb = leaf_bm(size, size * 0.8, "heart", droop=0.2, cup=0.25, nt=6, ns=4)
            place_bm(lb, pos, direction, roll=r.uniform(-0.6, 0.6))
            (leaves_light if r.random() < 0.4 else leaves_dark).append(lb)
    for name, lst, mat in (("pothos_leaves_a", leaves_light, "leaf_light"), ("pothos_leaves_b", leaves_dark, "leaf")):
        if not lst:
            continue
        out = bmesh.new()
        for lb in lst:
            me = bpy.data.meshes.new("_l")
            lb.to_mesh(me)
            lb.free()
            out.from_mesh(me)
            bpy.data.meshes.remove(me)
        ob = from_bm(name, out, mat, wn=False, smooth_angle=None)
        sol = ob.modifiers.new("t", "SOLIDIFY")
        sol.thickness = 0.0012


def build():
    with group("shelf", own="shelf", bake="props"):
        case()
        books()
        mun_row()
        olympiad_row()
        school_row()
        top_things()
