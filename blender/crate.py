"""Builds the 'ten crate' model.

Run headless from the project root:
    ~/opt/blender-4.5.14-linux-x64/blender --background --python blender/crate.py

Outputs:
    public/models/crate.glb      (loaded by the game)
    blender/previews/crate.png   (quick render to check the look)
"""
import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from common import box, export_glb, join, material, render_preview, reset_scene  # noqa: E402

SIZE = 1.0  # crate is 1m cube; game scales around this


def build_crate():
    body_mat = material("CrateBody", (0.8, 0.28, 0.04), roughness=0.5)
    frame_mat = material("CrateFrame", (0.12, 0.05, 0.02), roughness=0.7)
    plate_mat = material("Plate", (0.006, 0.01, 0.03), roughness=0.35)
    glow_mat = material("Glow10", (0.1, 0.9, 1.0), emission=(0.1, 0.9, 1.0), strength=1.8)

    parts = []
    s = SIZE
    inner = s * 0.92
    parts.append(box("Body", (inner, inner, inner), (0, 0, 0), body_mat, 0.03))

    # 12 chunky edge beams give the cartoon-crate silhouette
    t = s * 0.14
    half = s / 2 - t / 2
    for axis in range(3):
        for a in (-half, half):
            for b in (-half, half):
                loc = [0.0, 0.0, 0.0]
                dims = [t, t, t]
                dims[axis] = s
                others = [i for i in range(3) if i != axis]
                loc[others[0]], loc[others[1]] = a, b
                parts.append(box(f"Beam{axis}", dims, loc, frame_mat, 0.035))

    # A dark panel with a big glowing "10" on all four sides, so the number
    # reads clearly from any angle (the crate spins as it flies).
    # (normal direction, rotation that turns the text to face it)
    faces = [
        ((0, -1), 0),  # front
        ((0, 1), math.pi),  # back
        ((1, 0), math.pi / 2),  # right
        ((-1, 0), -math.pi / 2),  # left
    ]
    plate = s * 0.68
    for (nx, ny), rot in faces:
        dims = (plate, 0.03, plate) if nx == 0 else (0.03, plate, plate)
        parts.append(box("Plate", dims, (nx * s * 0.465, ny * s * 0.465, 0), plate_mat, 0.012))

        bpy.ops.object.text_add(location=(nx * s * 0.485, ny * s * 0.485, 0))
        txt = bpy.context.active_object
        txt.data.body = "10"
        txt.data.align_x = "CENTER"
        txt.data.align_y = "CENTER"
        txt.data.size = s * 0.56
        txt.data.extrude = 0.02
        txt.data.bevel_depth = 0.006
        txt.rotation_euler = (math.radians(90), 0, rot)
        bpy.ops.object.convert(target="MESH")
        txt.data.materials.append(glow_mat)
        parts.append(txt)

    return join(parts, "TenCrate")


if __name__ == "__main__":
    reset_scene()
    crate = build_crate()
    export_glb(crate, "public/models/crate.glb")
    render_preview("blender/previews/crate.png", (2.2, -2.6, 1.7))
