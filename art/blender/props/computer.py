"""obj__computer — a slim 16:10 display on a cream stand (the live desktop UI sits on its screen),
a 60% keyboard with real keycaps, a pebble mouse, a felt desk mat and the cables.
The screen quad (screen__computer) is SCREEN["w"] × SCREEN["h"]; the site lays its DOM desktop out at
the same 16:10 and maps it onto the quad (src/components/room/ScreenProjector.tsx)."""

import math

import bmesh
from mathutils import Matrix, Vector

from layout import COMPUTER, SCREEN
from lib.core import DEG, group, tag
from lib.geo import box, cyl, frame, join_bms, keycap_bm, lathe, loft, plane, rrect, text, tube, from_bm
from lib.mats import M

U = 0.0186  # key pitch


def monitor():
    """A thin display: black glass around the picture, a cream body with an iMac-style chin, and an
    angled arm on a flat foot. Returns the body's lowest z (for the cable)."""
    x0, _, top = COMPUTER
    sw, sh, sz = SCREEN["w"], SCREEN["h"], SCREEN["z"]
    glass_y = SCREEN["y"] + 0.0007  # the black glass sits a hair behind the picture
    border = 0.0085
    chin = 0.036
    gw, gh = sw + 2 * border, sh + 2 * border
    bw = gw + 0.008
    body_top = sz + gh / 2 + 0.004
    bh = gh + chin + 0.008
    body_z = body_top - bh / 2
    body_d = 0.024
    body_y = glass_y + 0.0012 + body_d / 2
    rrect("display_body", bw, bh, body_d, 0.013, loc=(x0, body_y, body_z), mat="cream", axis="Y", seg=8, bevel=0.0025, bseg=2)
    rrect("display_glass", gw, gh, 0.0016, 0.007, loc=(x0, glass_y + 0.0003, sz), mat="screen_off", axis="Y", seg=6, bevel=0.0005, bseg=1)
    # the picture itself (the DOM desktop is mapped onto it); hidden from the bake, cut out at runtime
    plane("screen", sw, sh, loc=(x0, SCREEN["y"], sz), mat="screen_off", contract="screen__computer", bake="none", own="computer")
    # a small LED in the chin, glowing with the monitor at night
    cyl("led", 0.0022, 0.0015, loc=(x0, body_y - body_d / 2 - 0.0002, body_z - bh / 2 + chin * 0.45), rot=(90, 0, 0), mat="led_green", seg=12, bevel=0.0005,
        bake="none", glow="monitor", anchor_bottom=True)
    # stand: a flat foot and an arm leaning back to the body
    foot_y = body_y + 0.075
    rrect("stand_foot", 0.19, 0.15, 0.007, 0.03, loc=(x0, foot_y, top), mat="cream", axis="Z", seg=8, bevel=0.0018, bseg=2, anchor=(0, 0, -1))
    a = Vector((x0, foot_y + 0.035, top + 0.006))
    b = Vector((x0, body_y + body_d / 2 - 0.004, body_z + 0.02))
    d = b - a
    angle = math.atan2(-d.y, d.z)
    box("stand_arm", (0.1, 0.014, d.length), loc=(a + b) / 2, rot=(math.degrees(angle), 0, 0), mat="cream", bevel=0.003, seg=2)
    box("stand_hinge", (0.104, 0.024, 0.03), loc=b + Vector((0, 0.004, 0)), mat="cream_dark", bevel=0.004, seg=2)
    return body_z - bh / 2, body_top


