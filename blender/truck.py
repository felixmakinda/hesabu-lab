"""Builds the delivery truck used in the sharing (division) game.

Run headless from the project root:
    ~/opt/blender-4.5.14-linux-x64/blender --background --python blender/truck.py

The truck faces +X (cab on the right). The cargo bed has low rails so the
marbles stacked inside stay visible. The body material is named "TruckBody"
so the game can give each truck its own colour.

Bed layout the game relies on (glTF / Three.js axes, Y up):
    bed floor top at y = 0.28, bed centre x = -0.16, bed spans x -0.5..0.18
"""
import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from common import box, cylinder, export_glb, join, material, render_preview, reset_scene  # noqa: E402


def build_truck():
    body = material("TruckBody", (0.9, 0.9, 0.9), roughness=0.35)  # tinted in-game
    dark = material("TruckDark", (0.02, 0.025, 0.05), roughness=0.6)
    tyre = material("Tyre", (0.015, 0.015, 0.02), roughness=0.8)
    hub = material("Hub", (0.6, 0.65, 0.75), roughness=0.25, metallic=0.8)
    glass = material("Window", (0.15, 0.5, 0.7), roughness=0.05)
    lamp = material("Headlight", (1, 0.9, 0.6), emission=(1, 0.85, 0.5), strength=4)

    parts = []
    # Blender is Z-up; Y here becomes -Z in the game.
    W = 0.56  # width

    # Chassis
    parts.append(box("Chassis", (1.0, W, 0.1), (0, 0, 0.2), dark, 0.02))
    # Cargo bed floor and low rails
    parts.append(box("BedFloor", (0.68, W, 0.05), (-0.16, 0, 0.255), body, 0.01))
    parts.append(box("RailBack", (0.04, W, 0.12), (-0.48, 0, 0.32), body, 0.01))
    parts.append(box("RailFront", (0.04, W, 0.12), (0.16, 0, 0.32), body, 0.01))
    for y in (-W / 2 + 0.02, W / 2 - 0.02):
        parts.append(box("RailSide", (0.68, 0.04, 0.12), (-0.16, y, 0.32), body, 0.01))

    # Cab
    parts.append(box("Cab", (0.3, W, 0.36), (0.35, 0, 0.43), body, 0.05))
    parts.append(box("Windshield", (0.02, W * 0.8, 0.16), (0.5, 0, 0.5), glass, 0.01))
    for y in (-W / 2, W / 2):
        parts.append(box("SideWindow", (0.16, 0.02, 0.14), (0.36, y, 0.51), glass, 0.01))
    for y in (-0.18, 0.18):
        parts.append(cylinder("Lamp", 0.04, 0.03, (0.505, y, 0.33), (0, math.radians(90), 0), lamp, 16, 0.005))
    parts.append(box("Bumper", (0.05, W + 0.04, 0.06), (0.52, 0, 0.2), dark, 0.015))

    # Wheels
    for x in (-0.3, 0.32):
        for y in (-W / 2 + 0.02, W / 2 - 0.02):
            parts.append(cylinder("Tyre", 0.13, 0.1, (x, y, 0.13), (math.radians(90), 0, 0), tyre, 32, 0.02))
            side = 1 if y > 0 else -1
            parts.append(cylinder("Hub", 0.06, 0.02, (x, y + side * 0.05, 0.13), (math.radians(90), 0, 0), hub, 16, 0.004))

    return join(parts, "Truck")


if __name__ == "__main__":
    import bpy

    reset_scene()
    truck = build_truck()
    export_glb(truck, "public/models/truck.glb")
    # Tint the preview so it shows how the game colours it
    bpy.data.materials["TruckBody"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.9, 0.08, 0.3, 1)
    render_preview("blender/previews/truck.png", (1.4, -1.9, 1.2), target=(0, 0, 0.3))
