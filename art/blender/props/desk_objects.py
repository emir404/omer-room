"""obj__phone (on a walnut stand), obj__globe (tilted, spins at runtime), the articulated desk lamp
(night light R), and the LED "now" ticker (display__now)."""

import math

import bmesh
from mathutils import Matrix, Vector

from layout import GLOBE, GLOBE_R, LAMP, PHONE, PHONE_SCREEN, TICKER
from lib.core import DEG, empty, group, tag
from lib.geo import box, cyl, from_bm, lathe, plane, rrect, sphere, three_sphere, thick_profile, torus, tube

TOP = PHONE[2]


def phone():
    x, y, z = PHONE
    # stand: a walnut block with a slanted back and a front lip
    bm = bmesh.new()
    prof = [(-0.04, 0.0), (0.035, 0.0), (0.035, 0.012), (0.012, 0.09), (-0.004, 0.09), (-0.02, 0.022), (-0.034, 0.022), (-0.034, 0.014), (-0.04, 0.014)]
    w = 0.088
    left = [bm.verts.new((-w / 2, yy, zz)) for yy, zz in prof]
    right = [bm.verts.new((w / 2, yy, zz)) for yy, zz in prof]
    n = len(prof)
    for i in range(n):
        bm.faces.new((left[i], left[(i + 1) % n], right[(i + 1) % n], right[i]))
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    from_bm("phone_stand", bm, "walnut", loc=(x, y + 0.012, z), bevel=0.003, seg=2)
    # the phone leans back on the stand
    tilt = -17
    pw, ph, pd = PHONE_SCREEN["w"] + 0.0075, PHONE_SCREEN["h"] + 0.011, 0.0086
    body_loc = Vector((x, y - 0.006, z + 0.016 + ph / 2 * math.cos(tilt * DEG)))
    body_loc.y += ph / 2 * math.sin(-tilt * DEG)
    rrect("phone_body", pw, ph, pd, 0.012, loc=body_loc, rot=(tilt, 0, 0), mat="denim", axis="Y", seg=8, bevel=0.0022, bseg=3)
    rot = Matrix.Rotation(tilt * DEG, 4, "X")
    front = body_loc + (rot @ Vector((0, -pd / 2 - 0.0004, 0)))
    plane("phone_screen", PHONE_SCREEN["w"], PHONE_SCREEN["h"], loc=front, rot=(tilt, 0, 0), mat="screen_off", contract="screen__phone", bake="none")
    back = body_loc + (rot @ Vector((pw / 2 - 0.02, pd / 2, ph / 2 - 0.022)))
    rrect("phone_camera", 0.026, 0.026, 0.002, 0.007, loc=back, rot=(tilt, 0, 0), mat="graphite", axis="Y", seg=5, bevel=0.0006)
    for k, dz in enumerate((0.035, 0.012)):
        side = body_loc + (rot @ Vector((pw / 2 + 0.0006, 0, ph / 2 - dz - 0.02)))
        box(f"phone_btn_{k}", (0.0016, 0.003, 0.016 if k == 0 else 0.009), loc=side, rot=(tilt, 0, 0), mat="graphite", bevel=0.0006, seg=1)


