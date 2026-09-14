import json
import os
from pathlib import Path

import bmesh
import bpy


SRC_DIR = Path(os.environ["BODYPARTS3D_DIR"])
OUT_DIR = Path(os.environ["OUT_DIR"])
SOURCE_MAP_PATH = Path(os.environ["SOURCE_MAP_PATH"])
SKIN_FILE = os.environ.get("SKIN_FILE", "FMA7163.stl")
OUTPUT_PREFIX = os.environ.get("OUTPUT_PREFIX", "bodyparts3d-fitness-taxonomy")
SKIN_DECIMATE = float(os.environ.get("SKIN_DECIMATE", "0.08"))
MUSCLE_DECIMATE = float(os.environ.get("MUSCLE_DECIMATE", "0.025"))
REMOVE_GENITALS = os.environ.get("REMOVE_GENITALS", "1") == "1"

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_GLB = OUT_DIR / f"{OUTPUT_PREFIX}-draco.glb"
OUT_BLEND = OUT_DIR / f"{OUTPUT_PREFIX}.blend"
OUT_MANIFEST = OUT_DIR / f"{OUTPUT_PREFIX}-manifest.json"

SOURCE_MAP = json.loads(SOURCE_MAP_PATH.read_text())
PART_INDEX_PATH = SRC_DIR / "parts_list_e.txt"
PART_NAMES = {}
for line in PART_INDEX_PATH.read_text().splitlines():
    if "\t" not in line:
        continue
    target, label = line.split("\t", 1)
    PART_NAMES[target] = label.strip().lower()

