"""obj__shelf — the library. One walnut bookcase on the left wall, two bays around a center divider,
a closed cabinet below (four shaker doors, brass knobs, a recessed plinth) and open shelves above.

  left bay (the academics)                         right bay (books)
  1.7–2.075  school    binders, research paper,    1.7–2.075  books 01–08
                       certificate, LGS stack
  1.3–1.675  olympiad  gold medal on an easel,     1.3–1.675  books 09–16
                       four medals on a rail, cup
  0.9–1.275  mun       placard, gavel, lanyard,    0.9–1.275  books 17–24
                       three photo frames
  0.1–0.875  cabinet                               0.1–0.875  cabinet

Everything you can pick up is an item (lib.core.item → item__<id>, see build_room): closed on every
side, oriented +X out of its face. Section plates (slot__label__NN, extras.section) sit on the front
lips; anchor__section_<id> (extras w, h) marks the middle of each section's opening for the camera.
The case faces +X (into the room). Slot planes span UV 0..1 over their front face."""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from layout import LEFT_X, SHELF_SPAN
from lib.core import DEG, basis, empty, group, item, tag
from lib.geo import box, cyl, frame, from_bm, jitter, lathe, plane, rrect, sphere, text, thick_profile, torus, tube
from lib.plants import curve_points, leaf_bm, place_bm
from lib.shelf_kit import (binder, book, book_matrix, lean_frame, loop_over, medal, photo_frame, plain_book, prism_bm, put, ribbon, rot_only,
                           slab_bm, strip_bm, wedge_stand)

# ------------------------------------------------------------------ the case
BX = LEFT_X  # the wall, the case's back
DEPTH = 0.34
FX = BX + DEPTH  # front of the side panels
FB = FX - 0.004  # front of the boards, lips and doors (a 4 mm reveal)
Y0, Y1 = SHELF_SPAN
YM = (Y0 + Y1) / 2  # the center divider
T, TD, TB = 0.03, 0.024, 0.025  # sides, divider, boards
BACK_T = 0.012
BACK = BX + BACK_T  # the painted back panel's front face
LIP = 0.04  # boards read 40 mm thick from the room
BOARDS = (0.9, 1.3, 1.7)  # top faces of the open shelves (0.9 is the cabinet's top)
TOP_Z = 2.075  # underside of the top
PLINTH = 0.1
BAYS = {"left": (Y0 + T, YM - TD / 2), "right": (YM + TD / 2, Y1 - T)}
OPENINGS = [(BOARDS[0], BOARDS[1] - TB), (BOARDS[1], BOARDS[2] - TB), (BOARDS[2], TOP_Z)]  # (floor, ceiling)
SECTIONS = {  # id: (bay, opening indices)
    "school": ("left", (2,)),
    "olympiad": ("left", (1,)),
    "mun": ("left", (0,)),
    "books": ("right", (0, 1, 2)),
}
FRONT = Vector((1, 0, 0))


def mw(loc=(0, 0, 0), rot=None):
    m = Matrix.Translation(Vector(loc))
    return m @ rot if rot is not None else m


def case():
    H = TOP_Z
    for name, yc in (("side_l", Y0 + T / 2), ("side_r", Y1 - T / 2)):
        box(name, (DEPTH, T, H), loc=(BX + DEPTH / 2, yc, 0), mat="walnut", bevel=0.005, anchor=(0, 0, -1))
    box("top", (DEPTH + 0.016, Y1 - Y0 + 0.03, 0.04), loc=(BX + (DEPTH + 0.016) / 2, YM, H), mat="walnut", bevel=0.008, anchor=(0, 0, -1))
    box("divider", (FX - 0.002 - BACK, TD, H - 0.075), loc=((FX - 0.002 + BACK) / 2, YM, 0.075), mat="walnut", bevel=0.004, anchor=(0, 0, -1))
    box("back", (BACK_T, Y1 - Y0 - 2 * T + 0.004, H - BOARDS[0] + LIP), loc=(BX + BACK_T / 2, YM, BOARDS[0] - LIP), mat="case_back", bevel=0, anchor=(0, 0, -1))
    for bay, (ya, yb) in BAYS.items():
        w = yb - ya
        # shelves with a deep front lip (one L-shaped profile), and an apron under the top
        for k, z in enumerate(BOARDS):
            prof = [(BACK, z - TB), (FB - 0.022, z - TB), (FB - 0.022, z - LIP), (FB, z - LIP), (FB, z), (BACK, z)]
            put(from_bm(f"board_{bay}_{k}", prism_bm(prof, w), "walnut", bevel=0.0028, seg=2, smooth_angle=35), mw((0, (ya + yb) / 2, 0)))
        box(f"apron_{bay}", (0.022, w, LIP), loc=(FB - 0.011, (ya + yb) / 2, H - LIP), mat="walnut", bevel=0.0028, anchor=(0, 0, -1))
        # the cabinet: bottom rail, recessed plinth, a pair of shaker doors with brass knobs
        box(f"rail_{bay}", (0.022, w, 0.025), loc=(FB - 0.011, (ya + yb) / 2, PLINTH - 0.025), mat="walnut", bevel=0.0025, anchor=(0, 0, -1))
        box(f"plinth_{bay}", (0.02, w, PLINTH - 0.025), loc=(FB - 0.026, (ya + yb) / 2, 0), mat="walnut_dark", bevel=0.002, anchor=(0, 0, -1))
        gap = 0.0025
        dz0, dz1 = PLINTH + gap, BOARDS[0] - LIP - gap
        dw = (w - 3 * gap) / 2
        for j in range(2):
            yc = ya + gap + dw / 2 + j * (dw + gap)
            door = frame(f"door_{bay}_{j}", dw, dz1 - dz0, dw - 0.11, dz1 - dz0 - 0.12, 0.02, mat="walnut", r=0.0, ir=0.0, seg=1, recess=0.007,
                         inner_mat="walnut", bevel=0.0025)
            put(door, mw((FB, yc, (dz0 + dz1) / 2), Matrix.Rotation(90 * DEG, 4, "Z")))
            ky = yc + (dw / 2 - 0.034) * (1 if j == 0 else -1)
            knob = lathe(f"knob_{bay}_{j}", [(0.0, 0.0), (0.0075, 0.0), (0.0062, 0.006), (0.0048, 0.012), (0.0098, 0.0175), (0.0112, 0.022),
                                            (0.0102, 0.0262), (0.006, 0.0285), (0.0, 0.029)], mat="brass", seg=14, smooth_angle=40)
            put(knob, mw((FB, ky, dz1 - 0.075), Matrix.Rotation(90 * DEG, 4, "Y")))


