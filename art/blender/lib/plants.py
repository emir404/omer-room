"""Leaves and vines: flat leaf blades from an outline (heart, lance, monstera with slits), cupped
and drooped, plus a helper to scatter leaves along a curve."""

import math

import bmesh
from mathutils import Matrix, Vector


def leaf_bm(length, width, kind="heart", droop=0.25, cup=0.15, nt=14, ns=8, slits=0):
    """A leaf blade along +Y (petiole at the origin), width along X, cupped in Z. Returns bmesh."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    grid = []
    t_start = -0.18 if kind in ("heart", "monstera") else 0.0
    for i in range(nt + 1):
        t = t_start + (1 - t_start) * i / nt
        if kind == "lance":
            hw = 0.5 * width * math.sin(math.pi * min(max(t, 0), 1)) ** 0.8 * (1 - 0.3 * t)
        else:
            tt = (t - t_start) / (1 - t_start)
            hw = 0.5 * width * (math.sin(math.pi * tt**0.85) ** 0.75)
        row = []
        for j in range(ns + 1):
            s = -1 + 2 * j / ns
            x = s * hw
            y = t * length
            if kind in ("heart", "monstera") and t < 0:
                y = t * length * (1 - 0.85 * (1 - abs(s)))  # basal lobes curve back
            z = cup * width * (s**2) * 0.5 - droop * length * max(t, 0) ** 2
            row.append((bm.verts.new((x, y, z)), (s + 1) / 2, (t - t_start) / (1 - t_start), s, t))
        grid.append(row)
    for i in range(nt):
        for j in range(ns):
            q = (grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])
            if slits and kind == "monstera":
                s_mid = (q[0][3] + q[1][3]) / 2
                t_mid = (q[0][4] + q[3][4]) / 2
                cut = False
                for k in range(slits):
                    tk = 0.2 + 0.65 * (k + 0.5) / slits
                    if abs(s_mid) > 0.32 and abs(t_mid - tk - 0.12 * abs(s_mid)) < 0.028:
                        cut = True
                if cut:
                    continue
            f = bm.faces.new([v[0] for v in q])
            for loop, v in zip(f.loops, q):
                loop[uv].uv = (v[1], v[2])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    return bm


def place_bm(bm, loc, direction, up=(0, 0, 1), roll=0.0):
    """Orient a leaf (built along +Y) so +Y points along `direction`."""
    d = Vector(direction).normalized()
    q = d.to_track_quat("Y", "Z")
    m = Matrix.Translation(Vector(loc)) @ q.to_matrix().to_4x4() @ Matrix.Rotation(roll, 4, "Y")
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm


def curve_points(pts, n=24):
    """Catmull-Rom through pts → n samples (positions + tangents)."""
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    segs = len(P) - 3
    for i in range(n + 1):
        u = i / n * segs
        k = min(int(u), segs - 1)
        t = u - k
        p0, p1, p2, p3 = P[k], P[k + 1], P[k + 2], P[k + 3]
        pos = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t**3)
        tan = 0.5 * ((-p0 + p2) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t * t)
        out.append((pos, tan.normalized()))
    return out
