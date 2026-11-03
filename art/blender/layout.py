"""Where things stand, in Blender coordinates (meters, Z up). Mirrors the Phase 1 blockout
(scripts/build-blockout.ts, glTF (x, y, z) → Blender (x, −z, y)) so the site's camera presets and
the content panels keep their composition.
"""

ROOM_W = 4.5  # floor is ROOM_W × ROOM_W, centered on the origin
ROOM_H = 3.0
WALL_T = 0.12
FLOOR_T = 0.14
BACK_Y = 2.25  # back wall inner face
LEFT_X = -2.25  # left wall inner face

DESK = {"x": 0.55, "y": 1.86, "top": 0.77, "w": 1.7, "d": 0.72, "t": 0.038}
COMPUTER = (0.5, 1.98, 0.77)  # obj__computer origin (on the desk top)
SCREEN = {"w": 0.48, "h": 0.30, "z": 1.075, "y": 1.8985}  # screen__computer: 16:10, the live desktop UI is laid out at 16:10
PHONE = (1.02, 1.74, 0.77)
PHONE_SCREEN = {"w": 0.0706, "h": 0.1535, "r": 0.0097}  # an iPhone screen: 402 × 874 pt, 55 pt corners
GLOBE = (0.02, 1.86, 0.77)
GLOBE_R = 0.13
LAMP = (1.34, 2.04, 0.77)
TICKER = (-0.12, 1.64, 0.77)
WINDOW = {"x": 0.5, "z": 1.85, "w": 1.1, "h": 0.82}  # opening on the back wall (the view is a photo behind it)
LETTER = (-0.78, 2.25, 1.68)
HOOP_BOARD = (-1.55, 2.25, 2.32)
HOOP_RIM = (-1.55, 2.0, 2.14)
BALL = (-1.3, 0.98, 0.12)
BALL_R = 0.12
SHELF = (-2.08, 1.25, 0.0)
DOOR = {"y": -1.05, "w": 0.92, "h": 2.08}
MAILBOX = (-2.25, -1.9, 1.2)
CHAIR = (0.45, 1.2, 0.0)
RUG = (0.15, 0.3, 0.0)
PLANT = (1.85, 1.85, 0.0)

# Site camera presets: (position, target). The site keeps the direction and computes the distance.
CAMS = {
    "room": ((5.6, -6.0, 4.3), (-0.25, 0.45, 1.05)),
    "shelf": ((1.2, -0.3, 1.35), (-2.0, 1.25, 1.07)),
    "computer": ((0.5, 0.7, 1.15), (0.5, 1.98, 1.085)),
    "phone": ((1.0, 1.2, 1.4), (1.02, 1.74, 0.88)),
    "globe": ((0.15, 0.95, 1.25), (0.02, 1.86, 1.0)),
    "window": ((0.5, -0.9, 1.7), (0.5, 2.25, 1.85)),
    "letter": ((-0.66, 0.5, 1.62), (-0.78, 2.25, 1.68)),
    "contact": ((-0.2, -2.1, 1.5), (-2.08, -1.9, 1.22)),
    "hoop": ((-0.2, -0.9, 1.6), (-1.4, 1.5, 1.2)),
}


def letter_aspect():
    """Width / height of the framed letter. Read from the image in content/letter.md (`letter.src`), so
    the frame on the wall fits the real letter 1:1; US Letter (8.5 × 11) until there is one."""
    import os
    import re

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    try:
        text = open(os.path.join(root, "content", "letter.md"), encoding="utf8").read()
        front = text.split("---")[1]
        src = re.search(r"^letter:\s*\n(?:\s+.*\n)*?\s+src:\s*[\"']?(/content/[^\s\"']+)", front, re.M)
        if src:
            import OpenImageIO as oiio

            spec = oiio.ImageInput.open(os.path.join(root, "public", src.group(1).lstrip("/"))).spec()
            return max(0.45, min(1.6, spec.width / spec.height))
    except (OSError, IndexError, AttributeError):
        pass
    return 8.5 / 11