def plates():
    """Brass card holders on the front lips; the cards are the slots (the runtime prints the names)."""
    for n, (sid, (bay, opens)) in enumerate(SECTIONS.items(), start=1):
        ya, yb = BAYS[bay]
        z = OPENINGS[max(opens)][0]  # the books plate sits under its first (top) opening
        yc, zc = (ya + yb) / 2, z - LIP / 2
        R = Matrix.Rotation(90 * DEG, 4, "Z")
        put(frame(f"plate_{sid}", 0.118, 0.03, 0.104, 0.019, 0.0022, mat="brass", r=0.0024, ir=0.0008, seg=2, recess=0.0012, inner_mat="brass",
                  bevel=0.0006), mw((FB + 0.0022, yc, zc), R))
        for s in (-1, 1):
            cyl(f"plate_{sid}_screw{s}", 0.0021, 0.0012, loc=(FB + 0.0021, yc + s * 0.0545, zc), rot=(0, 90, 0), mat="brass", seg=10, bevel=0.0005)
        card = plane(f"plate_{sid}_card", 0.106, 0.02, mat="paper", contract=f"slot__label__{n:02d}")
        put(card, mw((FB + 0.0012, yc, zc), R))
        card["aspect"] = 0.106 / 0.02
        card["section"] = sid


def anchors():
    for sid, (bay, opens) in SECTIONS.items():
        ya, yb = BAYS[bay]
        z0, z1 = OPENINGS[min(opens)][0], OPENINGS[max(opens)][1]
        a = empty(f"section_{sid}", (FX, (ya + yb) / 2, (z0 + z1) / 2), size=0.1)
        tag(a, contract=f"anchor__section_{sid}", own="shelf", w=round(yb - ya, 4), h=round(z1 - z0, 4))


# ------------------------------------------------------------------ school (left bay, top)


def school():
    z = BOARDS[2]
    ya, yb = BAYS["left"]
    # three ring binders, spine-out
    y = ya + 0.004
    for n, (w, col) in enumerate(((0.072, "navy"), (0.058, "red"), (0.066, "mustard")), start=1):
        binder(n, w, 0.318, 0.29, col, mw((FB - 0.008 - 0.145, y + w / 2, z)))
        y += w + 0.0015
    research_paper(y + 0.009, z)
    certificate(yb - 0.006, z)
    lgs_stack(yb - 0.02, z)


def research_paper(y_left, z):
    """A4, ~30 pages, plastic comb binding on the left, leaning on the back panel; its title page
    (slot__page__01) faces the room."""
    lean = 11
    pw, ph = 0.21, 0.297
    thick = 0.0042
    c, s = math.cos(lean * DEG), math.sin(lean * DEG)
    X, Z = Vector((c, 0, s)), Vector((-s, 0, c))
    Y = Z.cross(X)
    # the back face's top edge touches the panel; the comb sticks out 6 mm behind
    bottom_back = Vector((BACK + 0.008 + ph * s, y_left + pw / 2 + 0.012, z))
    center = bottom_back + X * (thick / 2) + Z * (ph / 2)
    F = Matrix.Translation(center) @ basis(X, Z)
    with item("paper_research", F, "school"):
        put(box("paper_block", (thick - 0.0008, pw, ph), mat="paper", bevel=0.0006, seg=1), F @ Matrix.Translation((0.0004, 0, 0)))
        put(box("paper_backcard", (0.0007, pw, ph), mat="navy", bevel=0.0002, seg=1), F @ Matrix.Translation((-thick / 2 + 0.00035, 0, 0)))
        comb = cyl("paper_comb", 0.0052, ph - 0.004, mat="navy", seg=10, bevel=0.001, anchor_bottom=False)
        put(comb, F @ Matrix.Translation((-0.0006, -pw / 2 + 0.003, 0)))
        # the comb's curled fingers, through the punched holes
        for k in range(17):
            zf = -ph / 2 + 0.012 + (ph - 0.024) * k / 16
            finger = torus(f"paper_finger_{k}", 0.0056, 0.0013, mat="navy", seg=7, ring=3, arc=290)
            put(finger, F @ Matrix.Translation((-0.0006, -pw / 2 + 0.003, zf)) @ Matrix.Rotation(-35 * DEG, 4, "Z"))
        page = plane("paper_title", pw - 0.012, ph - 0.002, mat="paper", contract="slot__page__01")
        put(page, F @ Matrix.Translation((thick / 2 + 0.0003, 0.005, 0)) @ Matrix.Rotation(90 * DEG, 4, "Z"))
        page["aspect"] = (pw - 0.012) / (ph - 0.002)


def certificate(y_right, z):
    """A4 landscape in a slim black frame with a gold fillet, on a brass display easel; it sits high
    enough to clear the LGS stack in front of it."""
    lean = 13
    pw, ph = 0.297, 0.21
    border, depth = 0.016, 0.014
    ow, oh = pw + 2 * border - 0.004, ph + 2 * border - 0.004
    yc = y_right - ow / 2
    ledge = 0.094  # height of the easel's ledge above the shelf (just over the LGS stack)
    c, s = math.cos(lean * DEG), math.sin(lean * DEG)
    X, Z = Vector((c, 0, s)), Vector((-s, 0, c))
    foot = Vector((BACK + 0.112, yc, z))  # where the easel's front legs meet the shelf
    leg_at = lambda h: foot + Vector((-h * s / c, 0, h))  # noqa: E731  point on the front legs' plane at height h
    rest = leg_at(ledge + 0.0036) + X * 0.0028  # the frame's back-bottom edge on the ledge, against the legs
    center = rest + X * (depth / 2) + Z * (oh / 2)
    F = Matrix.Translation(center) @ basis(X, Z)
    with item("certificate", F, "school"):
        R = F @ Matrix.Rotation(90 * DEG, 4, "Z") @ Matrix.Translation((0, -depth / 2, 0))
        put(frame("cert_frame", ow, oh, pw + 0.002, ph + 0.002, depth, mat="ink", r=0.0, ir=0.0, seg=1, recess=0.006, inner_mat="paper", bevel=0.0018), R)
        put(frame("cert_fillet", pw + 0.002, ph + 0.002, pw - 0.005, ph - 0.005, 0.0016, mat="gold", r=0.0, ir=0.0, seg=1, bevel=0.0004, back=False),
            R @ Matrix.Translation((0, 0.0015, 0)))
        pic = plane("cert_pic", pw, ph, mat="paper_warm", contract="slot__photo__04")
        pic["aspect"] = pw / ph
        put(pic, R @ Matrix.Translation((0, 0.0056, 0)))
    # the easel (decor): two front legs, a ledge with a lip, a top bar, a back leg
    apex_h = 0.262
    for sgn in (-1, 1):
        a = foot + Vector((0, sgn * 0.062, 0))
        b = leg_at(apex_h) + Vector((0, sgn * 0.014, 0))
        tube(f"easel_leg{sgn}", [a, b], 0.0026, mat="brass", kind="POLY", res=1, bevel_res=1)
    l0, l1 = leg_at(ledge), leg_at(ledge)
    tube("easel_ledge", [l0 + Vector((0.003, -0.07, 0)), l1 + Vector((0.003, 0.07, 0))], 0.0035, mat="brass", kind="POLY", res=1, bevel_res=1)
    tube("easel_lip", [l0 + Vector((0.012, -0.065, 0.004)), l1 + Vector((0.012, 0.065, 0.004))], 0.0018, mat="brass", kind="POLY", res=1, bevel_res=1)
    top = leg_at(apex_h)
    tube("easel_back", [top + Vector((-0.004, 0, 0)), Vector((BACK + 0.012, yc, z))], 0.0024, mat="brass", kind="POLY", res=1, bevel_res=1)
    for sgn in (-1, 1):
        cyl(f"easel_foot{sgn}", 0.0042, 0.003, loc=foot + Vector((0, sgn * 0.062, 0)), mat="brass", seg=10, bevel=0.0008)


