// One place that decides how a marble looks, used by physics marbles in the tube
// and by the "display" marbles that sit in the rack, trucks and bins.
import * as THREE from "three";

export const MARBLE_R = 0.17;
// Deep, saturated colours: lighter ones get washed out to pastel by tone mapping.
const COLORS = [0x00b4ff, 0xff1f6e, 0xffa800, 0x19e05a, 0x8a3dff, 0xff5a00];
const geometry = new THREE.SphereGeometry(MARBLE_R, 32, 20);

export function makeMarbleMesh(index: number): THREE.Mesh {
  const color = COLORS[index % COLORS.length];
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      // Moderate glow keeps the colour rich; too much and tone mapping washes it out to white.
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.4, // fewer white reflections over the colour
    }),
  );
  mesh.castShadow = true;
  return mesh;
}

export function disposeMarble(mesh: THREE.Mesh) {
  mesh.removeFromParent();
  (mesh.material as THREE.Material).dispose();
}

/** Brief bright flash, e.g. when a marble is counted or moved. */
export function flashMarble(mesh: THREE.Mesh, intensity = 2.5) {
  (mesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = intensity;
}
