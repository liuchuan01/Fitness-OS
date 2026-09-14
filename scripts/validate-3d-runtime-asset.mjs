import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(
  root,
  "3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const glbPath = resolve(root, "3d-muscles", manifest.assets.combined_draco);
const bytes = await readFile(glbPath);
const errors = [];

if (bytes.toString("ascii", 0, 4) !== "glTF") errors.push("invalid GLB magic");
if (bytes.readUInt32LE(4) !== 2) errors.push("GLB version must be 2");
if (bytes.readUInt32LE(8) !== bytes.length) errors.push("GLB header length mismatch");
if ((await stat(glbPath)).size !== manifest.stats.glb_bytes) {
  errors.push("manifest glb_bytes does not match file");
}

const jsonLength = bytes.readUInt32LE(12);
const jsonType = bytes.toString("ascii", 16, 20);
if (jsonType !== "JSON") errors.push("first GLB chunk must be JSON");
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/u, ""));
const nodeNames = new Set((gltf.nodes ?? []).map((node) => node.name).filter(Boolean));
const normalize = (value) => value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const normalizedNodes = new Set([...nodeNames].map(normalize));
const targets = Object.values(manifest.targets).flat();

for (const target of targets) {
  if (!normalizedNodes.has(normalize(target))) errors.push(`GLB node missing: ${target}`);
}
for (const skinTarget of manifest.skin_targets ?? []) {
  if (!normalizedNodes.has(normalize(skinTarget))) errors.push(`GLB skin node missing: ${skinTarget}`);
}

if (!(gltf.extensionsUsed ?? []).includes("KHR_draco_mesh_compression")) {
  errors.push("GLB is not Draco compressed");
}
if (manifest.stats.armatures !== 0) errors.push("runtime asset must not contain armatures");
if (!manifest.stats.genital_region_flattened) errors.push("genital region must be flattened");
if (manifest.stats.glb_bytes >= 8 * 1024 * 1024) errors.push("GLB exceeds 8MB mobile budget");
if (manifest.stats.skin_polygons >= 30000) errors.push("skin exceeds 30k triangle budget");
if (manifest.stats.muscle_polygons >= 120000) errors.push("muscles exceed 120k triangle budget");
if (manifest.stats.muscle_objects >= 150) errors.push("muscle draw-call proxy exceeds 150");
if (targets.length !== 133) errors.push(`expected 133 runtime targets, found ${targets.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Runtime asset valid: ${(bytes.length / 1024 / 1024).toFixed(2)}MB, ` +
      `${manifest.stats.skin_polygons} skin triangles, ` +
      `${manifest.stats.muscle_polygons} muscle triangles, ${targets.length} targets`
  );
}