LGS_COLORS = ("#C63D2F", "#2F6DB0", "#3E9150", "#E98A24", "#7550A0", "#E6B83A")


def lgs_stack(y_right, z):
    """My LGS Buddy: six exam-prep paperbacks, tied crosswise with twine, a kraft tag on the front."""
    L, Wd = 0.272, 0.192  # page size (lying: L along Y, Wd along X)
    thick = (0.017, 0.013, 0.016, 0.012, 0.015, 0.013)
    yc = y_right - L / 2 - 0.004
    xc = FB - 0.01 - Wd / 2
    r = jitter(5)
    height = sum(thick)
    F = Matrix.Translation((xc, yc, z + height / 2))
    with item("books_lgs", F, "school"):
        zz = z
        for k, (t, col) in enumerate(zip(thick, LGS_COLORS)):
            spec = (t, L, Wd, "soft", col)
            yaw = r.uniform(-1.6, 1.6) * DEG
            m = book_matrix(spec, (xc + r.uniform(-0.003, 0.003), yc + r.uniform(-0.004, 0.004), zz + t / 2), (0, 0, 1), Matrix.Rotation(yaw, 3, "Z") @ Vector((0, -1, 0)))
            plain_book(f"lgs_{k}", spec, m, pages_mat="paper")
            zz += t
        top = z + height
        sink = 0.0012
        corner = 0.006
        rt = 0.0013

        def loop(points):
            tube("lgs_twine", points, rt, mat="twine", kind="POLY", res=1, bevel_res=1, closed=True)

        # around the length (crosses the top along Y) and around the width (along X)
        ylo, yhi = yc - L / 2 - 0.001 + sink, yc + L / 2 + 0.001 - sink
        xlo, xhi = xc - Wd / 2 + sink - 0.001, xc + Wd / 2 - sink + 0.003
        zlo, zhi = z + sink, top - sink + rt
        loop(_rounded_rect_yz(xc + 0.012, ylo, yhi, zlo, zhi, corner))
        loop(_rounded_rect_xz(yc - 0.02, xlo, xhi, zlo, zhi, corner))
        # the knot + a bow on top, a string to the kraft tag hanging over the spines
        k0 = Vector((xc + 0.012, yc - 0.02, zhi + 0.001))
        sphere("lgs_knot", 0.0042, loc=k0, mat="twine", seg=8, rings=5, scale=(1.2, 1.0, 0.7))
        for sgn in (-1, 1):
            torus(f"lgs_bow{sgn}", 0.0085, rt, loc=k0 + Vector((0.004 * sgn, 0.009 * sgn, 0.0015)), rot=(8, 0, 28 + sgn * 22), mat="twine", seg=12, ring=4)
            tube(f"lgs_tail{sgn}", [k0, k0 + Vector((0.016, 0.012 * sgn, -0.001)), k0 + Vector((0.03, 0.02 * sgn, -0.002))], rt * 0.9, mat="twine", kind="POLY", res=1, bevel_res=1)
        # the kraft tag hangs on the front, over the spines; a string runs up to the knot
        tag_c = Vector((xhi + 0.0016, yc + 0.012, top - 0.05))
        R = Matrix.Translation(tag_c) @ basis((1, 0, 0.04), (0, 0.18, 1))
        tag_pts = [(-0.015, -0.022), (0.015, -0.022), (0.015, 0.016), (0.008, 0.023), (-0.008, 0.023), (-0.015, 0.016)]
        to_face = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # slab (x, y, z) → tag (width, height, normal)
        put(from_bm("lgs_tag", slab_bm(tag_pts, 0.0005, -0.00025), "kraft", wn=False, smooth_angle=20), R @ to_face)
        ring = R @ Vector((0.0004, 0, 0.0175))
        put(torus("lgs_tag_ring", 0.0028, 0.0008, mat="paper", seg=10, ring=4), Matrix.Translation(ring) @ rot_only(R) @ Matrix.Rotation(90 * DEG, 4, "Y"))
        for i, lw in enumerate((0.02, 0.014)):
            put(box(f"lgs_tag_line{i}", (0.0003, lw, 0.0014), mat="ink", bevel=0), R @ Matrix.Translation((0.0004, -0.002 * i, -0.002 - i * 0.0055)))
        lip = Vector((xhi + 0.0012, ring.y - 0.003, top + 0.0006))
        tube("lgs_string", [k0 + Vector((0.003, 0, 0)), lip + Vector((-0.012, 0, 0.0004)), lip, ring + Vector((0, 0, 0.0026))], 0.0006, mat="twine", kind="POLY", res=1, bevel_res=1)


def _rounded_rect_yz(x, y0, y1, z0, z1, r, n=2):
    pts = []
    for cy, cz, a0 in ((y1 - r, z1 - r, 0), (y0 + r, z1 - r, 90), (y0 + r, z0 + r, 180), (y1 - r, z0 + r, 270)):
        for i in range(n + 1):
            a = (a0 + 90 * i / n) * DEG
            pts.append(Vector((x, cy + r * math.cos(a), cz + r * math.sin(a))))
    return pts


def _rounded_rect_xz(y, x0, x1, z0, z1, r, n=2):
    pts = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for i in range(n + 1):
            a = (a0 + 90 * i / n) * DEG
            pts.append(Vector((cx + r * math.cos(a), y, cz + r * math.sin(a))))
    return pts


# ------------------------------------------------------------------ olympiad (left bay, eye level)

RAIL_X = BACK + 0.034
RAIL_Z = OPENINGS[1][1] - 0.042
RAIL_R = 0.0042


def olympiad():
    z = BOARDS[1]
    ya, yb = BAYS["left"]
    # brass hanger rail across the back: rod, two wall brackets with rosettes, finials
    r0, r1 = ya + 0.035, ya + 0.6
    cyl("rail_rod", RAIL_R, r1 - r0, loc=(RAIL_X, r0, RAIL_Z), rot=(-90, 0, 0), mat="brass", seg=14, bevel=0.0008)
    for yy in (r0 + 0.018, r1 - 0.018):
        cyl(f"rail_post_{yy:.2f}", 0.0034, RAIL_X - BACK, loc=(BACK, yy, RAIL_Z), rot=(0, 90, 0), mat="brass", seg=10, bevel=0.0006)
        cyl(f"rail_rose_{yy:.2f}", 0.011, 0.004, loc=(BACK, yy, RAIL_Z), rot=(0, 90, 0), mat="brass", seg=16, bevel=0.0012)
    for yy in (r0, r1):
        sphere(f"rail_finial_{yy:.2f}", 0.0068, loc=(RAIL_X, yy, RAIL_Z), mat="brass", seg=12, rings=7)
    # the team's medals hang from it: two silver, two bronze
    hang = [("medal_silver_1", "silver", "ribbon_navy", 0.0325), ("medal_silver_2", "silver", "ribbon_navy", 0.0325),
            ("medal_bronze_1", "bronze", "ribbon_teal", 0.032), ("medal_bronze_2", "bronze", "ribbon_teal", 0.032)]
    for i, (iid, metal, rib, R) in enumerate(hang):
        y = r0 + 0.065 + i * 0.145
        hanging_medal(iid, metal, rib, R, y, drop=0.098 + 0.01 * (i % 2))
    gold_on_easel(ya + 0.32, z)
    trophy(yb - 0.1, z)


