"""On the floor: the kilim rug with fringes, the monstera on a plant stand (back-right corner), a
snake plant between the door and the bookcase, a waste basket with a missed paper shot, and a floor cushion."""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from layout import BACK_Y, LEFT_X, PLANT, RUG
from lib.core import DEG, group
from lib.geo import box, cyl, from_bm, jitter, lathe, rrect, sphere, thick_profile, tube
from lib.plants import leaf_bm, place_bm


def rug():
    x, y, _ = RUG
    L, W = 2.6, 1.7
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    nx, ny = 26, 17
    grid = []
    r = jitter(3)
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            z = 0.009 + 0.0012 * math.sin(u * 9.1 + v * 3.3) * math.sin(v * 7.7)
            row.append((bm.verts.new((x - L / 2 + u * L, y - W / 2 + v * W, z)), u, v))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            q = (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
            f = bm.faces.new([a[0] for a in q])
            for loop, a in zip(f.loops, q):
                loop[uv].uv = (a[1], a[2])
    ob = from_bm("rug", bm, "rug_kilim", wn=False, smooth_angle=None)
    sol = ob.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.009
    sol.offset = -1
    ob.rotation_euler.z = 1.5 * DEG
    # fringes on the short ends
    fr = bmesh.new()
    for side in (-1, 1):
        n = 90
        for k in range(n):
            yy = y - W / 2 + 0.02 + (W - 0.04) * k / (n - 1)
            length = 0.055 + r.uniform(-0.008, 0.008)
            bend = r.uniform(-0.01, 0.01)
            p0 = Vector((x + side * L / 2, yy, 0.004))
            pts = [p0, p0 + Vector((side * length * 0.5, bend * 0.5, -0.001)), p0 + Vector((side * length, bend, -0.003))]
            cu = bpy.data.curves.new("f", "CURVE")
            cu.dimensions = "3D"
            cu.bevel_depth = 0.0022
            cu.bevel_resolution = 1
            sp = cu.splines.new("POLY")
            sp.points.add(len(pts) - 1)
            for pt, p in zip(sp.points, pts):
                pt.co = (*p, 1)
            tmp = bpy.data.objects.new("f", cu)
            bpy.context.scene.collection.objects.link(tmp)
            dg = bpy.context.evaluated_depsgraph_get()
            me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
            fr.from_mesh(me)
            bpy.data.meshes.remove(me)
            bpy.data.objects.remove(tmp)
            bpy.data.curves.remove(cu)
    fringe = from_bm("rug_fringe", fr, "fabric_oat", wn=False, smooth_angle=None)
    fringe.rotation_euler.z = 1.5 * DEG
    fringe.location = Vector((x, y, 0)) - Matrix.Rotation(1.5 * DEG, 4, "Z") @ Vector((x, y, 0))


def monstera():
    px, py, _ = PLANT
    # mid-century plant stand
    h = 0.16
    lathe("stand_top", [(0.0, 0.0), (0.2, 0.0), (0.205, 0.006), (0.2, 0.022), (0.0, 0.022)], loc=(px, py, h), mat="walnut", seg=48)
    for k in range(4):
        a = (45 + 90 * k) * DEG
        top = Vector((px + 0.15 * math.cos(a), py + 0.15 * math.sin(a), h))
        foot = Vector((px + 0.2 * math.cos(a), py + 0.2 * math.sin(a), 0.0))
        d = (top - foot)
        leg = cyl(f"stand_leg_{k}", 0.012, d.length, mat="walnut", r2=0.016, seg=16, bevel=0.002)
        leg.matrix_world = Matrix.Translation(foot) @ d.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    # pot
    z0 = h + 0.022
    lathe("monstera_pot", thick_profile([(0.13, 0.0), (0.14, 0.01), (0.165, 0.26), (0.175, 0.28), (0.175, 0.3)], 0.012), loc=(px, py, z0), mat="cream", seg=56)
    lathe("monstera_band", [(0.1685, 0.0), (0.172, 0.004), (0.172, 0.03), (0.1685, 0.034)], loc=(px, py, z0 + 0.19), mat="terracotta", seg=56)
    lathe("monstera_soil", [(0.0, 0.0), (0.16, 0.0), (0.0, 0.004)], loc=(px, py, z0 + 0.27), mat="soil", seg=32)
    r = jitter(17)
    leaves = []
    stems = []
    specs = [(-2.0, 0.78, 0.46), (-1.0, 0.95, 0.5), (0.2, 0.86, 0.44), (1.2, 1.05, 0.52), (2.3, 0.7, 0.4), (3.3, 0.92, 0.46), (4.3, 0.62, 0.36), (5.3, 1.12, 0.42)]
    base = Vector((px, py, z0 + 0.27))
    for k, (ang, height, size) in enumerate(specs):
        a = ang
        lean = 0.24 + 0.12 * (k % 3)
        tip = base + Vector((math.cos(a) * lean, math.sin(a) * lean, height))
        mid = base + Vector((math.cos(a) * lean * 0.35, math.sin(a) * lean * 0.35, height * 0.6))
        # keep the plant out of the walls
        tip.x = min(tip.x, 2.2)
        tip.y = min(tip.y, BACK_Y - 0.08)
        stems.append([base + Vector((r.uniform(-0.02, 0.02), r.uniform(-0.02, 0.02), 0)), mid, tip])
        out = Vector((math.cos(a), math.sin(a), 0.0))
        direction = (out * 0.9 + Vector((0, 0, -0.25))).normalized()
        lb = leaf_bm(size, size * 0.86, "monstera", droop=0.18, cup=0.1, nt=18, ns=12, slits=4)
        place_bm(lb, tip, direction, roll=r.uniform(-0.3, 0.3))
        leaves.append(lb)
    for k, pts in enumerate(stems):
        tube(f"monstera_stem_{k}", pts, 0.0065, mat="stem", res=10, bevel_res=2)
    out = bmesh.new()
    for lb in leaves:
        me = bpy.data.meshes.new("_l")
        lb.to_mesh(me)
        lb.free()
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
    ob = from_bm("monstera_leaves", out, "leaf_dark", wn=False, smooth_angle=None)
    sol = ob.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.002


def snake_plant():
    px, py = LEFT_X + 0.2, 0.215  # under the Kozan poster, clear of the bookcase
    lathe("snake_pot", thick_profile([(0.1, 0.0), (0.105, 0.01), (0.11, 0.24), (0.115, 0.25)], 0.008), loc=(px, py, 0), mat="terracotta", seg=48)
    lathe("snake_soil", [(0.0, 0.0), (0.104, 0.0), (0.0, 0.003)], loc=(px, py, 0.225), mat="soil", seg=24)
    r = jitter(23)
    blades = bmesh.new()
    for k in range(9):
        a = k * 137.5 * DEG
        rr = 0.015 + 0.006 * k
        h = r.uniform(0.42, 0.72)
        w = r.uniform(0.04, 0.055)
        lean = r.uniform(4, 14) * DEG
        twist = r.uniform(-0.6, 0.6)
        base = Vector((px + rr * math.cos(a), py + rr * math.sin(a), 0.22))
        n = 10
        left, right = [], []
        for i in range(n + 1):
            t = i / n
            half = w / 2 * (math.sin(math.pi * min(t * 1.15, 1)) ** 0.5) * (1 - t * 0.35)
            if i == n:
                half = 0.0
            ang = a + twist * t
            c = base + Vector((math.cos(a) * math.sin(lean) * h * t * t, math.sin(a) * math.sin(lean) * h * t * t, h * t))
            side = Vector((math.cos(ang + math.pi / 2), math.sin(ang + math.pi / 2), 0)) * half
            left.append(blades.verts.new(c - side))
            right.append(blades.verts.new(c + side))
        for i in range(n):
            blades.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    ob = from_bm("snake_blades", blades, "leaf_dark", wn=False, smooth_angle=None)
    sol = ob.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.004


def corner_things():
    # waste basket under the desk + a missed paper shot
    bx, by = -0.12, 2.0
    lathe("bin", thick_profile([(0.1, 0.0), (0.104, 0.008), (0.125, 0.3)], 0.004), loc=(bx, by, 0), mat="graphite", seg=6, smooth_angle=20)
    r = jitter(31)
    for k, (dx, dy, dz) in enumerate(((0.0, 0.01, 0.27), (0.05, -0.03, 0.28), (0.34, -0.36, 0.035))):
        ball = sphere(f"paper_ball_{k}", 0.035, loc=(bx + dx, by + dy, dz), mat="paper", seg=12, rings=8)
        for v in ball.data.vertices:
            v.co *= 1 + r.uniform(-0.22, 0.18)
        ball.data.shade_flat()
    # floor cushion near the rug
    rrect("cushion", 0.5, 0.5, 0.11, 0.18, loc=(1.62, -0.35, 0), rot=(0, 0, 18), mat="mustard", axis="Z", seg=8, bevel=0.04, bseg=5, anchor=(0, 0, -1))
    cyl("cushion_button", 0.016, 0.008, loc=(1.62, -0.35, 0.107), mat="ochre", seg=16, bevel=0.003)


def build():
    with group("rug", own="decor:rug", bake="room"):
        rug()
    with group("plants", own="decor:plants", bake="props"):
        monstera()
        snake_plant()
    with group("floor_things", own="decor:floor_things", bake="props"):
        corner_things()
