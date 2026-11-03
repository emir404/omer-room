"""obj__window — a deep cream casement (3×2 panes) in the back wall's opening, a proper sill with a
cactus and a Kozan orange, the farm view (display__window) just behind the sash, and ochre linen
curtains on a brass rod."""

import math

import bmesh

from layout import BACK_Y, WALL_T, WINDOW
from lib.core import group
from lib.geo import box, cyl, from_bm, jitter, lathe, plane, sphere, torus, tube

X, Z, W, H = WINDOW["x"], WINDOW["z"], WINDOW["w"], WINDOW["h"]
X0, X1, Z0, Z1 = X - W / 2, X + W / 2, Z - H / 2, Z + H / 2


def casing():
    cw, cd = 0.078, 0.022
    y = BACK_Y - cd / 2
    box("casing_l", (cw, cd, Z1 - Z0 + cw), loc=(X0 - cw / 2, y, Z0), mat="trim", bevel=0.005, anchor=(0, 0, -1))
    box("casing_r", (cw, cd, Z1 - Z0 + cw), loc=(X1 + cw / 2, y, Z0), mat="trim", bevel=0.005, anchor=(0, 0, -1))
    box("casing_head", (W + 2 * cw + 0.04, cd + 0.01, 0.09), loc=(X, BACK_Y - (cd + 0.01) / 2, Z1 + cw - 0.005), mat="trim", bevel=0.006, anchor=(0, 0, -1))
    box("casing_crown", (W + 2 * cw + 0.07, cd + 0.028, 0.022), loc=(X, BACK_Y - (cd + 0.028) / 2, Z1 + cw + 0.085), mat="trim", bevel=0.006, anchor=(0, 0, -1))
    # sill (stool) + apron
    box("sill", (W + 0.24, 0.17, 0.034), loc=(X, BACK_Y + 0.05 - 0.17 / 2 + 0.03, Z0 - 0.034), mat="trim", bevel=0.007, anchor=(0, 0, -1))
    box("apron", (W + 2 * cw, 0.02, 0.075), loc=(X, BACK_Y - 0.01, Z0 - 0.034 - 0.075), mat="trim", bevel=0.004, anchor=(0, 0, -1))


def sash():
    y = BACK_Y + WALL_T * 0.42
    d = 0.046
    fw = 0.05
    box("sash_l", (fw, d, H), loc=(X0 + fw / 2, y, Z0), mat="trim", bevel=0.004, anchor=(0, 0, -1))
    box("sash_r", (fw, d, H), loc=(X1 - fw / 2, y, Z0), mat="trim", bevel=0.004, anchor=(0, 0, -1))
    box("sash_t", (W - 2 * fw, d, fw), loc=(X, y, Z1 - fw), mat="trim", bevel=0.004, anchor=(0, 0, -1))
    box("sash_b", (W - 2 * fw, d + 0.006, fw + 0.012), loc=(X, y, Z0), mat="trim", bevel=0.004, anchor=(0, 0, -1))
    inner_w = W - 2 * fw
    for i in (1, 2):
        box(f"mullion_{i}", (0.026, d - 0.008, H - 2 * fw), loc=(X0 + fw + inner_w * i / 3, y, Z0 + fw), mat="trim", bevel=0.003, anchor=(0, 0, -1))
    box("meeting_rail", (inner_w, d, 0.036), loc=(X, y, Z0 + fw + (H - 2 * fw) * 0.52), mat="trim", bevel=0.003, anchor=(0, 0, -1))
    # brass latch on the meeting rail
    box("latch", (0.05, 0.012, 0.014), loc=(X, y - d / 2 - 0.006, Z0 + fw + (H - 2 * fw) * 0.52 + 0.018), mat="brass", bevel=0.003)
    # the farm view (live pixel texture at runtime), just behind the glass line
    plane("farm_view", W, H, loc=(X, BACK_Y + WALL_T * 0.42 + d / 2 + 0.01, Z), mat="screen_off", contract="display__window", bake="none")