def hanging_medal(iid, metal, rib_mat, R, y, drop):
    """A medal on its ribbon, looped over the rail: both strands come down to a V through the
    medal's eyelet."""
    width, thick = 0.026, 0.0007
    rc = RAIL_R + thick / 2 + 0.0002
    center = Vector((RAIL_X, y, RAIL_Z - drop - R - 0.008))
    F = Matrix.Translation(center)
    with item(iid, F, "olympiad"):
        f, tip = medal(iid, F, metal, R=R, laurel=False, seg=36)
        tip_z = tip.z
        pts2 = loop_over((0.0008, tip_z - center.z), (-0.0008, tip_z - center.z), (0.0, RAIL_Z - center.z), rc, width)
        path = [center + Vector((u, 0, v)) for u, v in pts2]
        ribbon(f"{iid}_ribbon", path, Vector((0, 1, 0)), width, thick, rib_mat)
        stripe = [p + Vector((thick * 0.9, 0, 0)) for p in path[:4]]
        ribbon(f"{iid}_stripe", stripe, Vector((0, 1, 0)), 0.005, 0.0003, "ribbon_white", ends=(True, False))


def stick(name, a, b, size, face, mat="walnut"):
    """A square stick from a to b, its faces aligned with `face` (a direction across the stick)."""
    d = b - a
    x = (face - d.normalized() * face.dot(d.normalized())).normalized()
    st = box(name, (size, size, d.length), mat=mat, bevel=0.0015, seg=1, anchor=(0, 0, -1))
    st.matrix_world = Matrix.Translation(a) @ basis(x, d)
    return st


def gold_on_easel(y, z):
    """The hero: national gold, laurel wreath, on a little walnut easel at the front; its red-white
    ribbon runs up the easel, over the top bar, and its tail hangs down the back."""
    lean = 14
    R = 0.036
    c, s = math.cos(lean * DEG), math.sin(lean * DEG)
    X, Z = Vector((c, 0, s)), Vector((-s, 0, c))
    foot = Vector((FB - 0.052, y, z))  # front legs' feet
    ledge_h = 0.026
    leg = lambda h: foot + Vector((-h * s / c, 0, h))  # noqa: E731
    center = leg(ledge_h) + Z * (0.0039 + R) + X * 0.0066  # on the ledge, its back against the legs
    F = Matrix.Translation(center) @ basis(X, Z)
    top_h = 0.142
    bar = leg(top_h) + X * 0.0052
    with item("medal_gold", F, "olympiad"):
        f, tip = medal("medal_gold", F, "gold", R=R, laurel=True, seg=48)
        inv = F.inverted()
        t_loc, b_loc = inv @ tip, inv @ bar
        width, thick = 0.03, 0.0008
        rc = 0.0052 + thick / 2 + 0.0003
        # up the front from the eyelet (a V), over the bar, a 4 cm tail down the back
        pts2 = loop_over((t_loc.x + 0.0008, t_loc.z), (b_loc.x - rc - 0.002, b_loc.z - 0.04), (b_loc.x, b_loc.z), rc, width)
        path = [F @ Vector((u, 0, v)) for u, v in pts2]
        ribbon("medal_gold_ribbon", path, F.to_3x3() @ Vector((0, 1, 0)), width, thick, "ribbon_red")
        # a white center stripe, a hair proud on the front strand
        stripe = [p + (F.to_3x3() @ Vector((1, 0, 0))) * (thick * 0.9) for p in path[:4]]
        ribbon("medal_gold_stripe", stripe, F.to_3x3() @ Vector((0, 1, 0)), 0.008, 0.0003, "ribbon_white", ends=(True, False))
    # the easel (decor): two splayed front legs, a ledge with a lip, the top bar, a back leg
    for sgn in (-1, 1):
        stick(f"medal_easel_leg{sgn}", foot + Vector((0, sgn * 0.04, 0)), leg(top_h + 0.014) + Vector((0, sgn * 0.024, 0)), 0.0085, X)
    lg = leg(ledge_h)
    box("medal_easel_ledge", (0.018, 0.1, 0.0075), loc=lg + X * 0.0065, rot=(0, -lean, 0), mat="walnut", bevel=0.0015, seg=1, anchor=(0, 0, 0))
    box("medal_easel_lip", (0.005, 0.1, 0.011), loc=lg + X * 0.0145 + Z * 0.004, rot=(0, -lean, 0), mat="walnut", bevel=0.0012, seg=1)
    cyl("medal_easel_bar", 0.0052, 0.068, loc=bar - X * 0.0001, rot=(90, 0, 0), mat="walnut", seg=14, bevel=0.0009, anchor_bottom=False)
    # the back leg props the right-hand leg, clear of the ribbon's tail
    top = leg(top_h - 0.01) + Vector((0, 0.026, 0)) - X * 0.0085
    stick("medal_easel_back", Vector((foot.x - 0.11, y + 0.03, z)), top, 0.0075, Vector((0, 1, 0)))


def trophy(y, z):
    """The team cup: a gold bowl on a stem, two handles, a two-tier walnut base with a brass plaque."""
    tx = FB - 0.135
    F = Matrix.Translation((tx, y, z + 0.14))
    with item("trophy", F, "olympiad"):
        box("trophy_base", (0.112, 0.112, 0.046), loc=(tx, y, z), mat="walnut_dark", bevel=0.004, anchor=(0, 0, -1))
        box("trophy_base2", (0.084, 0.084, 0.028), loc=(tx, y, z + 0.046), mat="walnut_dark", bevel=0.003, anchor=(0, 0, -1))
        rrect("trophy_plaque", 0.07, 0.026, 0.0016, 0.003, loc=(tx + 0.0564, y, z + 0.023), rot=(0, 0, 90), mat="brass", axis="Y", seg=3, bevel=0.0005)
        for k, (lw, dz) in enumerate(((0.046, 0.005), (0.032, -0.004))):
            box(f"trophy_engrave{k}", (0.0004, lw, 0.0022), loc=(tx + 0.0573, y, z + 0.023 + dz), mat="walnut_dark", bevel=0)
        z0 = z + 0.074
        cup = [(0.0, 0.0), (0.035, 0.0), (0.037, 0.005), (0.026, 0.011), (0.011, 0.02), (0.0085, 0.03), (0.0085, 0.062), (0.0145, 0.068),
               (0.0145, 0.074), (0.009, 0.08), (0.013, 0.09), (0.032, 0.106), (0.047, 0.136), (0.055, 0.172), (0.059, 0.186), (0.0545, 0.188),
               (0.0495, 0.178), (0.042, 0.146), (0.0, 0.124)]
        lathe("trophy_cup", cup, loc=(tx, y, z0), mat="gold", seg=36, smooth_angle=40)
        for sgn in (-1, 1):
            tube(f"trophy_handle{sgn}", [(tx, y + sgn * 0.046, z0 + 0.168), (tx, y + sgn * 0.077, z0 + 0.164), (tx, y + sgn * 0.085, z0 + 0.138),
                                         (tx, y + sgn * 0.069, z0 + 0.112), (tx, y + sgn * 0.037, z0 + 0.104)], 0.0048, mat="gold", res=6, bevel_res=2)


