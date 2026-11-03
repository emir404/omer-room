"""obj__computer — a retro-modern 4:3 monitor (cream plastic, deep back, chunky chin), a 60%
keyboard with real keycaps, a pebble mouse, a felt desk mat and the cables.
The screen quad (screen__computer) is exactly 0.52 × 0.39 m so the 640×480 ÖmerOS UI sits on it."""

import math

import bmesh
from mathutils import Matrix, Vector

from layout import COMPUTER, SCREEN
from lib.core import DEG, group, tag
from lib.geo import box, cyl, frame, join_bms, keycap_bm, lathe, loft, plane, rrect, text, tube, from_bm
from lib.mats import M

U = 0.0186  # key pitch


def monitor():
    x0, _, top = COMPUTER
    glass_y = SCREEN["y"] + 0.0006
    front_y = glass_y - 0.009
    bw, bh = 0.48, 0.438
    chin = 0.078
    top_margin = 0.04  # bezel above the glass; the rest of the height becomes the chin
    bz = SCREEN["z"] + SCREEN["h"] / 2 + top_margin - bh / 2
    opening = (SCREEN["w"] + 0.018, SCREEN["h"] + 0.018)
    ioff_z = SCREEN["z"] - bz

    frame("bezel", bw, bh, opening[0], opening[1], 0.032, loc=(x0, front_y, bz), mat="cream", r=0.034, ir=0.01, seg=8,
          recess=0.009, inner_mat="screen_off", ioff=(0, ioff_z), bevel=0.0035)
    # the screen itself (DOM host): a hair in front of the dark glass
    plane("screen", SCREEN["w"], SCREEN["h"], loc=(x0, SCREEN["y"], SCREEN["z"]), mat="screen_off",
          contract="screen__computer", bake="none", own="computer")

    # deep, tapered back shell
    by = front_y + 0.032
    loft("housing", [
        (bw - 0.014, bh - 0.014, 0.03, 0.0),
        (bw - 0.024, bh - 0.024, 0.04, 0.03),
        (bw - 0.085, bh - 0.08, 0.07, 0.13),
        (bw - 0.165, bh - 0.15, 0.065, 0.2),
        (bw - 0.19, bh - 0.175, 0.05, 0.218),
    ], loc=(x0, by, bz + 0.008), mat="cream_dark", seg=8)

    # chin details: badge, knobs, power LED
    chin_z = bz - bh / 2 + chin * 0.48
    text("badge", "ÖmerOS", 0.0125, loc=(x0, front_y - 0.0004, chin_z), rot=(90, 0, 0), mat="graphite", extrude=0.0005)
    for i, dx in enumerate((0.155, 0.175)):
        cyl(f"knob_{i}", 0.0052, 0.004, loc=(x0 + dx, front_y, chin_z), rot=(90, 0, 0), mat="cream_dark", seg=20, bevel=0.0012, anchor_bottom=True)
    cyl("led", 0.0028, 0.002, loc=(x0 + 0.198, front_y, chin_z), rot=(90, 0, 0), mat="led_green", seg=16, bevel=0.0006, bake="none", glow="monitor")
    for i in range(5):
        box(f"grille_{i}", (0.04, 0.0016, 0.0022), loc=(x0 - 0.175, front_y - 0.0002, chin_z + 0.01 - i * 0.005), mat="graphite", bevel=0.0006, seg=1)

    # neck + tilt-swivel foot
    loft("neck", [
        (0.11, 0.045, 0.018, 0.0),
        (0.09, 0.04, 0.016, 0.1),
        (0.085, 0.04, 0.016, 0.2),
    ], loc=(x0, by + 0.085, top + 0.012), rot=(0, 0, 0), mat="cream_dark", axis="Z", seg=6)
    lathe("foot", [(0.0, 0.0), (0.112, 0.0), (0.116, 0.004), (0.114, 0.012), (0.095, 0.018), (0.055, 0.02), (0.0, 0.021)],
          loc=(x0, by + 0.075, top), mat="cream", seg=56)

    # sticky notes on the bezel
    for i, (dx, dz, ang, col) in enumerate(((0.215, 0.165, 8, "yellow"), (0.228, 0.1, -6, "pink"))):
        note = plane(f"note_{i}", 0.055, 0.055, loc=(x0 + dx, front_y - 0.0015 - i * 0.0004, bz + dz), rot=(0, ang, 0), mat=col)
        sd = note.modifiers.new("curl", "SIMPLE_DEFORM")
        sd.deform_method = "BEND"
        sd.deform_axis = "X"
        sd.angle = -18 * DEG
    return bz


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
    # monitor power + video, down the back of the desk to the floor
    tube("monitor_cable", [(x0 + 0.04, 2.1, bz - 0.05), (x0 + 0.06, 2.16, top + 0.04), (x0 + 0.08, 2.2, top - 0.05),
                           (x0 + 0.1, 2.21, 0.35), (x0 + 0.14, 2.2, 0.03), (x0 + 0.4, 2.17, 0.012), (x0 + 0.75, 2.2, 0.012)], 0.0035, mat="ink", res=12)


def build():
    with group("computer", own="computer", bake="props"):
        bz = monitor()
        keyboard()
        mouse_and_mat()
        cables(bz)
