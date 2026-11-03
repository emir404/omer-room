"""The palette (see art/STYLE.md) as Blender materials.

Each material is a plain Principled BSDF, so the glTF exporter writes it as baseColor (+ texture on
UV0), roughness, metallic, emissive. At runtime `createRoomMaterial()` reads exactly those and
multiplies the albedo by the baked lightmap (UV1).
"""

import os

import bpy

TEX_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "out", "tex"))

# name: (sRGB hex, roughness, metallic)
PALETTE = {
    # room shell
    "plaster": ("#EFE7DA", 0.92, 0.0),
    "wainscot": ("#8FA38A", 0.75, 0.0),
    "trim": ("#F6F1E7", 0.5, 0.0),
    "wall_cut": ("#4A3A30", 0.9, 0.0),
    "floor_edge": ("#8C6440", 0.7, 0.0),
    # woods
    "walnut": ("#7A5034", 0.5, 0.0),
    "walnut_dark": ("#553624", 0.55, 0.0),
    "oak": ("#C99B69", 0.55, 0.0),
    "oak_light": ("#DDBB8E", 0.6, 0.0),
    "birch": ("#E6D2B0", 0.6, 0.0),
    # paints + plastics
    "cream": ("#F1EBDF", 0.45, 0.0),
    "cream_dark": ("#DDD4C4", 0.5, 0.0),
    "ink": ("#1F1D1B", 0.45, 0.0),
    "charcoal": ("#36383C", 0.5, 0.0),
    "graphite": ("#55585E", 0.5, 0.0),
    "paper": ("#F8F4EB", 0.9, 0.0),
    "paper_warm": ("#EFE3C8", 0.9, 0.0),
    "terracotta": ("#C4613D", 0.8, 0.0),
    "clay": ("#B9714E", 0.85, 0.0),
    "mustard": ("#D9A441", 0.85, 0.0),
    "ochre": ("#C98F35", 0.85, 0.0),
    "navy": ("#26395A", 0.55, 0.0),
    "denim": ("#3E5A80", 0.8, 0.0),
    "teal": ("#2F5E58", 0.45, 0.0),
    "sage": ("#8FA382", 0.7, 0.0),
    "door_blue": ("#5A7889", 0.5, 0.0),
    "red": ("#C4442F", 0.55, 0.0),
    "orange": ("#EE6A12", 0.5, 0.0),
    "pink": ("#E9A3A0", 0.8, 0.0),
    "yellow": ("#F2D16B", 0.85, 0.0),
    "mint": ("#A7D3C0", 0.8, 0.0),
    "rubber": ("#2A2A2C", 0.85, 0.0),
    "felt": ("#4B5058", 1.0, 0.0),
    "fabric_oat": ("#D9CCB4", 1.0, 0.0),
    "linen": ("#E2D3B5", 1.0, 0.0),
    "curtain": ("#D3A04B", 1.0, 0.0),
    "cushion": ("#C4613D", 1.0, 0.0),
    "soil": ("#3B2A1F", 1.0, 0.0),
    "leaf": ("#4F8A46", 0.6, 0.0),
    "leaf_dark": ("#2F6B3A", 0.6, 0.0),
    "leaf_light": ("#86B56C", 0.6, 0.0),
    "stem": ("#6E8A4A", 0.7, 0.0),
    "ball": ("#D8692A", 0.75, 0.0),
    "net": ("#F4F1EA", 1.0, 0.0),
    "screen_off": ("#121416", 0.3, 0.0),
    # metals (baked as diffuse; reflections come from the runtime env map)
    "brass": ("#C8A04A", 0.35, 1.0),
    "gold": ("#E2B43F", 0.3, 1.0),
    "silver": ("#CDD1D6", 0.28, 1.0),
    "bronze": ("#B9773F", 0.35, 1.0),
    "steel": ("#A9AFB4", 0.38, 1.0),
    "chrome": ("#D8DBDF", 0.18, 1.0),
}

# name: (sRGB hex, strength) — things that glow (excluded from lightmaps, emissive at runtime)
EMISSIVE = {
    "bulb": ("#FFD9A0", 6.0),
    "bulb_string": ("#FFCF7A", 8.0),
    "led_amber": ("#FFB347", 4.0),
    "led_green": ("#7CFF9B", 3.0),
    "lamp_inner": ("#FFE2B0", 2.0),
}

# name: (texture file in art/out/tex, roughness, metallic)
TEXTURED = {
    "floor_planks": ("floor_planks.png", 0.6, 0.0),
    "rug_kilim": ("rug_kilim.png", 1.0, 0.0),
    "globe_map": ("globe_map.png", 0.45, 0.0),
    "basketball": ("basketball.png", 0.75, 0.0),
    "poster_money": ("poster_money.png", 0.8, 0.0),
    "poster_kozan": ("poster_kozan.png", 0.8, 0.0),
    "cork": ("cork.png", 1.0, 0.0),
    "plaster_tex": ("plaster.png", 0.92, 0.0),
    "notes": ("notes.png", 0.9, 0.0),
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_str, alpha=1.0):
    h = hex_str.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (alpha,)


def _principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    return m, bsdf


def M(name):
    """Get-or-create a palette material by name."""
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    if name in PALETTE:
        hex_str, rough, metal = PALETTE[name]
        m, bsdf = _principled(name)
        bsdf.inputs["Base Color"].default_value = hex_rgba(hex_str)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        m.diffuse_color = hex_rgba(hex_str)
        return m
    if name in EMISSIVE:
        hex_str, strength = EMISSIVE[name]
        m, bsdf = _principled(name)
        bsdf.inputs["Base Color"].default_value = hex_rgba(hex_str)
        bsdf.inputs["Emission Color"].default_value = hex_rgba(hex_str)
        bsdf.inputs["Emission Strength"].default_value = strength
        bsdf.inputs["Roughness"].default_value = 0.4
        m["emissive"] = True
        return m
    if name in TEXTURED:
        file, rough, metal = TEXTURED[name]
        m, bsdf = _principled(name)
        nt = m.node_tree
        tex = nt.nodes.new("ShaderNodeTexImage")
        path = os.path.join(TEX_DIR, file)
        if os.path.exists(path):
            img = bpy.data.images.load(path, check_existing=True)
        else:
            print(f"! missing texture {file} (run textures.py) — using a placeholder")
            img = bpy.data.images.new(file, 8, 8)
            img.pixels = [0.8, 0.2, 0.8, 1.0] * 64
        img.colorspace_settings.name = "sRGB"
        tex.image = img
        tex.interpolation = "Linear"
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "UVMap"
        nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        return m
    if name.startswith("#"):
        # ad-hoc color: M("#AABBCC")
        m, bsdf = _principled("c_" + name[1:].lower())
        bsdf.inputs["Base Color"].default_value = hex_rgba(name)
        bsdf.inputs["Roughness"].default_value = 0.7
        return m
    raise KeyError(f"unknown material {name!r}")


def is_emissive(mat):
    return bool(mat and mat.get("emissive"))


def is_metal(mat):
    if not mat or not mat.use_nodes:
        return False
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    return bool(bsdf and bsdf.inputs["Metallic"].default_value > 0.5)