# ------------------------------------------------------------------ mun (left bay, bottom)


def mun():
    z = BOARDS[0]
    ya, yb = BAYS["left"]
    # a walnut step along the back lifts the photos over the placard and the gavel
    step_h, step_d = 0.055, 0.118
    s0, s1 = ya + 0.006, yb - 0.072
    box("mun_step", (step_d, s1 - s0, step_h), loc=(BACK + step_d / 2, (s0 + s1) / 2, z), mat="walnut", bevel=0.004, anchor=(0, 0, -1))
    zs = z + step_h
    # three photo frames (MUN photos at runtime); kickstands need ~7 cm behind a frame
    for n, (pw, ph, border, depth, mat, y, lean, yaw) in enumerate((
        (0.15, 0.2, 0.022, 0.02, "oak", ya + 0.112, 11, 7),
        (0.2, 0.15, 0.024, 0.022, "walnut_dark", ya + 0.372, 10, -2),
        (0.11, 0.16, 0.018, 0.017, "brass", ya + 0.582, 12, -9),
    ), start=1):
        oh = ph + 2 * border
        F0 = lean_frame(lean, yaw)
        X, Z = F0.to_3x3() @ Vector((1, 0, 0)), F0.to_3x3() @ Vector((0, 0, 1))
        bottom_back = Vector((BACK + 0.08 - 0.06 * math.sin(yaw * DEG) * 0, y, zs))
        center = bottom_back + X * (depth / 2) + Z * (oh / 2)
        F = Matrix.Translation(center) @ F0
        with item(f"photo_{n:02d}", F, "mun"):
            photo_frame(f"photo_{n:02d}", f"slot__photo__{n:02d}", pw, ph, border, depth, mat, F @ Matrix.Translation((depth / 2, 0, 0)),
                        inner="paper", lean=lean)
    gavel(ya + 0.19, z)
    placard(ya + 0.505, z)
    lanyard(yb, z)


def placard(y, z):
    """The MUNDP tent card: one folded card (a rounded fold), the conference and the role printed on
    the side that faces the room."""
    H, half, t, W, ra = 0.094, 28.0, 0.0011, 0.235, 0.0035
    c, s = math.cos(half * DEG), math.sin(half * DEG)
    b = H * math.tan(half * DEG)
    xc = FB - 0.07
    zc = H - ra / s  # center of the fold's rounding (tangent to both legs)
    outer = [(b, 0.0)] + [(ra * math.cos(a * DEG), zc + ra * math.sin(a * DEG)) for a in (half, 60, 90, 120, 180 - half)] + [(-b, 0.0)]
    inner = [(-b + t / c, 0.0)] + [((ra - t) * math.cos(a * DEG), zc + (ra - t) * math.sin(a * DEG)) for a in (180 - half, 120, 90, 60, half)] + [(b - t / c, 0.0)]
    n_front, up_front = Vector((c, 0, s)), Vector((-s, 0, c))
    F = Matrix.Translation((xc + b / 2, y, z + H / 2)) @ basis(n_front, up_front)
    with item("placard", F, "mun"):
        put(from_bm("placard_card", prism_bm(outer + inner, W), "paper", wn=False, smooth_angle=30), mw((xc, y, z)))
        # printed on the front: text lies in its local XY; X → +Y (reads left to right), Z → out of the card
        R = Matrix(((0, -s, c, 0), (1, 0, 0, 0), (0, c, s, 0), (0, 0, 0, 1)))
        on_face = lambda u: Vector((xc + b, y, z)) + up_front * u + n_front * 0.00015  # noqa: E731
        put(text("placard_mundp", "MUNDP", 0.03, mat="navy", extrude=0.0, spacing=1.12), Matrix.Translation(on_face(0.061)) @ R)
        put(box("placard_rule", (0.074, 0.0009, 0.0001), mat="red", bevel=0), Matrix.Translation(on_face(0.0425)) @ R)
        put(text("placard_role", "DEPUTY SECRETARY-GENERAL", 0.0074, mat="red", extrude=0.0, spacing=1.06), Matrix.Translation(on_face(0.032)) @ R)


def gavel(y, z):
    """Gavel and sound block, one item: the gavel lies beside its block, handle toward the room."""
    yaw = 50 * DEG
    hdir = Vector((math.cos(yaw), -math.sin(yaw), 0.0))  # handle: toward the front-left
    side = Vector((math.sin(yaw), math.cos(yaw), 0.0))  # the head's axis
    head_r = 0.0213  # the brass bands are the widest part: they rest on the shelf
    hc = Vector((FB - 0.15, y, z + head_r))  # clear of the step behind
    bc = hc - hdir * 0.025 + side * 0.098
    # presented as a T: looking down on it as it lies, head up
    F = Matrix.Translation((hc + bc) / 2 + hdir * 0.05) @ basis(Vector((0, 0, 1)), -hdir)
    with item("gavel", F, "mun"):
        lathe("gavel_block", [(0.0, 0.0), (0.043, 0.0), (0.045, 0.003), (0.045, 0.016), (0.042, 0.019), (0.0, 0.019)], loc=(bc.x, bc.y, z), mat="walnut_dark",
              seg=28, smooth_angle=40)
        lathe("gavel_block_ring", [(0.0452, 0.006), (0.0462, 0.008), (0.0462, 0.012), (0.0452, 0.014)], loc=(bc.x, bc.y, z), mat="brass", seg=28)
        head_m = Matrix.Translation(hc) @ side.to_track_quat("Z", "X").to_matrix().to_4x4()
        put(lathe("gavel_head", [(0.0, -0.043), (0.016, -0.043), (0.0195, -0.04), (0.0205, -0.034), (0.0205, 0.034), (0.0195, 0.04), (0.016, 0.043),
                                 (0.0, 0.043)], mat="walnut", seg=24, smooth_angle=40), head_m)
        for sgn in (-1, 1):
            put(lathe(f"gavel_band{sgn}", [(0.0204, -0.0042), (0.0213, -0.003), (0.0213, 0.003), (0.0204, 0.0042)], mat="brass", seg=24),
                head_m @ Matrix.Translation((0, 0, 0.026 * sgn)))
        tilt = math.atan2(head_r - 0.0072, 0.19)
        hd = (hdir * math.cos(tilt) - Vector((0, 0, math.sin(tilt)))).normalized()
        put(lathe("gavel_handle", [(0.0, 0.0), (0.0058, 0.0), (0.0062, 0.05), (0.0058, 0.15), (0.0068, 0.17), (0.0078, 0.182), (0.0072, 0.192),
                                   (0.004, 0.198), (0.0, 0.199)], mat="walnut", seg=14, smooth_angle=40),
            Matrix.Translation(hc) @ hd.to_track_quat("Z", "Y").to_matrix().to_4x4())


