"""Shared helpers for the headless Blender model scripts."""
import math
import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, emission=None, strength=0.0, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def bevel(obj, width, segments=3):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"


def box(name, size, location, mat, bevel_width=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    bevel(obj, bevel_width)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth_by_angle()
    return obj


def cylinder(name, radius, depth, location, rotation, mat, verts=32, bevel_width=0.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    bevel(obj, bevel_width)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth_by_angle()
    return obj


def join(parts, name):
    """Apply modifiers and merge parts into one object (materials are kept per face)."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
        bpy.context.view_layer.objects.active = p
        for m in p.modifiers:
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def export_glb(obj, rel_path):
    path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True)
    print(f"Wrote {path}")


def render_preview(rel_path, camera_location, target=(0, 0, 0), size=512):
    from mathutils import Vector

    path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene = bpy.context.scene

    bpy.ops.object.camera_add(location=camera_location)
    cam = bpy.context.active_object
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    bpy.ops.object.light_add(type="AREA", location=(2, -2, 3))
    key = bpy.context.active_object
    key.data.energy = 300
    key.data.size = 3
    key.rotation_euler = (math.radians(40), 0, math.radians(45))

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.07, 0.15, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world

    scene.view_settings.view_transform = "AgX"
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"Wrote {path}")