def sill_things():
    y = BACK_Y + 0.0
    # cactus in a terracotta pot
    px, py = X0 + 0.13, y - 0.035
    lathe("cactus_pot", [(0.0, 0.0), (0.032, 0.0), (0.036, 0.004), (0.041, 0.052), (0.046, 0.056), (0.046, 0.066), (0.04, 0.066), (0.036, 0.06), (0.0, 0.06)],
          loc=(px, py, Z0), mat="terracotta", seg=36)
    lathe("cactus_soil", [(0.0, 0.0), (0.037, 0.0), (0.0, 0.002)], loc=(px, py, Z0 + 0.058), mat="soil", seg=24)
    body = lathe("cactus", [(0.0, 0.0), (0.024, 0.004), (0.03, 0.03), (0.029, 0.08), (0.022, 0.11), (0.012, 0.125), (0.0, 0.128)],
                 loc=(px, py, Z0 + 0.056), mat="leaf_dark", seg=16, smooth_angle=None)
    # ribs: scale every other ring vertex inward
    me = body.data
    for v in me.vertices:
        ang = math.atan2(v.co.y, v.co.x)
        k = 0.86 + 0.14 * abs(math.cos(ang * 4))
        v.co.x *= k
        v.co.y *= k
    lathe("cactus_arm", [(0.0, 0.0), (0.012, 0.004), (0.014, 0.03), (0.01, 0.048), (0.0, 0.052)],
          loc=(px + 0.03, py, Z0 + 0.1), rot=(0, 28, 0), mat="leaf_dark", seg=12)
    # a Kozan orange with its leaf
    ox, oy = X1 - 0.2, y - 0.03
    sphere("orange", 0.036, loc=(ox, oy, Z0 + 0.034), mat="orange", seg=28, rings=16, scale=(1, 1, 0.94))
    cyl("orange_stem", 0.003, 0.007, loc=(ox, oy, Z0 + 0.067), mat="stem", seg=8, bevel=0)
    leaf_bm = bmesh.new()
    pts = [(0, 0)] + [(0.05 * t, 0.012 * math.sin(math.pi * t)) for t in (0.2, 0.4, 0.6, 0.8)] + [(0.05, 0)] + [(0.05 * t, -0.012 * math.sin(math.pi * t)) for t in (0.8, 0.6, 0.4, 0.2)]
    verts = [leaf_bm.verts.new((x, yy, 0.004 * (x / 0.05) ** 2)) for x, yy in pts]
    leaf_bm.faces.new(verts)
    from_bm("orange_leaf", leaf_bm, "leaf", loc=(ox + 0.004, oy, Z0 + 0.07), rot=(10, -18, 40), wn=False)
    sphere("orange2", 0.033, loc=(ox + 0.07, oy + 0.01, Z0 + 0.031), mat="orange", seg=24, rings=14, scale=(1, 1, 0.93))


def curtains():
    rod_z, rod_y = Z1 + 0.15, BACK_Y - 0.1
    x_a, x_b = X0 - 0.36, X1 + 0.36
    tube("rod", [(x_a, rod_y, rod_z), (x_b, rod_y, rod_z)], 0.011, mat="brass", kind="POLY", res=1, bevel_res=4)
    for x in (x_a - 0.025, x_b + 0.025):
        sphere(f"finial_{x:.2f}", 0.024, loc=(x, rod_y, rod_z), mat="brass", seg=20, rings=12)
    for x in (x_a + 0.06, x_b - 0.06):
        box(f"bracket_{x:.2f}", (0.014, 0.1, 0.014), loc=(x, BACK_Y - 0.05, rod_z), mat="brass", bevel=0.003)
        cyl(f"rosette_{x:.2f}", 0.02, 0.008, loc=(x, BACK_Y, rod_z), rot=(90, 0, 0), mat="brass", seg=20, bevel=0.002)
    r = jitter(11)
    for side, (c0, c1) in (("l", (x_a + 0.01, X0 + 0.03)), ("r", (X1 - 0.03, x_b - 0.01))):
        width = c1 - c0
        top, bottom = rod_z - 0.03, 1.06
        nx, nz = 46, 26
        lam = 0.072
        bm = bmesh.new()
        rows = []
        phase = [r.uniform(-0.25, 0.25) for _ in range(nz + 1)]
        for j in range(nz + 1):
            s = j / nz
            z = top - s * (top - bottom) + (0.006 * math.sin(7 * s) if j == nz else 0)
            amp = 0.018 + 0.012 * s
            row = []
            for i in range(nx + 1):
                t = i / nx
                x = c0 + t * width
                ph = phase[j] * s
                y = rod_y + amp * math.sin(2 * math.pi * (x - c0) / lam + ph) + 0.004 * math.sin(2 * math.pi * (x - c0) / (lam * 3.7))
                # the outer edge falls a bit back toward the wall
                edge = (1 - t) if side == "l" else t
                y += 0.025 * edge**3 * s
                if j == nz:
                    z += 0.004 * math.sin(2 * math.pi * (x - c0) / lam * 0.5)
                row.append(bm.verts.new((x, y, z)))
            rows.append(row)
        for j in range(nz):
            for i in range(nx):
                bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
        cur = from_bm(f"curtain_{side}", bm, "curtain", wn=False, smooth_angle=None, own="decor:curtains")
        sol = cur.modifiers.new("solid", "SOLIDIFY")
        sol.thickness = 0.005
        sol.offset = 0
        # rings
        for k in range(7):
            x = c0 + 0.01 + k * (width - 0.02) / 6
            torus(f"ring_{side}{k}", 0.017, 0.0024, loc=(x, rod_y, rod_z), rot=(0, 90, 0), mat="brass", seg=20, ring=6, own="decor:curtains")


def build():
    with group("window", own="window", bake="props"):
        casing()
        sash()
        sill_things()
    with group("curtains", own="decor:curtains", bake="props"):
        curtains()