def lanyard(y_divider, z):
    """The conference badge on its lanyard, hanging from a brass coat hook on the divider. The strap
    drapes over the hook's arm, so it hangs flat toward the room, and so does the badge."""
    hook = Vector((FB - 0.085, y_divider, OPENINGS[0][1] - 0.04))
    arm_len, arm_r = 0.068, 0.0032
    tip = hook + Vector((0, -arm_len, 0))
    cyl("lanyard_hook_rose", 0.0095, 0.004, loc=hook, rot=(90, 0, 0), mat="brass", seg=14, bevel=0.0012)
    tube("lanyard_hook", [hook, tip, tip + Vector((0, -0.003, 0.007))], arm_r, mat="brass", kind="POLY", res=1, bevel_res=1)
    sphere("lanyard_hook_knob", 0.0046, loc=tip + Vector((0, -0.0035, 0.009)), mat="brass", seg=10, rings=6)
    ys = tip.y + 0.012  # where the strap rests, near the arm's tip
    width, thick = 0.018, 0.0009
    rc = arm_r + thick / 2 + 0.0002
    clip_z = hook.z - 0.12
    bw, bh = 0.1, 0.142
    F = Matrix.Translation((hook.x, ys, clip_z - 0.07))
    to_x = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # local (x, y, z) → world (y, z, x): a face toward +X
    with item("lanyard", F, "mun"):
        pts2 = loop_over((0.0012, clip_z), (-0.0012, clip_z), (0.0, hook.z), rc, 0.004)
        path = [Vector((hook.x + u, ys, v)) for u, v in pts2]
        from_bm("lanyard_strap", strip_bm(path, Vector((0, 1, 0)), [width] * len(path), thick), "ribbon_navy", wn=False, smooth_angle=50)
        # crimp, swivel and clip
        box("lanyard_crimp", (0.006, width + 0.002, 0.012), loc=(hook.x, ys, clip_z), mat="steel", bevel=0.0012, seg=1)
        torus("lanyard_swivel", 0.0042, 0.0011, loc=(hook.x, ys, clip_z - 0.0095), rot=(90, 0, 0), mat="steel", seg=12, ring=4)
        rrect("lanyard_clip", 0.009, 0.019, 0.004, 0.0035, loc=(hook.x, ys, clip_z - 0.023), mat="steel", axis="Y", seg=3, bevel=0.0008)
        # the badge: a clear sleeve holding the card (header band, name, photo, lines)
        bz = clip_z - 0.032 - bh / 2
        rrect("badge_sleeve", bw + 0.006, bh + 0.008, 0.0024, 0.004, loc=(hook.x, ys, bz), rot=(0, 0, 90), mat="sleeve", axis="Y", seg=3, bevel=0.0006)
        fx = hook.x + 0.0013
        box("badge_card", (0.0004, bw, bh), loc=(fx, ys, bz), mat="paper", bevel=0)
        box("badge_header", (0.0004, bw, 0.034), loc=(fx + 0.0002, ys, bz + bh / 2 - 0.017), mat="ribbon_navy", bevel=0)
        t = text("badge_title", "MUNDP", 0.016, mat="paper", extrude=0.0, spacing=1.1)
        t.matrix_world = Matrix.Translation((fx + 0.0005, ys, bz + bh / 2 - 0.017)) @ to_x
        box("badge_photo", (0.0004, 0.03, 0.036), loc=(fx + 0.0002, ys + 0.026, bz + 0.01), mat="ribbon_navy", bevel=0)
        for i, lw in enumerate((0.044, 0.036, 0.04)):
            box(f"badge_line{i}", (0.0004, lw, 0.0035), loc=(fx + 0.0002, ys - 0.014 - (0.044 - lw) / 2, bz + 0.022 - i * 0.012), mat="ribbon_navy", bevel=0)


# ------------------------------------------------------------------ the books bay (right)


def B(w, h, d, kind, color):
    return (w, h, d, kind, color)


# per opening, top to bottom; each entry is a group placed left → right
# real sizes (thickness, height, depth): hardcovers ~24-27 × 16-18 cm, paperbacks ~20-22 × 13-14,
# two oversized art books at the bottom of the stacks. Colors are placeholders: the runtime paints
# every spine and board from content.
TOP_ROW = [B(0.038, 0.262, 0.175, "hard", "#7A2E2E"), B(0.024, 0.212, 0.136, "soft", "#E3D6BC"), B(0.045, 0.248, 0.165, "hard", "#2E4A62"),
           B(0.03, 0.272, 0.18, "hard", "#C9A45C"), B(0.026, 0.205, 0.132, "soft", "#3D5C5C")]
TOP_FACE = B(0.032, 0.255, 0.17, "hard", "#B5573A")
TOP_STACK = [B(0.026, 0.21, 0.138, "soft", "#5A6E3A"), B(0.042, 0.265, 0.2, "hard", "#2F3A4A")]  # top → bottom
MID_STACK = [B(0.022, 0.205, 0.135, "soft", "#D97B5D"), B(0.032, 0.245, 0.165, "hard", "#46566B"), B(0.038, 0.285, 0.22, "hard", "#E8DCC4")]
MID_FACE = B(0.028, 0.25, 0.165, "hard", "#4E6B4A")
MID_ROW = [B(0.036, 0.255, 0.17, "hard", "#9E3D3D"), B(0.03, 0.22, 0.142, "soft", "#E0B44C"), B(0.044, 0.268, 0.178, "hard", "#1F2A36"),
           B(0.024, 0.208, 0.134, "soft", "#8C7A5B")]
BOT_FACE = B(0.03, 0.258, 0.172, "hard", "#2C4F6B")
BOT_ROW = [B(0.034, 0.25, 0.168, "hard", "#6B4B7A"), B(0.022, 0.21, 0.135, "soft", "#C47F45"), B(0.04, 0.272, 0.18, "hard", "#3E5A4A"),
           B(0.028, 0.225, 0.15, "soft", "#A8B5A0"), B(0.046, 0.26, 0.172, "hard", "#7A2E2E"), B(0.026, 0.212, 0.136, "soft", "#D9CBB0"),
           B(0.036, 0.245, 0.165, "hard", "#2E4A62")]


class Counter:
    def __init__(self):
        self.n = 0

    def next(self):
        self.n += 1
        return self.n


def spine_x(spec):
    return FB - 0.011 - spec[2] / 2


def upright(cnt, spec, y_left, z, yaw=0.0):
    """A book standing spine-out with its left side at y_left; returns its right side."""
    w = spec[0]
    m = book_matrix(spec, (spine_x(spec), y_left + w / 2, z + spec[1] / 2), Matrix.Rotation(yaw * DEG, 3, "Z") @ Vector((0, 1, 0)))
    book(cnt.next(), spec, m)
    return y_left + w + 0.0016


def leaning(cnt, spec, y_touch, z, phi):
    """A book leaning right onto a neighbor whose left face is at y_touch (pivot on its right foot)."""
    w, h = spec[0], spec[1]
    ph = phi * DEG
    foot = Vector((spine_x(spec), y_touch - h * math.sin(ph) - 0.0008, z))  # bottom-right edge
    up = Vector((0, math.sin(ph), math.cos(ph)))
    across = Vector((0, -math.cos(ph), math.sin(ph)))  # toward the left side
    center = foot + up * (h / 2) + across * (w / 2)
    book(cnt.next(), spec, book_matrix(spec, center, -across, up))
    return foot.y - w * math.cos(ph)


