"""The door on the left wall (four raised panels, brass lever, hinges, casing, a doormat) and the
mailbox beside it (obj__contact) with its flag (pivot__contact_flag), mail sticking out and the
family name on the side."""

import math

import bmesh
from mathutils import Matrix, Vector

from layout import DOOR, LEFT_X, MAILBOX, WALL_T
from lib.core import DEG, empty, group, tag
from lib.geo import box, cyl, frame, from_bm, plane, rrect, sphere, text, torus, tube

Y0, Y1 = DOOR["y"] - DOOR["w"] / 2, DOOR["y"] + DOOR["w"] / 2
H = DOOR["h"]


def door():
    t = 0.042
    face_x = LEFT_X - 0.022  # the door sits a little back in its opening
    dy, dh = DOOR["w"] - 0.012, H - 0.008
    box("door_slab", (t, dy, dh), loc=(face_x - t / 2, DOOR["y"], 0.004), mat="door_blue", bevel=0.003, anchor=(0, 0, -1))
    # four raised panels (stile/rail moldings)
    pw = (dy - 0.12 * 2 - 0.09) / 2
    for i, (zc, ph) in enumerate(((1.42, 0.86), (0.48, 0.62))):
        for j, s in enumerate((-1, 1)):
            yc = DOOR["y"] + s * (pw / 2 + 0.045)
            fr = frame(f"door_mold_{i}{j}", pw, ph, pw - 0.05, ph - 0.05, 0.01, mat="door_blue", r=0.0, ir=0.0, seg=1, bevel=0.003, back=False)
            fr.matrix_world = Matrix.Translation((face_x + 0.01, yc, zc)) @ Matrix.Rotation(90 * DEG, 4, "Z")
            box(f"door_panel_{i}{j}", (0.008, pw - 0.07, ph - 0.07), loc=(face_x + 0.004, yc, zc), mat="door_blue", bevel=0.006, seg=2)
    # lever handle + keyhole on the front side
    hy = Y0 + 0.075
    cyl("door_rose", 0.026, 0.008, loc=(face_x, hy, 1.0), rot=(0, 90, 0), mat="brass", seg=28, bevel=0.002)
    cyl("door_spindle", 0.008, 0.05, loc=(face_x, hy, 1.0), rot=(0, 90, 0), mat="brass", seg=16, bevel=0.002)
    tube("door_lever", [(face_x + 0.05, hy, 1.0), (face_x + 0.058, hy + 0.04, 1.0), (face_x + 0.06, hy + 0.11, 0.996)], 0.0075, mat="brass", res=8, bevel_res=3)
    rrect("door_keyplate", 0.024, 0.06, 0.004, 0.008, loc=(face_x + 0.002, hy, 0.9), rot=(0, 0, 90), mat="brass", axis="Y", seg=4, bevel=0.001)
    for k, z in enumerate((0.25, 1.05, 1.85)):
        cyl(f"hinge_{k}", 0.008, 0.1, loc=(face_x - 0.004, Y1 - 0.002, z), mat="brass", seg=12, bevel=0.002)
    # jamb liners + casing
    jx = LEFT_X - WALL_T / 2
    for s, y in ((-1, Y0), (1, Y1)):
        box(f"jamb_{s}", (WALL_T, 0.014, H), loc=(jx, y - s * 0.007, 0), mat="trim", bevel=0.002, anchor=(0, 0, -1))
    box("jamb_head", (WALL_T, DOOR["w"], 0.014), loc=(jx, DOOR["y"], H - 0.014), mat="trim", bevel=0.002, anchor=(0, 0, -1))
    cw, cd = 0.078, 0.022
    for s, y in ((-1, Y0 - cw / 2), (1, Y1 + cw / 2)):
        box(f"door_casing_{s}", (cd, cw, H + cw), loc=(LEFT_X + cd / 2, y, 0), mat="trim", bevel=0.005, anchor=(0, 0, -1))
    box("door_casing_head", (cd + 0.01, DOOR["w"] + 2 * cw + 0.04, 0.09), loc=(LEFT_X + (cd + 0.01) / 2, DOOR["y"], H + cw - 0.005), mat="trim", bevel=0.006, anchor=(0, 0, -1))
    box("door_casing_crown", (cd + 0.028, DOOR["w"] + 2 * cw + 0.07, 0.022), loc=(LEFT_X + (cd + 0.028) / 2, DOOR["y"], H + cw + 0.085), mat="trim", bevel=0.006, anchor=(0, 0, -1))
    # doormat
    rrect("doormat", 0.42, 0.66, 0.014, 0.02, loc=(LEFT_X + 0.3, DOOR["y"], 0.0), mat="#B88A54", axis="Z", seg=4, bevel=0.004, anchor=(0, 0, -1))
    hi = text("doormat_text", "hello", 0.12, mat="walnut_dark", extrude=0.0012, spacing=1.05)
    hi.matrix_world = Matrix.Translation((LEFT_X + 0.3, DOOR["y"], 0.0145)) @ Matrix.Rotation(90 * DEG, 4, "Z")


