"""Things on the walls: the crooked framed letter (obj__letter), the mini hoop + basketball
(obj__hoop; the ball is pivot__hoop_ball and is realtime-lit because it moves), two framed posters,
the string lights along the top of the walls (night light B), a light switch and an outlet."""

import math

import bmesh
from mathutils import Matrix, Vector

from layout import BACK_Y, BALL, BALL_R, DOOR, HOOP_BOARD, HOOP_RIM, LEFT_X, LETTER, ROOM_H
from lib.core import DEG, empty, group, tag
from lib.geo import box, cyl, frame, from_bm, plane, rrect, sphere, three_sphere, torus, tube


def letter():
    x, y, z = LETTER
    crooked = 3.5
    R = Matrix.Rotation(crooked * DEG, 4, "Y")
    depth = 0.032
    face_y = y - depth  # the frame's front face
    origin = Vector((x, face_y, z))

    def put(ob, local=(0, 0, 0)):
        ob.matrix_world = Matrix.Translation(origin + R @ Vector(local)) @ R
        return ob

    put(frame("letter_frame", 0.46, 0.6, 0.4, 0.54, depth, mat="walnut_dark", r=0.0, ir=0.0, seg=1, recess=0.012, inner_mat="paper", bevel=0.004))
    put(frame("letter_frame_lip", 0.414, 0.554, 0.4, 0.54, 0.004, mat="brass", r=0.0, ir=0.0, seg=1, bevel=0.0008), (0, -0.0004, 0))
    # the letter itself (live texture at runtime, lit by the room)
    disp = plane("letter_paper", 0.31, 0.42, mat="paper", contract="display__letter")
    put(disp, (0, 0.0114, 0.012))
    # hanging wire up to a nail
    nail = Vector((x - 0.01, y - 0.004, z + 0.42))
    cyl("letter_nail", 0.004, 0.012, loc=nail, rot=(90, 0, 0), mat="brass", seg=10, bevel=0.001, anchor_bottom=True)
    for s in (-1, 1):
        eye = origin + R @ Vector((s * 0.17, depth - 0.004, 0.26))
        tube(f"letter_wire_{s}", [eye, (eye + nail) / 2 + Vector((0, 0, 0.004)), nail + Vector((0, -0.004, -0.004))], 0.0009, mat="steel", kind="POLY", res=1, bevel_res=2)


def net_strands(center, r_top, r_bottom, height, n=12, levels=7):
    strands = []
    for fam in (1, -1):
        for i in range(n):
            pts = []
            for l in range(levels + 1):
                t = l / levels
                a = (i + fam * t * 1.5) * 2 * math.pi / n
                r = r_top + (r_bottom - r_top) * t
                zz = -height * t + 0.012 * math.sin(math.pi * t)
                pts.append(center + Vector((r * math.cos(a), r * math.sin(a), zz)))
            strands.append(pts)
    return strands


def hoop():
    bx, by, bz = HOOP_BOARD
    off = 0.06
    front = by - off - 0.022
    rrect("backboard", 0.6, 0.4, 0.022, 0.02, loc=(bx, by - off - 0.011, bz), mat="trim", axis="Y", seg=6, bevel=0.003)
    frame("board_stripe", 0.574, 0.374, 0.55, 0.35, 0.0012, loc=(bx, front - 0.0006, bz), mat="orange", r=0.012, ir=0.008, seg=4, bevel=0.0)
    frame("board_target", 0.24, 0.18, 0.214, 0.154, 0.0012, loc=(bx, front - 0.0006, bz - 0.085), mat="orange", r=0.0, ir=0.0, seg=1, bevel=0.0)
    for s in (-1, 1):
        box(f"board_bracket_{s}", (0.03, off, 0.05), loc=(bx + s * 0.2, by - off / 2, bz + 0.1), mat="steel", bevel=0.003)
    rx, ry, rz = HOOP_RIM
    box("rim_plate", (0.1, 0.012, 0.075), loc=(rx, front - 0.006, rz - 0.01), mat="orange", bevel=0.003)
    box("rim_arm", (0.05, front - (ry + 0.11) + 0.01, 0.016), loc=(rx, (front + ry + 0.11) / 2, rz), mat="orange", bevel=0.003)
    tube("rim_brace", [(rx, front - 0.004, rz - 0.045), (rx, (front + ry + 0.1) / 2, rz - 0.025), (rx, ry + 0.1, rz - 0.004)], 0.0045, mat="orange", res=6)
    torus("rim", 0.11, 0.0085, loc=(rx, ry, rz), mat="orange", seg=56, ring=10)
    for k in range(12):
        a = k * 2 * math.pi / 12
        torus(f"net_hook_{k}", 0.006, 0.0014, loc=(rx + 0.11 * math.cos(a), ry + 0.11 * math.sin(a), rz - 0.009), rot=(0, 90, math.degrees(a) + 90), mat="steel", seg=10, ring=5)
    for i, pts in enumerate(net_strands(Vector((rx, ry, rz - 0.012)), 0.108, 0.072, 0.2)):
        tube(f"net_{i}", pts, 0.0016, mat="net", kind="POLY", res=1, bevel_res=1)
    torus("net_bottom", 0.072, 0.0018, loc=(rx, ry, rz - 0.212), mat="net", seg=36, ring=5)
    # the ball (moves at runtime: realtime-lit, no lightmap, no baked shadow)
    pivot = empty("ball_pivot", BALL)
    tag(pivot, contract="pivot__hoop_ball", own="hoop")
    ball = three_sphere("ball", BALL_R, mat="basketball", ws=64, hs=32, pivot="hoop_ball", dynamic=True, bake="none", shadow=False)
    ball.parent = pivot
    ball.location = (0, 0, 0)
    ball.rotation_euler = (0.3, 0.5, 0.2)
    hit = box("ball_hit", (0.3, 0.3, 0.3), mat="#ff00ff", bevel=0, contract="hit__hoop", bake="none", shadow=False)
    hit.parent = pivot
    hit.location = (0, 0, 0)
    lab = empty("ball_label", (0, 0, 0.26), parent=pivot)
    tag(lab, contract="label__hoop")
    anchor = empty("rim_anchor", HOOP_RIM)
    tag(anchor, contract="anchor__hoop_rim", own="hoop")


