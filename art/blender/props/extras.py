"""Lived-in details: a wall clock over the door, a backpack against the desk, high-tops by the mat."""

import math

import bmesh
from mathutils import Matrix, Vector

from layout import DOOR, LEFT_X
from lib.core import DEG, group
from lib.geo import box, cyl, from_bm, lathe, loft, rrect, torus, tube


def clock():
    y, z = DOOR["y"], 2.56
    R = Matrix.Translation((LEFT_X, y, z)) @ Matrix.Rotation(90 * DEG, 4, "Y")  # local +Z → +X (into the room)

    def put(ob, local=(0, 0, 0), rot=Matrix.Identity(4)):
        ob.matrix_world = R @ Matrix.Translation(local) @ rot
        return ob

    put(lathe("clock_body", [(0.0, 0.0), (0.15, 0.0), (0.152, 0.004), (0.15, 0.034), (0.142, 0.04), (0.13, 0.038), (0.128, 0.03), (0.0, 0.03)], mat="ink", seg=64))
    put(lathe("clock_face", [(0.0, 0.0), (0.128, 0.0), (0.0, 0.001)], mat="paper", seg=64), (0, 0, 0.03))
    for h in range(12):
        a = h * 30 * DEG
        long = h % 3 == 0
        tick = box(f"clock_tick_{h}", (0.006 if long else 0.004, 0.022 if long else 0.014, 0.002), mat="ink", bevel=0.0005, seg=1)
        r = 0.108 if long else 0.112
        put(tick, (math.sin(a) * r, math.cos(a) * r, 0.0315), Matrix.Rotation(-a, 4, "Z"))
    # 10:10, the watchmaker's smile
    for name, ang, length, width, col in (("clock_hour", -60, 0.062, 0.008, "ink"), ("clock_minute", 60, 0.092, 0.005, "ink"), ("clock_second", 168, 0.1, 0.0018, "orange")):
        hand = box(name, (width, length, 0.0016), mat=col, bevel=0.0004, seg=1, anchor=(0, -1, 0))
        put(hand, (0, 0, 0.034 + (0.002 if name == "clock_second" else 0)), Matrix.Rotation(-ang * DEG, 4, "Z") @ Matrix.Translation((0, -0.014, 0)))
    put(cyl("clock_cap", 0.007, 0.005, mat="brass", seg=16, bevel=0.0015), (0, 0, 0.034))
    put(torus("clock_glass_rim", 0.13, 0.003, mat="brass", seg=64, ring=6), (0, 0, 0.038))


def backpack():
    base = Vector((1.53, 1.43, 0.0))
    lean = Matrix.Translation(base) @ Matrix.Rotation(-28 * DEG, 4, "Z") @ Matrix.Rotation(-12 * DEG, 4, "X")

    def put(ob, local=(0, 0, 0), rot=Matrix.Identity(4)):
        ob.matrix_world = lean @ Matrix.Translation(local) @ rot
        return ob

    put(loft("pack_body", [(0.3, 0.15, 0.06, 0.0), (0.31, 0.16, 0.065, 0.06), (0.3, 0.155, 0.065, 0.3), (0.26, 0.14, 0.06, 0.38), (0.16, 0.1, 0.045, 0.42)],
             mat="sage", axis="Z", seg=8), (0, 0, 0.0))
    put(loft("pack_pocket", [(0.22, 0.05, 0.03, 0.0), (0.23, 0.06, 0.03, 0.04), (0.2, 0.055, 0.028, 0.17), (0.18, 0.03, 0.02, 0.2)], mat="terracotta", axis="Z", seg=6),
        (0, -0.09, 0.05))
    put(box("pack_zip", (0.21, 0.004, 0.006), mat="ink", bevel=0.001, seg=1), (0, -0.142, 0.2))
    put(box("pack_pull", (0.008, 0.006, 0.03), mat="steel", bevel=0.0015), (0.08, -0.146, 0.188))
    put(box("pack_patch", (0.06, 0.004, 0.04), mat="mustard", bevel=0.0015), (0, -0.147, 0.12))
    for s in (-1, 1):
        put(tube(f"pack_strap_{s}", [(s * 0.07, 0.075, 0.38), (s * 0.09, 0.1, 0.28), (s * 0.1, 0.105, 0.14), (s * 0.08, 0.08, 0.04)], 0.012, mat="ink", res=10, bevel_res=2))
    put(torus("pack_handle", 0.035, 0.007, mat="ink", seg=24, ring=8, arc=180), (0, 0.02, 0.415), Matrix.Rotation(90 * DEG, 4, "X"))


def sneaker(name, loc, yaw, color="cream", accent="red"):
    M = Matrix.Translation(loc) @ Matrix.Rotation(yaw * DEG, 4, "Z")

    def put(ob, local=(0, 0, 0), rot=Matrix.Identity(4)):
        ob.matrix_world = M @ Matrix.Translation(local) @ rot
        return ob

    put(rrect(f"{name}_sole", 0.1, 0.29, 0.026, 0.045, mat="cream_dark", axis="Z", seg=8, bevel=0.006, anchor=(0, 0, -1)))
    put(rrect(f"{name}_sole_line", 0.102, 0.292, 0.006, 0.046, mat=accent, axis="Z", seg=8, bevel=0.002, anchor=(0, 0, -1)), (0, 0, 0.02))
    # the upper: toe box → high collar
    put(loft(f"{name}_upper", [(0.094, 0.28, 0.044, 0.0, 0.0), (0.092, 0.27, 0.042, 0.02, 0.004), (0.084, 0.22, 0.036, 0.05, 0.026), (0.078, 0.15, 0.032, 0.085, 0.056)],
             mat=color, axis="Z", seg=8), (0, 0, 0.024))
    put(loft(f"{name}_collar", [(0.086, 0.12, 0.04, 0.0), (0.084, 0.11, 0.038, 0.06), (0.08, 0.1, 0.036, 0.1)], mat=color, axis="Z", seg=8), (0, 0.075, 0.09))
    for s in (-1, 1):
        put(box(f"{name}_stripe_{s}", (0.002, 0.1, 0.022), mat=accent, bevel=0.0008, seg=1), (s * 0.046, 0.04, 0.062), Matrix.Rotation(-12 * DEG, 4, "X"))
    for k in range(4):
        put(box(f"{name}_lace_{k}", (0.05, 0.006, 0.004), mat="paper", bevel=0.001, seg=1), (0, -0.04 + k * 0.03, 0.112 + k * 0.012), Matrix.Rotation(18 * DEG, 4, "X"))
    put(box(f"{name}_tongue", (0.04, 0.012, 0.05), mat=accent, bevel=0.004), (0, 0.06, 0.2), Matrix.Rotation(-20 * DEG, 4, "X"))


def build():
    with group("extras", own="decor:extras", bake="props"):
        clock()
        backpack()
        sneaker("shoe_l", (LEFT_X + 0.52, DOOR["y"] + 0.42, 0.0), -24)
        sneaker("shoe_r", (LEFT_X + 0.68, DOOR["y"] + 0.33, 0.0), -8)
