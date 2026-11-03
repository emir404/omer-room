"""Bake the lightmaps → art/out/lightmaps/

    Blender -b --factory-startup -P art/blender/bake.py -- [samples] [size_props] [size_room]

Light-only Diffuse bakes (Direct + Indirect, no Color) into UV1 "Lightmap", one atlas per bake set:
    day    sky + sun through the window
    night  dark sky + moonlight (lamps off)
    mask   R desk lamp, G monitor, B string lights — each light group alone, on black
Albedo stays out of the bake, so the runtime multiplies it back (and slots/screens can change).

Speed: Cycles bakes every selected object as its own full-image pass, so each set is joined into a
single temporary proxy first (the originals are hidden while it bakes).
Encoding: day/night are HDR (sun patch ≈ 40× the shade), stored as RGBM (rgb · a² · RANGE) so 8 bits
keep ≈1% precision from deep shade to the sun patch; the mask is 3 × 8-bit sRGB, each channel
normalized by its own scale. Scales go to art/out/lightmaps/lightmaps.json.
"""

import json
import os
import sys
import time

import bpy
import numpy as np
import OpenImageIO as oiio
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import lights, render  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 384
SIZES = {"props": int(argv[1]) if len(argv) > 1 else 2048, "room": int(argv[2]) if len(argv) > 2 else 2048}
OUT = os.path.abspath(os.path.join(HERE, "..", "out", "lightmaps"))
MARGIN = 16
RGBM_RANGE = 16.0


def objects_by_set():
    sets = {}
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ob.get("bake") in SIZES:
            sets.setdefault(ob["bake"], []).append(ob)
    return sets