GROUP_COLORS = {
    "chest": (1.0, 0.38, 0.32, 1.0),
    "shoulders": (1.0, 0.72, 0.30, 1.0),
    "scapular": (0.68, 0.48, 1.0, 1.0),
    "back": (0.36, 0.55, 1.0, 1.0),
    "upper_arm_anterior": (0.26, 0.58, 1.0, 1.0),
    "upper_arm_posterior": (0.20, 0.78, 0.86, 1.0),
    "forearm": (0.28, 0.86, 0.76, 1.0),
    "core": (1.0, 0.50, 0.28, 1.0),
    "glutes": (0.95, 0.48, 0.75, 1.0),
    "hip": (0.85, 0.48, 0.84, 1.0),
    "quadriceps": (1.0, 0.84, 0.30, 1.0),
    "adductors": (0.92, 0.55, 0.70, 1.0),
    "hamstrings": (0.95, 0.58, 0.38, 1.0),
    "lower_leg_posterior": (0.86, 0.74, 0.34, 1.0),
    "lower_leg_anterior": (0.72, 0.82, 0.30, 1.0),
    "lower_leg_lateral": (0.55, 0.80, 0.40, 1.0),
    "lower_leg_deep": (0.47, 0.68, 0.34, 1.0),
    "neck": (0.72, 0.42, 0.86, 1.0),
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_material(name, color, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color[:3] + (alpha,)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color[:3] + (alpha,)
        bsdf.inputs["Alpha"].default_value = alpha
        bsdf.inputs["Roughness"].default_value = 0.78
        bsdf.inputs["Metallic"].default_value = 0.02
    mat.surface_render_method = "DITHERED" if alpha < 1 else "DITHERED"
    return mat


def import_stl(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.wm.stl_import(filepath=str(path))
    created = [obj for obj in bpy.context.scene.objects if obj not in before]
    meshes = [obj for obj in created if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh imported from {path}")
    return meshes[0]


def side_for_target(target):
    name = PART_NAMES.get(target, "")
    if name.startswith("right ") or " of right " in name:
        return "right"
    if name.startswith("left ") or " of left " in name:
        return "left"
    if target in {"BP45", "BP47"}:
        return "right"
    if target in {"BP44", "BP46"}:
        return "left"
    return "center"


def apply_decimate(obj, ratio):
    if ratio >= 0.999 or len(obj.data.polygons) < 100:
        return
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new("web_decimate", "DECIMATE")
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def join_objects(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = objects[0]
    joined.name = name
    joined.data.name = f"{name}.mesh"
    return joined


def clip_rectus_region(obj, region):
    world_z = [(obj.matrix_world @ vertex.co).z for vertex in obj.data.vertices]
    split_z = min(world_z) + (max(world_z) - min(world_z)) * 0.52
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    to_delete = []
    for vertex in mesh.verts:
        z = (obj.matrix_world @ vertex.co).z
        if (region == "upper" and z < split_z) or (region == "lower" and z > split_z):
            to_delete.append(vertex)
    bmesh.ops.delete(mesh, geom=to_delete, context="VERTS")
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def flatten_genital_region(obj):
    vertices = obj.data.vertices
    xs = [vertex.co.x for vertex in vertices]
    zs = [vertex.co.z for vertex in vertices]
    height = max(zs) - min(zs)
    center_x = (min(xs) + max(xs)) * 0.5
    center_half_width = (max(xs) - min(xs)) * 0.20
    pelvis_min = min(zs) + height * 0.38
    pelvis_max = min(zs) + height * 0.56
    center_band = [
        vertex.co.y
        for vertex in vertices
        if abs(vertex.co.x - center_x) <= center_half_width and pelvis_min <= vertex.co.z <= pelvis_max
    ]
    if not center_band:
        return
    sorted_y = sorted(center_band)
    median_y = sorted_y[len(sorted_y) // 2]
    front_positive = (sorted_y[-1] - median_y) >= (median_y - sorted_y[0])
    front_index = int(len(sorted_y) * (0.80 if front_positive else 0.20))
    body_front = sorted_y[max(0, min(len(sorted_y) - 1, front_index))]
    for vertex in vertices:
        x, y, z = vertex.co
        x_distance = abs(x - center_x)
        if x_distance > center_half_width or not (pelvis_min <= z <= pelvis_max):
            continue
        protrudes = y > body_front if front_positive else y < body_front
        if not protrudes:
            continue
        vertical_fade = min(
            (z - pelvis_min) / (height * 0.025),
            (pelvis_max - z) / (height * 0.025),
            1.0,
        )
        side_fade = min((center_half_width - x_distance) / (center_half_width * 0.65), 1.0)
        fade = max(0.0, min(vertical_fade, side_fade))
        vertex.co.y = y * (1.0 - fade) + body_front * fade
    obj.data.update()


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=8,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )


clear_scene()
skin_material = make_material("skin.bodyparts3d.translucent", (0.58, 0.70, 0.78, 1.0), 0.18)
skin = import_stl(SRC_DIR / "stl" / SKIN_FILE)
skin.name = "skin.bodyparts3d.full.no_genitals"
skin.data.name = f"{skin.name}.mesh"
skin.data.materials.append(skin_material)
if REMOVE_GENITALS:
    flatten_genital_region(skin)
apply_decimate(skin, SKIN_DECIMATE)

taxonomy_groups = {}
taxonomy_path = SOURCE_MAP_PATH.parent / "muscles.md"
for line in taxonomy_path.read_text().splitlines():
    if not line.startswith("|") or "---" in line or "一级组 id" in line:
        continue
    cells = [cell.strip() for cell in line.split("|")[1:-1]]
    taxonomy_groups[cells[2]] = cells[0]

targets = {}
source_files = {"skin": SKIN_FILE}
display_modes = {}
coverage = {}

for muscle_id, config in SOURCE_MAP["muscles"].items():
    group = taxonomy_groups[muscle_id]
    material = make_material(f"muscle.bodyparts3d.{group}", GROUP_COLORS[group])
    side_objects = {"right": [], "left": [], "center": []}
    source_files[muscle_id] = []

    for target in config["source_targets"]:
        obj = import_stl(SRC_DIR / "stl" / f"{target}.stl")
        side_objects[side_for_target(target)].append(obj)
        source_files[muscle_id].append(f"{target}.stl")

    targets[muscle_id] = []
    for side, objects in side_objects.items():
        if not objects:
            continue
        name = f"muscle.{muscle_id}.{side}"
        obj = join_objects(objects, name)
        if config.get("derivation", {}).get("type") == "split_real_mesh":
            clip_rectus_region(obj, config["derivation"]["region"])
        apply_decimate(obj, MUSCLE_DECIMATE)
        obj.data.materials.clear()
        obj.data.materials.append(material)
        obj["muscle_id"] = muscle_id
        obj["coverage"] = config["planned_coverage"]
        obj["display_mode"] = config.get("display_mode", "normal")
        targets[muscle_id].append(name)

    display_modes[muscle_id] = config.get("display_mode", "normal")
    coverage[muscle_id] = config["planned_coverage"]

bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
export_glb(OUT_GLB)

mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
muscle_objects = [obj for obj in mesh_objects if obj.name.startswith("muscle.")]
manifest = {
    "version": "1.0-bodyparts3d-fitness-taxonomy",
    "runtime": "static-glb-draco",
    "status": "local-taxonomy-candidate",
    "assets": {"combined_draco": OUT_GLB.name},
    "skin_targets": [skin.name],
    "targets": targets,
    "source_files": source_files,
    "coverage": coverage,
    "display_modes": display_modes,
    "sources": SOURCE_MAP["source"],
    "stats": {
        "glb_bytes": OUT_GLB.stat().st_size,
        "mesh_objects": len(mesh_objects),
        "muscle_objects": len(muscle_objects),
        "vertices": sum(len(obj.data.vertices) for obj in mesh_objects),
        "polygons": sum(len(obj.data.polygons) for obj in mesh_objects),
        "skin_polygons": len(skin.data.polygons),
        "muscle_polygons": sum(len(obj.data.polygons) for obj in muscle_objects),
        "armatures": len([obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]),
        "genital_region_flattened": REMOVE_GENITALS,
    },
    "known_limits": [
        "BodyParts3D v3 is a single male anatomy model.",
        "CC BY-SA 2.1 Japan attribution and share-alike obligations apply.",
        "Rectus abdominis upper/lower targets are geometric splits of real source meshes.",
        "Composite fitness regions remain marked partial in the contract.",
    ],
}
OUT_MANIFEST.write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest["stats"], indent=2))
