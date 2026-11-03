"""Cycles on the Mac's GPU (Metal), color management that matches the site (AgX), preview cameras
that mirror the site's camera presets, and a quick turntable for single props."""

import math
import os

import bpy
from mathutils import Vector

from .core import DEG, empty

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PREVIEWS = os.path.join(ROOT, "art", "previews")

# Site camera presets (cam__<id> → cam__<id>__target), Blender coordinates. Keep in sync with
# build_room.py (which writes them into the GLB) — the site computes distance from these directions.
SITE_FOV = 32  # vertical degrees, same as RoomCanvas


def use_gpu(scene=None):
    scene = scene or bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.refresh_devices()
    for d in prefs.devices:
        d.use = d.type == "METAL"
    scene.cycles.device = "GPU"
    return scene


def color_management(scene=None, look="None", exposure=0.0):
    scene = scene or bpy.context.scene
    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = look
    scene.view_settings.exposure = exposure
    scene.view_settings.gamma = 1.0
    return scene


def setup_render(width=1440, height=900, samples=128, denoise=True, scene=None):
    scene = use_gpu(scene)
    color_management(scene)
    c = scene.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = denoise
    c.denoiser = "OPENIMAGEDENOISE"
    c.max_bounces = 8
    c.diffuse_bounces = 4
    c.glossy_bounces = 2
    c.transmission_bounces = 4
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 8
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    return scene


def camera(name, pos, target, fov=SITE_FOV, lens_shift=(0, 0)):
    cam = bpy.data.cameras.new(name)
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = fov * DEG
    cam.clip_start = 0.02
    cam.clip_end = 80
    cam.shift_x, cam.shift_y = lens_shift
    ob = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(pos)
    direction = Vector(target) - Vector(pos)
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return ob


def render_to(path, cam=None, scene=None):
    scene = scene or bpy.context.scene
    if cam is not None:
        scene.camera = cam
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def studio(scene=None, strength=0.32, color="#F4EFE8"):
    """Neutral prop-preview lighting: soft world + key/rim area lights, a backdrop floor."""
    from .mats import hex_rgba

    scene = scene or bpy.context.scene
    world = bpy.data.worlds.new("studio")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_rgba(color)
    bg.inputs["Strength"].default_value = strength
    for name, loc, rot, energy, size in (
        ("key", (2.2, -2.6, 3.0), (52, 0, 40), 520, 1.2),
        ("fill", (-3.0, -2.2, 1.6), (70, 0, -55), 120, 2.5),
        ("rim", (-2.4, 2.2, 2.4), (-55, 0, 220), 200, 1.0),
    ):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        ob = bpy.data.objects.new(name, light)
        scene.collection.objects.link(ob)
        ob.location = loc
        ob.rotation_euler = [r * DEG for r in rot]
    return world


def frame_objects(obs, fov=28, azimuth=-35, elevation=22, margin=1.25):
    """A camera that frames the given objects from (azimuth, elevation) degrees."""
    pts = []
    for ob in obs:
        if ob.type == "MESH":
            pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (lo + hi) / 2
    radius = (hi - lo).length / 2
    dist = radius * margin / math.sin(fov * DEG / 2)
    az, el = azimuth * DEG, elevation * DEG
    pos = center + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
    return camera("preview_cam", pos, center, fov)


def backdrop(z=0.0, size=12, color="#B9B1A5"):
    import bmesh

    from .core import mesh_object
    from .mats import hex_rgba

    m = bpy.data.materials.new("backdrop")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hex_rgba(color)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    return mesh_object("backdrop", bm, m, (0, 0, z))


__all__ = ["use_gpu", "setup_render", "camera", "render_to", "studio", "frame_objects", "backdrop", "empty", "PREVIEWS"]
