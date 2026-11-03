"""Day and night light rigs (Cycles). The same rigs drive the preview renders and the bakes.

Day:   soft sky from the open sides + "sun" through the window (an area light just outside the
       opening with a narrow spread, so light only enters where a real sun would).
Night: dark blue sky + cool moonlight through the window (base), and three light groups baked
       alone into the mask channels: R desk lamp, G monitor, B string lights.
"""

import math

import bpy
from mathutils import Vector

from layout import BACK_Y, LAMP, SCREEN, WINDOW
from .core import DEG
from .mats import hex_rgba

LIGHT_COLL = "lights"
SUN_DIR = Vector((-0.38, -0.62, -0.69)).normalized()  # direction the sunlight travels (into the room, down, a bit left)
MOON_DIR = Vector((0.22, -0.7, -0.68)).normalized()


def _coll():
    coll = bpy.data.collections.get(LIGHT_COLL)
    if coll is None:
        coll = bpy.data.collections.new(LIGHT_COLL)
        bpy.context.scene.collection.children.link(coll)
    return coll


def clear():
    coll = bpy.data.collections.get(LIGHT_COLL)
    if coll:
        for ob in list(coll.objects):
            data = ob.data
            bpy.data.objects.remove(ob)
            if data and data.users == 0:
                bpy.data.lights.remove(data)


def _light(name, kind, loc, color="#FFFFFF", energy=10.0, channel=None, **props):
    light = bpy.data.lights.new(name, kind)
    light.color = hex_rgba(color)[:3]
    light.energy = energy
    for k, v in props.items():
        setattr(light, k, v)
    ob = bpy.data.objects.new(name, light)
    _coll().objects.link(ob)
    ob.visible_camera = False
    ob.visible_glossy = False
    ob.location = Vector(loc)
    if channel:
        ob["channel"] = channel
    return ob


def _aim(ob, direction):
    ob.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()


def world(color, strength, horizon=None):
    sc = bpy.context.scene
    w = sc.world or bpy.data.worlds.new("world")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    if horizon is None:
        bg.inputs["Color"].default_value = hex_rgba(color)
    else:
        # vertical gradient: horizon → zenith
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = hex_rgba(horizon)
        ramp.color_ramp.elements[1].position = 0.6
        ramp.color_ramp.elements[1].color = hex_rgba(color)
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.5
        mr.inputs["From Max"].default_value = 1.0
        nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return w


def _through_window(name, direction, color, energy, spread_deg, size_pad=0.5, back=0.55):
    """Area light just outside the window opening, emitting along `direction`."""
    center = Vector((WINDOW["x"], BACK_Y + 0.12, WINDOW["z"]))
    # step back against the light direction so the beam covers the whole opening
    loc = center - Vector(direction) * back
    ob = _light(name, "AREA", loc, color, energy, shape="RECTANGLE", size=WINDOW["w"] + size_pad, size_y=WINDOW["h"] + size_pad)
    ob.data.spread = spread_deg * DEG
    _aim(ob, direction)
    return ob


def day():
    clear()
    world("#CFDDEB", 0.75, horizon="#F3EADB")
    _through_window("sun", SUN_DIR, "#FFE2B8", 320.0, 9.0, size_pad=0.9, back=0.9)
    # skylight spilling through the window (wide, soft, cool)
    _through_window("window_sky", Vector((0, -1, -0.15)), "#DCE8F5", 60.0, 160.0, size_pad=0.0, back=0.05)


def night_base():
    clear()
    world("#1C2742", 0.16, horizon="#2A3352")
    _through_window("moon", MOON_DIR, "#9DB4E8", 26.0, 10.0, size_pad=0.9, back=0.9)
    _through_window("window_glow", Vector((0, -1, -0.1)), "#3B4C80", 6.0, 160.0, size_pad=0.0, back=0.05)


def lamp_light(shade_head=None, aim=None):
    """R: the desk lamp — a spot inside the shade aimed at the keyboard, plus a little fill."""
    from mathutils import Vector as V

    head = shade_head or V((LAMP[0] - 0.2, LAMP[1] - 0.23, LAMP[2] + 0.36))
    aim = aim or (V((0.72, 1.66, LAMP[2])) - head).normalized()
    spot = _light("lamp_spot", "SPOT", head + aim * 0.05, "#FFB25C", 16.0, channel="lamp", spot_size=110 * DEG, spot_blend=0.65, shadow_soft_size=0.02)
    _aim(spot, aim)
    _light("lamp_fill", "POINT", head + aim * 0.04, "#FFB25C", 1.2, channel="lamp", shadow_soft_size=0.02)


def monitor_light():
    """G: the monitor's glow on the desk, keyboard and wall."""
    ob = _light("monitor_glow", "AREA", (0.5, SCREEN["y"] - 0.01, SCREEN["z"]), "#A8D4FF", 5.5, channel="monitor", shape="RECTANGLE", size=SCREEN["w"], size_y=SCREEN["h"])
    _aim(ob, (0, -1, 0))


def string_lights(positions):
    """B: one small point light per bulb."""
    for i, p in enumerate(positions):
        _light(f"string_{i}", "POINT", p, "#FFC46E", 0.32, channel="string", shadow_soft_size=0.01)


def night(string_positions, shade_head=None, aim=None):
    night_base()
    lamp_light(shade_head, aim)
    monitor_light()
    string_lights(string_positions)
