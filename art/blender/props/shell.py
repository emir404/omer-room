"""The room shell: a cutaway diorama. Floor slab (oak planks), back wall with the window opening,
left wall with the door opening, sage wainscot with panel moldings, chair rail, baseboards, and the
dark section color on every cut face so it reads like an architect's model."""

import bmesh

from layout import BACK_Y, DOOR, FLOOR_T, LEFT_X, ROOM_H, ROOM_W, WALL_T, WINDOW
from lib.core import group
from lib.geo import box, frame, from_bm
from lib.mats import M

HALF = ROOM_W / 2
WAIN_H = 0.92  # top of the chair rail
WAIN_T = 0.014


def slab(name, x0, x1, y0, y1, z0, z1, faces, mats, own):
    """Axis-aligned box with only the listed faces: faces = {"+x": mat, "-y": mat, ...}.
    UV0 is planar (meters) so textured faces tile predictably."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    corners = {
        "-x": ((x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)),
        "+x": ((x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)),
        "-y": ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)),
        "+y": ((x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)),
        "-z": ((x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)),
        "+z": ((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)),
    }
    mat_list = []
    for key, mat in faces.items():
        if mat not in mat_list:
            mat_list.append(mat)
        f = bm.faces.new([bm.verts.new(c) for c in corners[key]])
        f.material_index = mat_list.index(mat)
        for loop in f.loops:
            x, y, z = loop.vert.co
            if key in ("+z", "-z"):
                loop[uv].uv = ((x + HALF) / ROOM_W, (y + HALF) / ROOM_W)
            elif key in ("-x", "+x"):
                loop[uv].uv = (y, z)
            else:
                loop[uv].uv = (x, z)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return from_bm(name, bm, [M(m) for m in mat_list], wn=False, smooth_angle=10, own=own)


def walls():
    x_out, y_out = LEFT_X - WALL_T, BACK_Y + WALL_T
    wx0, wx1 = WINDOW["x"] - WINDOW["w"] / 2, WINDOW["x"] + WINDOW["w"] / 2
    wz0, wz1 = WINDOW["z"] - WINDOW["h"] / 2, WINDOW["z"] + WINDOW["h"] / 2
    zb = -FLOOR_T  # walls stand on the slab's underside so the section reads as one piece
    own = "decor:wall_back"
    # back wall (inner face −y is plaster; the right end +x and the top are cut faces)
    slab("wall_back_l", x_out, wx0, BACK_Y, y_out, zb, ROOM_H, {"-y": "plaster", "+x": "plaster", "+z": "wall_cut"}, None, own)
    slab("wall_back_r", wx1, HALF, BACK_Y, y_out, zb, ROOM_H, {"-y": "plaster", "-x": "plaster", "+z": "wall_cut", "+x": "wall_cut"}, None, own)
    slab("wall_back_b", wx0, wx1, BACK_Y, y_out, zb, wz0, {"-y": "plaster", "+z": "plaster"}, None, own)
    slab("wall_back_t", wx0, wx1, BACK_Y, y_out, wz1, ROOM_H, {"-y": "plaster", "-z": "plaster", "+z": "wall_cut"}, None, own)
    # left wall (inner face +x), door opening near the front
    dy0, dy1 = DOOR["y"] - DOOR["w"] / 2, DOOR["y"] + DOOR["w"] / 2
    own = "decor:wall_left"
    slab("wall_left_b", x_out, LEFT_X, dy1, BACK_Y, zb, ROOM_H, {"+x": "plaster", "-y": "plaster", "+z": "wall_cut"}, None, own)
    slab("wall_left_f", x_out, LEFT_X, -HALF, dy0, zb, ROOM_H, {"+x": "plaster", "+y": "plaster", "+z": "wall_cut", "-y": "wall_cut"}, None, own)
    slab("wall_left_t", x_out, LEFT_X, dy0, dy1, DOOR["h"], ROOM_H, {"+x": "plaster", "-z": "plaster", "+z": "wall_cut"}, None, own)


def floor():
    x_out, y_out = LEFT_X - WALL_T, BACK_Y + WALL_T
    slab("floor_top", LEFT_X, HALF, -HALF, BACK_Y, -FLOOR_T, 0.0, {"+z": "floor_planks"}, None, "decor:floor")
    slab("floor_cut", LEFT_X, HALF, -HALF, BACK_Y, -FLOOR_T, 0.0, {"-y": "floor_edge", "+x": "floor_edge"}, None, "decor:floor_edge")
    # a slightly inset dark plinth under the model
    slab("plinth", x_out + 0.03, HALF - 0.03, -HALF + 0.03, y_out - 0.03, -FLOOR_T - 0.05, -FLOOR_T, {"-y": "wall_cut", "+x": "wall_cut"}, None, "decor:floor_edge")
    # threshold strip under the door
    dy0, dy1 = DOOR["y"] - DOOR["w"] / 2, DOOR["y"] + DOOR["w"] / 2
    box("threshold", (WALL_T + 0.04, DOOR["w"], 0.012), loc=(LEFT_X - WALL_T / 2 + 0.02, DOOR["y"], 0.0), mat="oak", bevel=0.003, anchor=(0, 0, -1), own="decor:floor_edge")


def wainscot_run(prefix, axis, a0, a1, wall_face, own):
    """Sage boards + panel moldings + chair rail + baseboard along one wall segment.
    axis "x": runs along x on the back wall (face at y = wall_face, room side −y).
    axis "y": runs along y on the left wall (face at x = wall_face, room side +x)."""
    length = a1 - a0
    if length < 0.05:
        return
    mid = (a0 + a1) / 2

    def put(name, size_along, size_out, size_z, z, along=None, out=0.0, mat="wainscot", bevel=0.003):
        c = mid if along is None else along
        if axis == "x":
            box(name, (size_along, size_out, size_z), loc=(c, wall_face - out - size_out / 2, z), mat=mat, bevel=bevel, anchor=(0, 0, -1), own=own)
        else:
            box(name, (size_out, size_along, size_z), loc=(wall_face + out + size_out / 2, c, z), mat=mat, bevel=bevel, anchor=(0, 0, -1), own=own)

    put(f"{prefix}_boards", length, WAIN_T, WAIN_H - 0.03, 0.0, bevel=0.0)
    put(f"{prefix}_rail", length, 0.026, 0.034, WAIN_H - 0.034, mat="trim", bevel=0.006)
    put(f"{prefix}_rail_lip", length, 0.032, 0.012, WAIN_H - 0.046, mat="trim", bevel=0.003)
    put(f"{prefix}_base", length, 0.022, 0.11, 0.0, mat="trim", bevel=0.004)
    put(f"{prefix}_base_cap", length, 0.026, 0.014, 0.11, mat="trim", bevel=0.004)
    # panel moldings
    n = max(1, round(length / 0.62))
    pw = (length - 0.08 * (n + 1)) / n
    if pw < 0.2:
        return
    z0, z1 = 0.19, WAIN_H - 0.13
    for i in range(n):
        c = a0 + 0.08 + pw / 2 + i * (pw + 0.08)
        loc_out = WAIN_T + 0.0
        if axis == "x":
            frame(f"{prefix}_panel_{i}", pw, z1 - z0, pw - 0.05, z1 - z0 - 0.05, 0.009, loc=(c, wall_face - WAIN_T - 0.009, (z0 + z1) / 2),
                  mat="wainscot", r=0.0, ir=0.0, seg=1, bevel=0.003, back=False, own=own)
        else:
            frame(f"{prefix}_panel_{i}", pw, z1 - z0, pw - 0.05, z1 - z0 - 0.05, 0.009, loc=(wall_face + WAIN_T + 0.009, c, (z0 + z1) / 2),
                  rot=(0, 0, 90), mat="wainscot", r=0.0, ir=0.0, seg=1, bevel=0.003, back=False, own=own)
        _ = loc_out


def wainscot():
    from layout import SHELF_SPAN

    dy0, dy1 = DOOR["y"] - DOOR["w"] / 2 - 0.078, DOOR["y"] + DOOR["w"] / 2 + 0.078
    shelf_y0, shelf_y1 = SHELF_SPAN[0] + 0.01, SHELF_SPAN[1] - 0.01  # the bookcase stands against bare wall
    wainscot_run("wain_back", "x", LEFT_X, HALF, BACK_Y, "decor:wainscot")
    wainscot_run("wain_left_b", "y", shelf_y1, BACK_Y, LEFT_X, "decor:wainscot")
    wainscot_run("wain_left_m", "y", dy1, shelf_y0, LEFT_X, "decor:wainscot")
    wainscot_run("wain_left_f", "y", -HALF, dy0, LEFT_X, "decor:wainscot")


def build():
    with group("shell", bake="room"):
        walls()
        floor()
        wainscot()