def prepare_materials():
    """Bake-only tweaks: metals bake as diffuse, emitters stay dark (the lights do the work)."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b:
            continue
        b.inputs["Metallic"].default_value = 0.0
        b.inputs["Emission Strength"].default_value = 0.0


def make_proxies(sets):
    """One joined, world-space copy per set; originals hidden from the render."""
    bpy.context.view_layer.update()
    coll = bpy.data.collections.new("__bake__")
    bpy.context.scene.collection.children.link(coll)
    proxies = {}
    for sname, objs in sets.items():
        copies = []
        for o in objs:
            me = o.data.copy()
            me.transform(o.matrix_world)
            c = bpy.data.objects.new(f"__bake_{o.name}", me)
            coll.objects.link(c)
            copies.append(c)
            o.hide_render = True
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for c in copies:
            c.select_set(True)
        bpy.context.view_layer.objects.active = copies[0]
        bpy.ops.object.join()
        proxy = copies[0]
        proxy.name = f"__bake_{sname}"
        proxies[sname] = proxy
    return proxies


def target_node(mat, image):
    nt = mat.node_tree
    node = nt.nodes.get("__bake__")
    if node is None:
        node = nt.nodes.new("ShaderNodeTexImage")
        node.name = "__bake__"
        node.location = (-600, 400)
    node.image = image
    nt.nodes.active = node


def bake_pass(proxy, image, kind="DIFFUSE"):
    for s in proxy.material_slots:
        if s.material:
            target_node(s.material, image)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    proxy.select_set(True)
    proxy.data.uv_layers.active = proxy.data.uv_layers["Lightmap"]
    bpy.context.view_layer.objects.active = proxy
    t = time.time()
    if kind == "AO":
        bpy.ops.object.bake(type="AO", margin=0, use_clear=True, target="IMAGE_TEXTURES")
    else:
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=MARGIN, margin_type="EXTEND", use_clear=True, target="IMAGE_TEXTURES")
    return time.time() - t


def denoise(src_path, dst_path, size):
    """OIDN on an EXR through a throwaway compositor scene."""
    img = bpy.data.images.load(src_path, check_existing=False)
    sc = bpy.data.scenes.new("__denoise__")
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 1
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_depth = "32"
    sc.view_settings.view_transform = "Standard"
    cam = bpy.data.objects.new("__cam__", bpy.data.cameras.new("__cam__"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    tree = bpy.data.node_groups.new("__denoise__", "CompositorNodeTree")
    sc.compositing_node_group = tree
    n_img = tree.nodes.new("CompositorNodeImage")
    n_img.image = img
    n_den = tree.nodes.new("CompositorNodeDenoise")
    n_den.inputs["HDR"].default_value = True
    n_out = tree.nodes.new("NodeGroupOutput")
    tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    tree.links.new(n_img.outputs["Image"], n_den.inputs["Image"])
    tree.links.new(n_den.outputs["Image"], n_out.inputs[0])
    sc.render.filepath = dst_path
    bpy.ops.render.render(write_still=True, scene=sc.name)
    bpy.data.images.remove(img)
    bpy.data.scenes.remove(sc)
    bpy.data.node_groups.remove(tree)


def read(path):
    return oiio.ImageBuf(path).get_pixels(oiio.FLOAT)[..., :3]


def write_png(path, arr):
    h, w, c = arr.shape
    buf = oiio.ImageBuf(oiio.ImageSpec(w, h, c, oiio.UINT8))
    buf.set_pixels(oiio.ROI(0, w, 0, h, 0, 1, 0, c), (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8))
    buf.write(path)


def to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def rgbm(arr, scale):
    """Linear HDR → RGBM with a squared multiplier (all channels linear 0..1):
    value = rgb · a² · RANGE · scale. Squaring gives the multiplier fine steps near black."""
    v = np.maximum(arr, 0) / scale
    m = np.clip(v.max(axis=-1, keepdims=True) / RGBM_RANGE, 0, 1.0)
    a = np.maximum(np.ceil(np.sqrt(m) * 255) / 255, 1 / 255)
    rgb = np.clip(v / (a * a * RGBM_RANGE), 0, 1)
    return np.concatenate([rgb, a], axis=-1)


def string_positions():
    pts = []
    for o in bpy.data.objects:
        if o.type == "MESH" and o.get("glow") == "string":
            cells = {}
            for v in o.data.vertices:
                p = o.matrix_world @ v.co
                cells.setdefault((round(p.x / 0.03), round(p.y / 0.03), round(p.z / 0.03)), []).append(p)
            for g in cells.values():
                pts.append(sum(g, Vector()) / len(g))
    uniq = []
    for p in pts:
        if all((p - q).length > 0.06 for q in uniq):
            uniq.append(p)
    return uniq


def black_world():
    lights.world("#000000", 0.0)


def main():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, "..", "out", "room.blend"))
    os.makedirs(OUT, exist_ok=True)
    scene = render.use_gpu()
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 4
    scene.cycles.sample_clamp_indirect = 6
    scene.render.bake.margin = MARGIN
    bulbs = string_positions()
    prepare_materials()
    proxies = make_proxies(objects_by_set())
    # night = the day bake, cooled and dimmed in the shader (saves a texture); lamps come from the mask
    passes = {
        "day": lights.day,
        "lamp": lambda: (lights.clear(), black_world(), lights.lamp_light()),
        "monitor": lambda: (lights.clear(), black_world(), lights.monitor_light()),
        "string": lambda: (lights.clear(), black_world(), lights.string_lights(bulbs)),
    }
    files = {}
    t0 = time.time()
    for pname, setup in passes.items():
        setup()
        for sname, proxy in proxies.items():
            size = SIZES[sname]
            img = bpy.data.images.new(f"lm_{sname}_{pname}", size, size, float_buffer=True, alpha=False)
            secs = bake_pass(proxy, img)
            src = os.path.join(OUT, f"raw_{sname}_{pname}.exr")
            img.filepath_raw = src
            img.file_format = "OPEN_EXR"
            img.save()
            bpy.data.images.remove(img)
            dst = os.path.join(OUT, f"den_{sname}_{pname}.exr")
            denoise(src, dst, size)
            files[(sname, pname)] = (src, dst)
            print(f"  baked {sname}/{pname} {size}px {SAMPLES}spp in {secs:.1f}s")

    print(f"BAKE ok in {time.time() - t0:.0f}s")
    # encode tiers + manifest (separate script so it can be re-run without baking)
    import runpy

    runpy.run_path(os.path.join(HERE, "encode.py"), run_name="__main__")


main()
