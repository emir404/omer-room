"""The door on the left wall (four raised panels, brass lever, hinges, casing, a doormat) and the
mailbox beside it (obj__contact): its flag (pivot__contact_flag), a front door that drops open
(pivot__contact_door, extras.open), mail inside and the family name on the side."""

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


def tunnel(W, wall_h, inset=0.0, n=16):
    """The mailbox's (y, z) section: a rectangle under a half circle, `inset` smaller all round."""
    r = W / 2 - inset
    prof = [(-r, inset), (r, inset), (r, wall_h)]
    prof += [(r * math.cos(math.pi * k / n), wall_h + r * math.sin(math.pi * k / n)) for k in range(1, n)]
    return prof + [(-r, wall_h)]


DOOR_OPEN = 100.0  # degrees about pivot__contact_door's local Z (Blender) = the exported node's local Y


def mailbox():
    """A tunnel mailbox on a wall shelf. Its front door hinges at the bottom: pivot__contact_door sits
    on the hinge line with local Z along the hinge (+Y, Blender), so +100° about it drops the door
    open; 0 is closed, as modeled. extras.open = that angle in radians, about the exported node's
    local Y (Blender local Z → glTF local Y; the conversion keeps the sign). The door doesn't shadow
    the bake, so the inside (an envelope, a rolled letter) is lit when it opens."""
    mx, my, mz = MAILBOX
    L, W, wall_h, t = 0.44, 0.2, 0.13, 0.0035
    x0 = LEFT_X + 0.06
    x1 = x0 + L
    # wall shelf (its front edge just behind the door, so the door can swing past it) + corbels
    sd = x1 - 0.008 - LEFT_X
    box("mail_shelf", (sd, 0.27, 0.026), loc=(LEFT_X + sd / 2, my, mz - 0.026), mat="oak", bevel=0.005, anchor=(0, 0, -1))
    for s in (-1, 1):
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((LEFT_X, my + s * 0.09, mz - 0.026), (LEFT_X + 0.2, my + s * 0.09, mz - 0.026), (LEFT_X, my + s * 0.09, mz - 0.2))]
        bm.faces.new(vs)
        cor = from_bm(f"mail_corbel_{s}", bm, "oak", wn=False, smooth_angle=None)
        sol = cor.modifiers.new("t", "SOLIDIFY")
        sol.thickness = 0.022
        sol.offset = 0
    # the body: a closed shell with a real inside (it shows when the door opens)
    outer, inner = tunnel(W, wall_h), tunnel(W, wall_h, t)
    n = len(outer)
    bm = bmesh.new()
    ob_ = [bm.verts.new((x0, my + y, mz + z)) for y, z in outer]
    of = [bm.verts.new((x1, my + y, mz + z)) for y, z in outer]
    ib = [bm.verts.new((x0 + t, my + y, mz + z)) for y, z in inner]
    inf = [bm.verts.new((x1, my + y, mz + z)) for y, z in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ob_[i], ob_[j], of[j], of[i]))  # outside
        bm.faces.new((inf[i], inf[j], ib[j], ib[i]))  # inside
        bm.faces.new((of[i], of[j], inf[j], inf[i]))  # the rim around the opening
    bm.faces.new(list(reversed(ob_)))  # back
    bm.faces.new(ib)  # the inside of the back
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    from_bm("mail_body", bm, "navy", bevel=0.003, seg=2, smooth_angle=25)
    for s in (-1, 1):  # hinge knuckles at the bottom of the opening
        cyl(f"mail_hinge_{s}", 0.0042, 0.03, loc=(x1 + 0.004, my + s * 0.062, mz + 0.004), rot=(90, 0, 0), mat="steel", seg=10, bevel=0.001, anchor_bottom=False)
    # the door, closed, under its pivot
    pivot = empty("door_pivot", (x1 + 0.006, my, mz + 0.004), rot=(-90, 0, 0))
    tag(pivot, contract="pivot__contact_door", own="contact", open=round(math.radians(DOOR_OPEN), 5))
    face = [(y * 1.04, z * 1.03) for y, z in outer]
    bm = bmesh.new()
    a = [bm.verts.new((x1 + 0.0005, my + y, mz + z)) for y, z in face]
    b = [bm.verts.new((x1 + 0.0125, my + y, mz + z)) for y, z in face]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    from_bm("mail_door", bm, "navy", bevel=0.003, seg=2, smooth_angle=25, pivot="contact_door", shadow=False)
    top = mz + (wall_h + W / 2) * 1.03
    box("mail_tab", (0.012, 0.034, 0.03), loc=(x1 + 0.0185, my, top - 0.012), mat="steel", bevel=0.003, pivot="contact_door", shadow=False)
    # inside: an envelope on the floor and a rolled letter tied with twine
    env = box("envelope", (0.21, 0.15, 0.004), loc=(x0 + 0.24, my - 0.004, mz + t), rot=(0, 0, 5), mat="paper_warm", bevel=0.0012, seg=1, anchor=(0, 0, -1))
    _ = env
    box("envelope_stamp", (0.03, 0.026, 0.0008), loc=(x0 + 0.315, my + 0.044, mz + t + 0.004), rot=(0, 0, 5), mat="red", bevel=0.0, seg=1, anchor=(0, 0, -1))
    box("envelope_flap", (0.21, 0.004, 0.0006), loc=(x0 + 0.24, my - 0.03, mz + t + 0.004), rot=(0, 0, 5), mat="cream_dark", bevel=0.0, seg=1, anchor=(0, 0, -1))
    roll = cyl("letter_roll", 0.017, 0.19, loc=(x0 + 0.2, my + 0.045, mz + t + 0.0175), rot=(0, 90, 8), mat="paper", seg=16, bevel=0.002, anchor_bottom=False)
    _ = roll
    torus("letter_tie", 0.0178, 0.0016, loc=(x0 + 0.2, my + 0.045, mz + t + 0.0175), rot=(0, 90, 8), mat="twine", seg=16, ring=4)
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