def posters():
    # back wall, right of the window: the money poster
    for name, tex, loc, rot, size in (
        ("poster_money", "poster_money", (1.86, BACK_Y, 1.78), (0, 0, 0), (0.4, 0.55)),
        ("poster_kozan", "poster_kozan", (LEFT_X, 0.06, 1.6), (0, 0, 90), (0.42, 0.578)),
    ):
        R = Matrix.Rotation(rot[2] * DEG, 4, "Z")
        w, h = size
        depth = 0.022
        base = Vector(loc) + R @ Vector((0, -depth, 0))
        fr = frame(f"{name}_frame", w + 0.03, h + 0.03, w, h, depth, mat="ink" if name == "poster_money" else "oak", r=0.0, ir=0.0, seg=1, recess=0.008, inner_mat="paper", bevel=0.002)
        fr.matrix_world = Matrix.Translation(base) @ R
        pl = plane(f"{name}_print", w - 0.002, h - 0.002, mat=tex)
        pl.matrix_world = Matrix.Translation(base + R @ Vector((0, 0.0075, 0))) @ R


def string_lights():
    bulbs = []
    wire_y = BACK_Y - 0.035
    top = ROOM_H - 0.16
    hooks_back = [(-2.18, top), (-0.75, top + 0.01), (0.62, top), (2.12, top + 0.01)]
    hooks_left = [(2.18, top), (1.05, top + 0.01), (-0.1, top)]
    runs = []
    for (x0, z0), (x1, z1) in zip(hooks_back, hooks_back[1:]):
        runs.append([(Vector((x0, wire_y, z0)), Vector((x1, wire_y, z1)))])
    wire_x = LEFT_X + 0.035
    for (y0, z0), (y1, z1) in zip(hooks_left, hooks_left[1:]):
        runs.append([(Vector((wire_x, y0, z0)), Vector((wire_x, y1, z1)))])
    k = 0
    for run in runs:
        for a, b in run:
            sag = 0.14 * (a - b).length / 1.4
            pts = []
            n = 16
            for i in range(n + 1):
                t = i / n
                p = a.lerp(b, t)
                p.z -= sag * 4 * t * (1 - t)
                pts.append(p)
            tube(f"string_wire_{k}", pts, 0.0012, mat="ink", kind="POLY", res=1, bevel_res=1)
            cyl(f"string_hook_{k}", 0.004, 0.03, loc=a, rot=(90, 0, 0) if abs(a.y - wire_y) < 1e-3 else (0, -90, 0), mat="brass", seg=8, bevel=0.001, anchor_bottom=False)
            count = max(3, int((a - b).length / 0.2))
            for j in range(1, count):
                t = j / count
                p = a.lerp(b, t)
                p.z -= sag * 4 * t * (1 - t)
                bulbs.append(p.copy())
            k += 1
    for i, p in enumerate(bulbs):
        cyl(f"socket_{i}", 0.0045, 0.014, loc=p + Vector((0, 0, -0.016)), mat="ink", seg=10, bevel=0.0008)
        sphere(f"bulb_{i}", 0.0095, loc=p + Vector((0, 0, -0.026)), mat="bulb_string", seg=10, rings=6, scale=(1, 1, 1.25), bake="none", glow="string", shadow=False)
    return bulbs


def fittings():
    # light switch beside the door
    sy = DOOR["y"] + DOOR["w"] / 2 + 0.17
    rrect("switch_plate", 0.075, 0.115, 0.008, 0.006, loc=(LEFT_X + 0.004, sy, 1.18), rot=(0, 0, 90), mat="cream", axis="Y", seg=3, bevel=0.0015)
    box("switch_toggle", (0.012, 0.018, 0.03), loc=(LEFT_X + 0.012, sy, 1.18), rot=(0, -10, 0), mat="cream_dark", bevel=0.003)
    # outlet behind the desk, with the plugs
    rrect("outlet_plate", 0.075, 0.115, 0.008, 0.006, loc=(0.92, BACK_Y - 0.004, 0.3), mat="cream", axis="Y", seg=3, bevel=0.0015)
    for k, dz in enumerate((0.025, -0.025)):
        cyl(f"plug_{k}", 0.014, 0.028, loc=(0.92, BACK_Y - 0.008, 0.3 + dz), rot=(90, 0, 0), mat="ink", seg=16, bevel=0.003)


def build():
    with group("letter", own="letter", bake="props"):
        letter()
    with group("hoop", own="hoop", bake="props"):
        hoop()
    with group("posters", own="decor:posters", bake="props"):
        posters()
    with group("string_lights", own="decor:string_lights", bake="props"):
        string_lights()
    with group("fittings", own="decor:fittings", bake="props"):
        fittings()