def stack(cnt, specs, y_center, z, seed=11):
    """Books lying flat, spines to the room, front covers up, heads to the left; specs top → bottom
    (numbered in that order)."""
    r = jitter(seed)
    heights, zz = [], z
    for spec in reversed(specs):
        heights.append(zz)
        zz += spec[0]
    heights.reverse()
    for spec, zb in zip(specs, heights):
        yaw = r.uniform(-1.5, 1.5) * DEG
        head = Matrix.Rotation(yaw, 3, "Z") @ Vector((0, -1, 0))
        center = (spine_x(spec) + r.uniform(-0.003, 0.002), y_center + r.uniform(-0.004, 0.004), zb + spec[0] / 2)
        book(cnt.next(), spec, book_matrix(spec, center, (0, 0, 1), head))
    return zz


def faceout(cnt, spec, y_center, z, lean=13.0, yaw=0.0):
    """A book standing face-out on a walnut stand."""
    w, h, d = spec[0], spec[1], spec[2]
    st_w = d * 0.5
    x_foot = FB - 0.1  # the stand's back foot
    Rz = Matrix.Rotation(yaw * DEG, 4, "Z")
    stand = wedge_stand(f"stand_{cnt.n + 1:02d}", st_w, lean, base=0.07, back_h=min(0.13, h * 0.55))
    put(stand, mw((x_foot, y_center, z), Rz))
    F0 = Rz @ lean_frame(lean)
    X, Z = F0.to_3x3() @ Vector((1, 0, 0)), F0.to_3x3() @ Vector((0, 0, 1))
    foot = Vector((x_foot, y_center, z + 0.008)) + (Rz.to_3x3() @ Vector((0.0004, 0, 0)))
    center = foot + X * (w / 2) + Z * (h / 2)
    book(cnt.next(), spec, book_matrix(spec, center, X, Z), faceout=True)


def bookend(name, y, z, side=1, x=None):
    """A brass arch bookend (a tall slab with a round top)."""
    w, h, t = 0.105, 0.15, 0.011
    pts = [(-w / 2, 0.0), (w / 2, 0.0)] + [(w / 2 * math.cos(a * DEG), h - w / 2 + w / 2 * math.sin(a * DEG)) for a in range(0, 181, 15)]
    ob = from_bm(name, prism_bm(pts, t), "brass", bevel=0.0012, seg=1, smooth_angle=30)
    put(ob, mw(((x if x is not None else FB - 0.03 - w / 2), y + side * t / 2, z)))
    return y + side * t


def books_bay():
    ya, yb = BAYS["right"]
    cnt = Counter()
    # top opening: five upright, a bookend, a pilea, a face-out, a stack of two
    z = BOARDS[2]
    y = ya + 0.003
    for spec in TOP_ROW:
        y = upright(cnt, spec, y, z, yaw=0.0)
    y = bookend("bookend_top", y + 0.001, z)
    pilea(y + 0.062, z)
    faceout(cnt, TOP_FACE, y + 0.196, z, lean=13)
    stack(cnt, TOP_STACK, yb - 0.01 - max(sp[1] for sp in TOP_STACK) / 2, z, seed=3)
    # middle opening: a stack of three, a face-out, a candle, four upright (the first leaning)
    z = BOARDS[1]
    stack(cnt, MID_STACK, ya + 0.01 + max(sp[1] for sp in MID_STACK) / 2, z, seed=8)
    faceout(cnt, MID_FACE, ya + 0.385, z, lean=12, yaw=-4)
    candle(ya + 0.515, z)
    widths = [s[0] for s in MID_ROW[1:]]
    y_right = yb - 0.002
    y_first = y_right - sum(widths) - 0.0016 * len(widths)
    leaning(cnt, MID_ROW[0], y_first, z, phi=13)
    y = y_first
    for spec in MID_ROW[1:]:
        y = upright(cnt, spec, y, z)
    # bottom opening: a face-out, a vase, a bookend, seven upright against the side
    z = BOARDS[0]
    faceout(cnt, BOT_FACE, ya + 0.1, z, lean=12, yaw=5)
    vase(ya + 0.25, z)
    keepsake_box(ya + 0.4, z)
    widths = [s[0] for s in BOT_ROW]
    y = yb - 0.003 - sum(widths) - 0.0016 * len(widths)
    bookend("bookend_bottom", y - 0.001, z, side=-1)
    for spec in BOT_ROW:
        y = upright(cnt, spec, y, z)
    assert cnt.n == 24, cnt.n


# ------------------------------------------------------------------ decor between the books


def pilea(y, z):
    """A little Chinese money plant in a terracotta pot: round leaves on thin stems."""
    px = FB - 0.075
    lathe("pilea_pot", thick_profile([(0.03, 0.0), (0.033, 0.006), (0.038, 0.058), (0.041, 0.064)], 0.0045), loc=(px, y, z), mat="terracotta", seg=20)
    lathe("pilea_soil", [(0.0, 0.0), (0.035, 0.0), (0.0, 0.002)], loc=(px, y, z + 0.054), mat="soil", seg=12)
    r = jitter(41)
    base = Vector((px, y, z + 0.055))
    leaves = bmesh.new()
    for k in range(8):
        a = k * 137.5 * DEG
        out = 0.03 + 0.012 * (k % 3)
        rise = 0.05 + 0.03 * r.random()
        tip = base + Vector((math.cos(a) * out, math.sin(a) * out, rise))
        mid = base + Vector((math.cos(a) * out * 0.3, math.sin(a) * out * 0.3, rise * 0.7))
        tube(f"pilea_stem_{k}", [base, mid, tip], 0.0011, mat="stem", res=3, bevel_res=0)
        rad = r.uniform(0.016, 0.024)
        disc = bmesh.new()
        bmesh.ops.create_circle(disc, cap_ends=True, cap_tris=False, segments=10, radius=rad)
        for v in disc.verts:
            v.co.z = -0.12 * (v.co.x ** 2 + v.co.y ** 2) / rad
        n = (Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 1.0))).normalized()
        q = n.to_track_quat("Z", "Y")
        bmesh.ops.transform(disc, matrix=Matrix.Translation(tip + n * 0.002) @ q.to_matrix().to_4x4(), verts=disc.verts)
        me = bpy.data.meshes.new("_d")
        disc.to_mesh(me)
        disc.free()
        leaves.from_mesh(me)
        bpy.data.meshes.remove(me)
    from_bm("pilea_leaves", leaves, "leaf_light", wn=False, smooth_angle=None)