def keyboard():
    x0, y0, top = COMPUTER
    cx, cy = x0, 1.625
    tilt = 4.5
    rows = [
        [(1, "accent")] + [(1, "mod")] * 12 + [(1, "mod")] * 1 + [(1, "mod")],  # function row (short keys)
        [(1, "alpha")] * 13 + [(2, "mod")],
        [(1.5, "mod")] + [(1, "alpha")] * 12 + [(1.5, "mod")],
        [(1.75, "mod")] + [(1, "alpha")] * 11 + [(2.25, "enter")],
        [(2.25, "mod")] + [(1, "alpha")] * 10 + [(2.75, "mod")],
        [(1.25, "mod")] * 3 + [(6.25, "alpha")] + [(1.25, "mod")] * 4,
    ]
    width = 15 * U
    depth = (len(rows) - 0.25) * U
    case_w, case_d, case_h = width + 0.022, depth + 0.024, 0.016
    rot = (tilt, 0, 0)
    pivot = Matrix.Translation((cx, cy, top)) @ Matrix.Rotation(tilt * DEG, 4, "X")
    case = rrect("kb_case", case_w, case_d, case_h, 0.008, loc=(0, 0, 0), mat="cream", axis="Z", seg=6, bevel=0.003, anchor=(0, 0, -1))
    case.matrix_world = pivot
    # a recessed plate the keys sit in
    plate = rrect("kb_plate", width + 0.004, depth + 0.004, 0.002, 0.004, mat="cream_dark", axis="Z", seg=4, bevel=0.0006, anchor=(0, 0, -1))
    plate.matrix_world = pivot @ Matrix.Translation((0, 0, case_h - 0.0005))

    groups = {"alpha": [], "mod": [], "accent": [], "enter": []}
    y = depth / 2
    for ri, row in enumerate(rows):
        h = U * (0.75 if ri == 0 else 1.0)
        x = -width / 2
        for w, kind in row:
            kw = w * U
            bm = keycap_bm(kw, h, 0.0078 if ri else 0.0062)
            m = pivot @ Matrix.Translation((x + kw / 2, y - h / 2, case_h + 0.001))
            groups[kind].append((bm, m))
            x += kw
        y -= h
    colors = {"alpha": "cream", "mod": "fabric_oat", "accent": "orange", "enter": "mustard"}
    for kind, parts in groups.items():
        if not parts:
            continue
        from_bm(f"keys_{kind}", join_bms(parts), colors[kind], smooth_angle=45, wn=False)
    return pivot


def mouse_and_mat():
    x0, _, top = COMPUTER
    rrect("desk_mat", 0.74, 0.27, 0.003, 0.02, loc=(x0 + 0.08, 1.63, top), mat="felt", axis="Z", seg=6, bevel=0.0012, anchor=(0, 0, -1))
    mx, my = x0 + 0.29, 1.615
    loft("mouse", [
        (0.058, 0.098, 0.026, 0.0),
        (0.06, 0.1, 0.027, 0.01),
        (0.054, 0.094, 0.025, 0.02),
        (0.036, 0.07, 0.016, 0.029),
        (0.012, 0.03, 0.005, 0.033),
    ], loc=(mx, my, top + 0.003), rot=(0, 0, 4), mat="cream", axis="Z", seg=8)
    box("mouse_split", (0.0012, 0.045, 0.004), loc=(mx + 0.0012, my + 0.026, top + 0.033), rot=(14, 0, 4), mat="cream_dark", bevel=0.0004, seg=1)
    tube("mouse_cable", [(mx + 0.004, my + 0.05, top + 0.006), (mx + 0.012, my + 0.1, top + 0.005), (mx - 0.03, my + 0.2, top + 0.004),
                         (mx - 0.12, my + 0.3, top + 0.004), (mx - 0.2, my + 0.4, top + 0.006)], 0.0019, mat="cream_dark", res=10)


def cables(bz):
    x0, _, top = COMPUTER
    # monitor power + video, from the stand's hinge down the back of the desk to the floor
    tube("monitor_cable", [(x0 + 0.02, 1.95, bz + 0.03), (x0 + 0.05, 2.06, top + 0.03), (x0 + 0.08, 2.2, top - 0.05),
                           (x0 + 0.1, 2.21, 0.35), (x0 + 0.14, 2.2, 0.03), (x0 + 0.4, 2.17, 0.012), (x0 + 0.75, 2.2, 0.012)], 0.0035, mat="ink", res=12)


def hit_box(lo, hi):
    """The computer's click proxy: monitor, keyboard and mouse only. The default box (bounds of every
    part) would include the desk mat and the floor cable, and swallow the phone next to it."""
    lo, hi = Vector(lo), Vector(hi)
    hit = box("hit_computer", tuple(hi - lo), loc=(lo + hi) / 2, mat="#ff00ff", bevel=0, contract="hit__computer", own="computer")
    hit.modifiers.clear()
    return hit


def build():
    with group("computer", own="computer", bake="props"):
        bz, body_top = monitor()
        keyboard()
        mouse_and_mat()
        cables(bz)
    x0, _, top = COMPUTER
    hit_box((x0 - SCREEN["w"] / 2 - 0.03, 1.5, top), (x0 + 0.33, 2.06, body_top + 0.012))