def globe():
    gx, gy, gz = GLOBE
    center_h = 0.245
    root = empty("globe_root", (gx, gy, gz), rot=(0, 0, 90))
    tag(root, contract="obj__globe", own="globe")

    def local(ob, loc=(0, 0, 0), rot=(0, 0, 0)):
        ob.parent = root
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.location = loc
        ob.rotation_euler = [r * DEG for r in rot]
        return ob

    local(lathe("globe_base", [(0.0, 0.0), (0.085, 0.0), (0.088, 0.006), (0.084, 0.016), (0.068, 0.024), (0.05, 0.03), (0.03, 0.036), (0.018, 0.05), (0.0, 0.052)],
                mat="walnut", seg=48))
    local(cyl("globe_collar", 0.016, 0.014, mat="brass", seg=24, bevel=0.002), (0, 0, 0.046))
    tilt = 23.4
    pivot = empty("globe_pivot", (0, 0, 0))
    tag(pivot, contract="pivot__globe", own="globe")
    local(pivot, (0, 0, center_h), (tilt, 0, 0))
    # brass arm from the collar up to the meridian's south end
    R = GLOBE_R
    mer_r = R + 0.014
    south = Vector((0, -math.sin(tilt * DEG) * -mer_r, -math.cos(tilt * DEG) * mer_r)) + Vector((0, 0, center_h))
    south = Matrix.Rotation(tilt * DEG, 4, "X") @ Vector((0, 0, -mer_r)) + Vector((0, 0, center_h))
    arm = tube("globe_arm", [(0, 0, 0.056), (0, 0.004, 0.075), (south.x, south.y * 0.7, south.z - 0.01), (south.x, south.y, south.z)], 0.0055, mat="brass", res=10)
    local(arm)
    # half meridian: in the plane that contains the tilted axis
    mer = torus("globe_meridian", mer_r, 0.0042, mat="brass", seg=64, ring=8, arc=200)
    local(mer, (0, 0, center_h), (90 + tilt, 0, 0))
    mer.rotation_euler = (math.radians(tilt), math.radians(-100), math.radians(90))
    # the sphere spins with the pivot (realtime-lit: a baked lightmap would rotate with it)
    ball = three_sphere("globe_sphere", R, mat="globe_map", ws=64, hs=32, pivot="globe", dynamic=True, bake="none")
    ball.parent = pivot
    ball.matrix_parent_inverse = Matrix.Identity(4)
    ball.location = (0, 0, 0)
    # axis pins at the poles (static: they're round, so they needn't spin)
    tilt_m = Matrix.Translation((0, 0, center_h)) @ Matrix.Rotation(tilt * DEG, 4, "X")
    for k, sgn in ((0, 1), (1, -1)):
        cap = cyl(f"globe_axis_{k}", 0.006, 0.016, mat="brass", seg=16, bevel=0.0015, anchor_bottom=False)
        local(cap)
        cap.matrix_basis = tilt_m @ Matrix.Translation((0, 0, sgn * (R + 0.006)))