def keepsake_box(y, z):
    """A little oak box with a walnut lid and a brass latch."""
    bx = FB - 0.1
    rrect("keep_box", 0.12, 0.15, 0.072, 0.008, loc=(bx, y, z), rot=(0, 0, 6), mat="oak", axis="Z", seg=3, bevel=0.003, anchor=(0, 0, -1))
    rrect("keep_lid", 0.124, 0.154, 0.018, 0.009, loc=(bx, y, z + 0.072), rot=(0, 0, 6), mat="walnut", axis="Z", seg=3, bevel=0.004, anchor=(0, 0, -1))
    a = 6 * DEG
    box("keep_latch", (0.003, 0.016, 0.022), loc=(bx + 0.0615 * math.cos(a), y + 0.0615 * math.sin(a), z + 0.068), rot=(0, 0, 6), mat="brass", bevel=0.0008, seg=1)


def candle(y, z):
    """A pillar candle on a brass dish."""
    cx = FB - 0.09
    lathe("candle_dish", [(0.0, 0.0), (0.038, 0.0), (0.042, 0.006), (0.04, 0.007), (0.034, 0.003), (0.0, 0.003)], loc=(cx, y, z), mat="brass", seg=24)
    lathe("candle_wax", [(0.0, 0.0), (0.03, 0.0), (0.03, 0.084), (0.0285, 0.088), (0.018, 0.086), (0.0, 0.0845)], loc=(cx, y, z + 0.003), mat="wax", seg=24,
          smooth_angle=60)
    cyl("candle_wick", 0.0011, 0.009, loc=(cx, y, z + 0.0865), mat="ink", seg=6, bevel=0)


def vase(y, z):
    """A glazed bud vase with a dried eucalyptus stem."""
    vx = FB - 0.095
    lathe("vase", thick_profile([(0.024, 0.0), (0.036, 0.03), (0.04, 0.06), (0.03, 0.1), (0.012, 0.13), (0.011, 0.155), (0.014, 0.162)], 0.004), loc=(vx, y, z),
          mat="glaze", seg=20, smooth_angle=60)
    stem = [Vector((vx, y, z + 0.12)), Vector((vx + 0.006, y + 0.004, z + 0.2)), Vector((vx + 0.02, y + 0.012, z + 0.27)), Vector((vx + 0.04, y + 0.022, z + 0.31))]
    tube("vase_stem", stem, 0.0012, mat="stem", res=4, bevel_res=0)
    leaves = bmesh.new()
    for k, (pos, tan) in enumerate(curve_points(stem, n=9)[2:]):
        for sgn in (-1, 1):
            disc = bmesh.new()
            bmesh.ops.create_circle(disc, cap_ends=True, cap_tris=False, segments=8, radius=0.0105 - 0.0006 * k)
            out = tan.cross(Vector((0, 0, 1)))
            if out.length < 1e-4:
                out = Vector((1, 0, 0))
            out = (out.normalized() * sgn + Vector((0.4, 0, 0))).normalized()
            q = out.to_track_quat("Z", "Y")
            bmesh.ops.transform(disc, matrix=Matrix.Translation(pos + out * 0.009) @ q.to_matrix().to_4x4() @ Matrix.Rotation(90 * DEG, 4, "X"), verts=disc.verts)
            me = bpy.data.meshes.new("_d")
            disc.to_mesh(me)
            disc.free()
            leaves.from_mesh(me)
            bpy.data.meshes.remove(me)
    from_bm("vase_leaves", leaves, "#8FA89A", wn=False, smooth_angle=None)


# ------------------------------------------------------------------ on top of the case


def top_things():
    z = TOP_Z + 0.04
    # a woven basket at the right, a trailing pothos at the left end
    bx, by = FX - 0.17, Y1 - 0.25
    lathe("basket", thick_profile([(0.085, 0.0), (0.09, 0.01), (0.097, 0.13)], 0.005), loc=(bx, by, z), mat="#C9A36B", seg=32)
    for k in range(5):
        lathe(f"basket_band_{k}", [(0.0905 + k * 0.0013, 0.0), (0.0925 + k * 0.0013, 0.006), (0.0905 + k * 0.0013, 0.012)], loc=(bx, by, z + 0.018 + k * 0.022),
              mat="#A9824E", seg=32)
    px, py = FX - 0.12, Y0 + 0.17
    lathe("pothos_pot", thick_profile([(0.058, 0.0), (0.064, 0.006), (0.068, 0.095), (0.073, 0.105)], 0.006), loc=(px, py, z), mat="terracotta", seg=28)
    lathe("pothos_soil", [(0.0, 0.0), (0.064, 0.0), (0.0, 0.003)], loc=(px, py, z + 0.088), mat="soil", seg=16)
    r = jitter(9)
    light, dark = [], []
    vines = [
        [(px, py, z + 0.095), (px + 0.05, py - 0.05, z + 0.11), (FX - 0.01, Y0 - 0.025, z + 0.02), (FX - 0.03, Y0 - 0.03, z - 0.25), (FX - 0.05, Y0 - 0.028, z - 0.5)],
        [(px, py, z + 0.095), (px - 0.02, py - 0.07, z + 0.12), (BX + 0.12, Y0 - 0.03, z + 0.01), (BX + 0.11, Y0 - 0.035, z - 0.2), (BX + 0.12, Y0 - 0.03, z - 0.34)],
        [(px, py, z + 0.095), (px + 0.06, py + 0.03, z + 0.13), (FX + 0.015, py + 0.06, z + 0.03), (FX + 0.02, py + 0.09, z - 0.06)],
        [(px, py, z + 0.095), (px + 0.01, py + 0.02, z + 0.17), (px + 0.03, py + 0.04, z + 0.22)],
        [(px, py, z + 0.095), (px - 0.04, py + 0.04, z + 0.15), (px - 0.06, py + 0.06, z + 0.19)],
    ]
    for vi, pts in enumerate(vines):
        tube(f"pothos_vine_{vi}", pts, 0.0021, mat="stem", res=6, bevel_res=0)
        samples = curve_points(pts, n=(10 if vi < 2 else 5 if vi == 2 else 3))
        for k, (pos, tan) in enumerate(samples[1:]):
            side = 1 if k % 2 else -1
            size = r.uniform(0.042, 0.06) * (0.75 if vi >= 3 else 1)
            out = tan.cross(Vector((0, 0, 1)))
            if out.length < 1e-4:
                out = Vector((1, 0, 0))
            out.normalize()
            direction = (out * side * 0.9 + Vector((0.5, -0.2, 0.25)) + Vector((r.uniform(-0.2, 0.2), r.uniform(-0.2, 0.2), r.uniform(-0.1, 0.3)))).normalized()
            lb = leaf_bm(size, size * 0.8, "heart", droop=0.2, cup=0.25, nt=5, ns=3)
            place_bm(lb, pos, direction, roll=r.uniform(-0.6, 0.6))
            (light if r.random() < 0.4 else dark).append(lb)
    for name, lst, mat in (("pothos_leaves_a", light, "leaf_light"), ("pothos_leaves_b", dark, "leaf")):
        out = bmesh.new()
        for lb in lst:
            me = bpy.data.meshes.new("_l")
            lb.to_mesh(me)
            lb.free()
            out.from_mesh(me)
            bpy.data.meshes.remove(me)
        from_bm(name, out, mat, wn=False, smooth_angle=None)


def build():
    with group("shelf", own="shelf", bake="props"):
        case()
        plates()
        school()
        olympiad()
        mun()
        books_bay()
        top_things()
        anchors()
