import { DoubleSide, Mesh, MeshBasicMaterial, type Object3D } from "three";

/** Resolve the nearest muscle surface before transparent color blending. */
export function addMuscleDepthPrepass(scene: Object3D) {
  const muscles: Mesh[] = [];
  scene.traverse((node) => {
    if (node instanceof Mesh && !node.name.toLowerCase().startsWith("skin")) {
      muscles.push(node);
    }
  });
  for (const muscle of muscles) {
    const depth = new Mesh(
      muscle.geometry,
      new MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: DoubleSide })
    );
    depth.name = `${muscle.name}.depth`;
    // A child follows the parent's visibility and transform, but never intercepts picking.
    depth.raycast = () => {};
    muscle.add(depth);
  }
}