def lamp():
    x, y, z = LAMP
    base = lathe("lamp_base", [(0.0, 0.0), (0.078, 0.0), (0.081, 0.006), (0.079, 0.022), (0.07, 0.03), (0.03, 0.034), (0.0, 0.036)], loc=(x, y, z), mat="teal", seg=48)
    _ = base
    cyl("lamp_switch", 0.009, 0.008, loc=(x + 0.045, y - 0.03, z + 0.024), mat="cream", seg=16, bevel=0.002)
    j0 = Vector((x, y, z + 0.06))
    elbow = Vector((x + 0.02, y - 0.03, z + 0.4))
    head = Vector((x - 0.2, y - 0.23, z + 0.36))
    # joints
    for name, p, axis_rot in (("lamp_joint0", j0, (0, 90, 0)), ("lamp_joint1", elbow, (0, 90, 45)), ("lamp_joint2", head, (0, 90, 45))):
        cyl(name, 0.013, 0.036, loc=p + Vector((-0.018, 0, 0)), rot=axis_rot, mat="brass", seg=20, bevel=0.003, anchor_bottom=True)
    cyl("lamp_post", 0.012, 0.035, loc=(x, y, z + 0.03), mat="teal", seg=20, bevel=0.002)
    side = Vector((0.0, 0.0, 0.0))
    for k, off in enumerate((-0.011, 0.011)):
        o = Vector((off, 0, 0))
        tube(f"lamp_arm_a{k}", [j0 + o, elbow + o], 0.0052, mat="teal", kind="POLY", res=1, bevel_res=3)
        tube(f"lamp_arm_b{k}", [elbow + o, head + o], 0.0048, mat="teal", kind="POLY", res=1, bevel_res=3)
    _ = side
    # springs along the lower arm
    for k, off in enumerate((-0.026, 0.026)):
        a, b = j0 + Vector((off, 0.012, 0.03)), elbow + Vector((off, 0.012, -0.08))
        axis = (b - a)
        n = 120
        pts = []
        q = axis.normalized().to_track_quat("Z", "Y")
        for i in range(n + 1):
            t = i / n
            ang = t * 2 * math.pi * 22
            pts.append(a + axis * t + q @ Vector((0.0035 * math.cos(ang), 0.0035 * math.sin(ang), 0)))
        tube(f"lamp_spring_{k}", pts, 0.0011, mat="steel", kind="POLY", res=1, bevel_res=1)
        tube(f"lamp_spring_rod_{k}", [a - axis * 0.06, a], 0.0012, mat="steel", kind="POLY", res=1, bevel_res=2)
    # the shade points down at the keyboard
    aim = Vector((0.72, 1.66, z)) - head
    q = (-aim).normalized().to_track_quat("Z", "Y")
    shade_m = Matrix.Translation(head + aim.normalized() * 0.03) @ q.to_matrix().to_4x4()
    outer = [(0.072, 0.0), (0.066, 0.04), (0.05, 0.085), (0.036, 0.11), (0.026, 0.13)]
    shade = lathe("lamp_shade", [(0.026, 0.135), (0.0, 0.135)] + list(reversed(outer)) + [(0.069, -0.002)] + [(r - 0.003, zz) for r, zz in outer] + [(0.0, 0.127)],
                  mat="teal", seg=48)
    shade.matrix_world = shade_m @ Matrix.Translation((0, 0, -0.12))
    inner = lathe("lamp_shade_inner", [(0.066, 0.002), (0.061, 0.04), (0.046, 0.083), (0.033, 0.106), (0.0, 0.122)], mat="cream", seg=48)
    inner.matrix_world = shade_m @ Matrix.Translation((0, 0, -0.12))
    bulb = sphere("lamp_bulb", 0.026, mat="bulb", seg=24, rings=14, bake="none", glow="lamp")
    bulb.matrix_world = shade_m @ Matrix.Translation((0, 0, -0.06))
    # cable from the base to the wall
    tube("lamp_cable", [(x + 0.02, y + 0.07, z + 0.006), (x + 0.04, y + 0.14, z + 0.004), (x + 0.06, y + 0.19, z - 0.02), (x + 0.04, y + 0.2, 0.3)], 0.0028, mat="ink", res=10)
    return shade_m


def ticker():
    x, y, z = TICKER
    w, h, d = 0.33, 0.07, 0.064
    tilt = -10
    loc = Vector((x, y, z + h / 2 + 0.012))
    rrect("ticker_body", w, h, d, 0.012, loc=loc, rot=(tilt, 0, 0), mat="charcoal", axis="Y", seg=6, bevel=0.003, bseg=2)
    rot = Matrix.Rotation(tilt * DEG, 4, "X")
    face = loc + rot @ Vector((0, -d / 2 - 0.0005, 0))
    rrect("ticker_bezel", w - 0.014, h - 0.014, 0.003, 0.006, loc=face, rot=(tilt, 0, 0), mat="ink", axis="Y", seg=4, bevel=0.001)
    plane("ticker_display", 0.294, 0.049, loc=face + rot @ Vector((0, -0.0022, 0)), rot=(tilt, 0, 0), mat="screen_off", contract="display__now", bake="none")
    for k, dx in enumerate((-w / 2 + 0.03, w / 2 - 0.03)):
        box(f"ticker_foot_{k}", (0.03, 0.04, 0.012), loc=(x + dx, y + 0.004, z), mat="rubber", bevel=0.003, anchor=(0, 0, -1))
    cyl("ticker_knob", 0.007, 0.01, loc=loc + rot @ Vector((w / 2 - 0.02, 0, h / 2)), rot=(tilt, 0, 0), mat="orange", seg=16, bevel=0.002)


def build():
    with group("phone", own="phone", bake="props"):
        phone()
    with group("globe", own="globe", bake="props"):
        globe()
    with group("lamp", own="decor:lamp", bake="props"):
        lamp()
    with group("ticker", own="decor:ticker", bake="props"):
        ticker()