def mailbox():
    mx, my, mz = MAILBOX
    L, W, wall_h = 0.44, 0.2, 0.13
    x0 = LEFT_X + 0.03
    # wall shelf + corbels
    box("mail_shelf", (0.52, 0.27, 0.026), loc=(LEFT_X + 0.26, my, mz - 0.026), mat="oak", bevel=0.005, anchor=(0, 0, -1))
    for s in (-1, 1):
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((LEFT_X, my + s * 0.09, mz - 0.026), (LEFT_X + 0.2, my + s * 0.09, mz - 0.026), (LEFT_X, my + s * 0.09, mz - 0.2))]
        bm.faces.new(vs)
        cor = from_bm(f"mail_corbel_{s}", bm, "oak", wn=False, smooth_angle=None)
        sol = cor.modifiers.new("t", "SOLIDIFY")
        sol.thickness = 0.022
        sol.offset = 0
    # the tunnel body: rectangle + half circle, extruded along +X
    prof = [(-W / 2, 0.0), (W / 2, 0.0), (W / 2, wall_h)]
    for k in range(1, 16):
        a = math.pi * k / 16
        prof.append((W / 2 * math.cos(a), wall_h + W / 2 * math.sin(a)))
    prof.append((-W / 2, wall_h))
    bm = bmesh.new()
    back = [bm.verts.new((x0, my + y, mz + z)) for y, z in prof]
    front = [bm.verts.new((x0 + L, my + y, mz + z)) for y, z in prof]
    n = len(prof)
    for i in range(n):
        bm.faces.new((back[i], back[(i + 1) % n], front[(i + 1) % n], front[i]))
    bm.faces.new(list(reversed(back)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    from_bm("mail_body", bm, "navy", bevel=0.004, seg=2, smooth_angle=25)
    # front door, open a little, with mail poking out
    bm = bmesh.new()
    vs = [bm.verts.new((0.0, y * 1.04, z * 1.03)) for y, z in prof]
    bm.faces.new(vs)
    lid = from_bm("mail_door", bm, "navy", wn=False, smooth_angle=None)
    sol = lid.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.012
    lid.matrix_world = Matrix.Translation((x0 + L + 0.006, my, mz)) @ Matrix.Rotation(-14 * DEG, 4, "Y")
    tab = box("mail_tab", (0.012, 0.03, 0.03), mat="steel", bevel=0.003)
    tab.matrix_world = lid.matrix_world @ Matrix.Translation((0.012, 0, wall_h + W / 2 - 0.01))
    for k, (dz, rot, col) in enumerate(((0.06, 4, "paper"), (0.1, -6, "paper_warm"))):
        env = box(f"envelope_{k}", (0.2, 0.15, 0.003), mat=col, bevel=0.0008, seg=1)
        env.matrix_world = Matrix.Translation((x0 + L - 0.02, my + (k - 0.5) * 0.02, mz + dz)) @ Matrix.Rotation(rot * DEG, 4, "X") @ Matrix.Rotation(-12 * DEG, 4, "Y")
        stamp = box(f"stamp_{k}", (0.028, 0.034, 0.0012), mat="red" if k == 0 else "teal", bevel=0.0, seg=1)
        stamp.matrix_world = env.matrix_world @ Matrix.Translation((0.07, 0.045, 0.002))
    # the family name on the camera-facing side
    side_y = my - W / 2 - 0.0015
    name = text("mail_name", "ÖZTOK", 0.036, mat="cream", extrude=0.0012, spacing=1.12)
    name.matrix_world = Matrix.Translation((x0 + L * 0.52, side_y, mz + 0.072)) @ Matrix.Rotation(90 * DEG, 4, "X")
    # the flag: pivot on the side, resting DOWN (Mailbox.tsx lifts it on hover)
    pivot = empty("flag_pivot", (x0 + 0.27, side_y - 0.008, mz + 0.1), rot=(0, -90, 0))
    tag(pivot, contract="pivot__contact_flag", own="contact")
    pole = box("flag_pole", (0.012, 0.005, 0.19), mat="steel", bevel=0.0015, seg=2, anchor=(0, 0, -1))
    pole.parent = pivot
    pole.location = (0, 0, -0.01)
    tag(pole, pivot="contact_flag")
    flag = box("flag", (0.08, 0.004, 0.055), mat="red", bevel=0.002, seg=2)
    flag.parent = pivot
    flag.location = (-0.034, 0, 0.152)
    tag(flag, pivot="contact_flag")
    cyl("flag_bolt", 0.007, 0.006, mat="steel", seg=12, bevel=0.0015, loc=(x0 + 0.27, side_y - 0.003, mz + 0.1), rot=(90, 0, 0))


def build():
    with group("door", own="decor:door", bake="props"):
        door()
    with group("mailbox", own="contact", bake="props"):
        mailbox()
