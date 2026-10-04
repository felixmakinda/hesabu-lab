// Builds the 3D factory: renderer, lights, glow, the ones tube, the tens shelf,
// the ten-frame rack, the overhead truck rail and the bin.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { MARBLE_R } from "./marbles";

// Tens live on the LEFT and ones on the RIGHT, matching how numbers are written.
export const LAYOUT = {
  marbleR: MARBLE_R,
  tubeX: 2.4,
  tubeBottom: 0.3,
  tubeH: 3.6,
  tubeHalfWidth: 0.2, // inner half-width of the (square) physics tube
  pipeBottom: 4.7,
  shelfX: -2.4,
  shelfTop: 0.25,
  crateSize: 0.8,
  railY: 2.85, // top of the overhead rail
  railZ: -0.6,
  binX: 1.55,
  truckScale: 1.15,
  smallMarble: 0.75, // scale of marbles shown in trucks and the bin
};
export const TUBE_TOP = LAYOUT.tubeBottom + LAYOUT.tubeH;

export const COLORS = {
  tens: 0xff8c42, // orange = tens (crates)
  ones: 0x4ee6ff, // cyan = ones (marbles)
  pink: 0xff5fa2, // leftovers / taken away
  bg: 0x0e1426,
};

export const TRUCK_COLORS = [0xff5fa2, 0x7cff8a, 0xffd166, 0xb18cff, 0x4ee6ff];

/** Shelf position for the i-th crate: a row of 5 with a row of 4 on top. */
export function crateSlot(i: number): THREE.Vector3 {
  const row = i < 5 ? 0 : 1;
  const col = row === 0 ? i : i - 5;
  const x = LAYOUT.shelfX + (col - (row === 0 ? 2 : 1.5)) * 0.9;
  const y = LAYOUT.shelfTop + LAYOUT.crateSize / 2 + row * (LAYOUT.crateSize + 0.02);
  return new THREE.Vector3(x, y, 0);
}

/**
 * Ten-frame rack between the shelf and the tube: two frames of 2 columns × 5 rows.
 * Opened crates pour their ten marbles in here, filling bottom row first.
 */
const RACK = { x0: 0.2, frameStep: 0.78, cell: 0.36, y0: 0.45, z: 0.1 };
export function rackSlot(k: number): THREE.Vector3 {
  const frame = Math.floor(k / 10);
  const j = k % 10;
  const col = j % 2;
  const row = Math.floor(j / 2);
  return new THREE.Vector3(
    RACK.x0 + frame * RACK.frameStep + RACK.cell / 2 + col * RACK.cell,
    RACK.y0 + row * RACK.cell,
    RACK.z,
  );
}

/** Small marbles stack 3 across, in layers, inside a truck bed or the bin. */
function stackOffset(k: number) {
  const r = LAYOUT.marbleR * LAYOUT.smallMarble;
  return new THREE.Vector3(((k % 3) - 1) * r * 2, r + Math.floor(k / 3) * r * 2, 0);
}

export function truckX(i: number) {
  return -4.3 + i * 1.2;
}

/** Where the k-th marble sits inside truck i (world space). */
export function truckSlot(i: number, k: number): THREE.Vector3 {
  const s = LAYOUT.truckScale; // bed centre and floor height come from blender/truck.py
  return new THREE.Vector3(truckX(i) - 0.16 * s, LAYOUT.railY + 0.28 * s, LAYOUT.railZ).add(stackOffset(k));
}

/** Where the k-th marble sits in the leftover tray (3 across, up to 3 rows). */
export function binSlot(k: number): THREE.Vector3 {
  return new THREE.Vector3(LAYOUT.binX, LAYOUT.railY + BIN.floor, LAYOUT.railZ).add(stackOffset(k));
}
const BIN = { W: 0.9, D: 0.45, floor: 0.06, H: 0.9 };

/** Screen space (CSS px from each edge) that the HUD covers on phones; see hud.sceneInsets. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The part of the world that must stay in view on small screens: trucks and shelf on the
 * left, the tube and its numbers on the right, count labels below and the pipe lid on top.
 */
const CONTENT = { x0: -5.1, x1: 3.2, y0: -0.6, y1: 4.9 };

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rings: THREE.Mesh[];
  lid: THREE.Mesh;
  tensLabel: HTMLElement;
  onesLabel: HTMLElement;
  binLabel: HTMLElement;
  binSlots: THREE.MeshStandardMaterial;
  makeCrate: () => THREE.Object3D;
  makeTruck: (color: number) => THREE.Object3D;
  makeLabel: (className: string, at: THREE.Vector3) => { el: HTMLElement; obj: CSS2DObject };
  showProps: (props: { rack: boolean; rail: boolean }) => void;
  update: (dt: number) => void;
  /** Pass the HUD insets when they may have changed; with none, the last ones are reused. */
  resize: (insets?: Insets | null) => void;
  render: (shake: THREE.Vector3) => void;
}

const metal = (color: number, roughness = 0.35) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness });
const glow = (color: number, intensity: number) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });

export async function createWorld(container: HTMLElement): Promise<World> {
  // ---------- Renderer & post-processing ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  // Render above screen resolution on ordinary (non-retina) laptop screens for crisper edges.
  const dpr = window.devicePixelRatio || 1;
  let pixelRatio = Math.min(dpr < 1.5 ? dpr * 1.5 : dpr, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "labels";
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  const fog = new THREE.Fog(COLORS.bg, 14, 30);
  scene.fog = fog;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const lookAt = new THREE.Vector3(0.4, 2.3, 0);

  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.35, 0.85));
  composer.addPass(new OutputPass());

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x1a1a2e, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(4, 10, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -4 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const cyanLight = new THREE.PointLight(COLORS.ones, 4, 6);
  cyanLight.position.set(LAYOUT.tubeX, 2, 1.6);
  const orangeLight = new THREE.PointLight(COLORS.tens, 3, 6);
  orangeLight.position.set(LAYOUT.shelfX, 2.6, 1.8);
  scene.add(cyanLight, orangeLight);

  // ---------- Factory room ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x1b2440, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(60, 60, 0x34467a, 0x26325a);
  grid.position.y = 0.002;
  scene.add(grid);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 20),
    new THREE.MeshStandardMaterial({ color: 0x151d34, roughness: 0.9 }),
  );
  wall.position.set(0, 10, -4.5);
  wall.receiveShadow = true;
  scene.add(wall);

  const updateGears = buildGears(scene);

  // ---------- Tens shelf (left) ----------
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.9, LAYOUT.shelfTop, 1.5), metal(0x2b3352, 0.5));
  shelf.position.set(LAYOUT.shelfX, LAYOUT.shelfTop / 2, 0);
  shelf.receiveShadow = shelf.castShadow = true;
  scene.add(shelf);
  const shelfStrip = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.05, 0.03), glow(COLORS.tens, 4));
  shelfStrip.position.set(LAYOUT.shelfX, LAYOUT.shelfTop - 0.03, 0.76);
  scene.add(shelfStrip);

  // ---------- Ones tube (right) ----------
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, LAYOUT.tubeBottom, 32), metal(0x2b3352, 0.5));
  base.position.set(LAYOUT.tubeX, LAYOUT.tubeBottom / 2, 0);
  base.castShadow = base.receiveShadow = true;
  scene.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.025, 8, 48), glow(COLORS.ones, 4));
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.set(LAYOUT.tubeX, LAYOUT.tubeBottom, 0);
  scene.add(baseRing);

  // Very thin glass so the glowing marbles inside stay clearly visible.
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, LAYOUT.tubeH, 48, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xbff4ff,
      transparent: true,
      opacity: 0.07,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glass.position.set(LAYOUT.tubeX, LAYOUT.tubeBottom + LAYOUT.tubeH / 2, 0);
  glass.renderOrder = 2;
  scene.add(glass);

  const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 10, 40), metal(0x8aa0d0, 0.25));
  topRim.rotation.x = Math.PI / 2;
  topRim.position.set(LAYOUT.tubeX, TUBE_TOP, 0);
  scene.add(topRim);

  // One ring per marble level: they light up as the tube fills (a vertical ten-frame).
  const rings: THREE.Mesh[] = [];
  for (let i = 1; i <= 10; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.295, 0.008, 6, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a3b5c, emissive: COLORS.ones, emissiveIntensity: 0 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(LAYOUT.tubeX, LAYOUT.tubeBottom + i * LAYOUT.marbleR * 2, 0);
    scene.add(ring);
    rings.push(ring);
    const num = document.createElement("div");
    num.className = "ring-num";
    num.textContent = String(i);
    const tag = new CSS2DObject(num);
    tag.position.set(LAYOUT.tubeX + 0.5, ring.position.y - LAYOUT.marbleR, 0);
    scene.add(tag);
  }

  // Feeder pipe the marbles drop out of, and the lid that seals ten into a crate.
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 6, 32, 1, true), metal(0x6c7aa8, 0.3));
  pipe.material.side = THREE.DoubleSide;
  pipe.position.set(LAYOUT.tubeX, LAYOUT.pipeBottom + 3, 0);
  scene.add(pipe);
  const pipeLip = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 10, 40), metal(0x8aa0d0, 0.25));
  pipeLip.rotation.x = Math.PI / 2;
  pipeLip.position.set(LAYOUT.tubeX, LAYOUT.pipeBottom, 0);
  scene.add(pipeLip);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 32), metal(COLORS.tens, 0.3));
  lid.position.set(LAYOUT.tubeX, LAYOUT.pipeBottom + 0.08, 0);
  lid.castShadow = true;
  scene.add(lid);

  // ---------- Ten-frame rack (for opened crates) ----------
  const rack = buildRack();
  scene.add(rack);

  // ---------- Overhead rail for trucks, with the bin at its end ----------
  const { rail, binSlots } = buildRail();
  scene.add(rail);

  // ---------- Floating labels ----------
  const makeLabel = (className: string, at: THREE.Vector3) => {
    const el = document.createElement("div");
    el.className = `world-label ${className}`;
    const obj = new CSS2DObject(el);
    obj.position.copy(at);
    scene.add(obj);
    return { el, obj };
  };
  const tensLabel = makeLabel("tens", new THREE.Vector3(LAYOUT.shelfX, -0.05, 1.2)).el;
  const onesLabel = makeLabel("ones", new THREE.Vector3(LAYOUT.tubeX - 0.4, -0.05, 1.2)).el;
  const bin = makeLabel("pink bin", new THREE.Vector3(LAYOUT.binX, LAYOUT.railY + 1.15, LAYOUT.railZ));
  rail.add(bin.obj); // hides with the rail

  // ---------- Models made in Blender (see blender/*.py) ----------
  const [crateTemplate, truckTemplate] = await Promise.all([loadModel("crate.glb"), loadModel("truck.glb")]);
  const makeCrate = () => {
    const c = crateTemplate.clone();
    c.scale.setScalar(LAYOUT.crateSize);
    return c;
  };
  const makeTruck = (color: number) => {
    const t = truckTemplate.clone();
    t.scale.setScalar(LAYOUT.truckScale);
    t.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.name === "TruckBody") {
        mesh.material = mat.clone();
        (mesh.material as THREE.MeshStandardMaterial).color.set(color);
      }
    });
    return t;
  };

  const showProps = ({ rack: showRack, rail: showRail }: { rack: boolean; rail: boolean }) => {
    rack.visible = showRack;
    rail.visible = showRail;
  };
  showProps({ rack: false, rail: false });

  // ---------- Quality guard ----------
  // If the device can't keep up, lower the resolution: first to native on laptops, then in
  // steps down to 1× on phones (whose screens are 2-3×). Checked every 3 s, at most twice.
  let frames = 0;
  let elapsed = 0;
  let checks = 0;
  const update = (dt: number) => {
    updateGears(dt);
    if (checks >= 2) return;
    frames++;
    elapsed += dt;
    if (elapsed < 3) return;
    const fps = frames / elapsed;
    frames = elapsed = 0;
    checks++;
    if (fps >= 40 || pixelRatio <= 1) {
      checks = 2;
      return;
    }
    pixelRatio = Math.max(1, Math.min(dpr, pixelRatio * 0.7));
    renderer.setPixelRatio(pixelRatio);
    composer.setPixelRatio(pixelRatio);
    resize();
  };

  // ---------- Resize & render ----------
  let insets: Insets | null = null;
  const resize = (next?: Insets | null) => {
    if (next !== undefined) insets = next;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    if (insets) {
      frameContent(w, h, insets);
    } else {
      // Desktop: pull the camera back on narrow screens so both shelf and tube fit.
      const dist = aspect < 1.4 ? 11.5 + (1.4 - aspect) * 9 : 11.5;
      camera.position.set(lookAt.x, lookAt.y + 1.3, dist);
      camera.lookAt(lookAt);
      camera.clearViewOffset();
    }
    // Fog starts just behind the scene, wherever the camera is (14-30 at the desktop distance).
    const camDist = camera.position.distanceTo(lookAt);
    fog.near = camDist + 2.5;
    fog.far = camDist + 18.5;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    labelRenderer.setSize(w, h);
  };
  // Phones: fit CONTENT into the part of the screen the HUD leaves free. The camera distance
  // sets the zoom, and a view offset slides the picture so it's centred in that free area.
  const frameContent = (w: number, h: number, i: Insets) => {
    const freeW = Math.max(w - i.left - i.right, 1);
    const freeH = Math.max(h - i.top - i.bottom, 1);
    const margin = 1.06;
    const pxPerUnit = Math.min(
      freeW / ((CONTENT.x1 - CONTENT.x0) * margin),
      freeH / ((CONTENT.y1 - CONTENT.y0) * margin),
    );
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const dist = Math.max(h / 2 / (pxPerUnit * Math.tan(halfFov)), 9);
    const centre = new THREE.Vector3((CONTENT.x0 + CONTENT.x1) / 2, (CONTENT.y0 + CONTENT.y1) / 2, 0);
    camera.position.set(centre.x, centre.y + dist * 0.113, dist); // same slight downward tilt as desktop
    camera.lookAt(centre);
    const freeCx = i.left + freeW / 2;
    const freeCy = i.top + freeH / 2;
    camera.setViewOffset(w, h, w / 2 - freeCx, h / 2 - freeCy, w, h);
  };

  resize();

  const render = (shake: THREE.Vector3) => {
    camera.position.add(shake);
    composer.render();
    labelRenderer.render(scene, camera);
    camera.position.sub(shake);
  };

  return {
    renderer, scene, camera, rings, lid, tensLabel, onesLabel, binLabel: bin.el, binSlots,
    makeCrate, makeTruck, makeLabel, showProps, update, resize, render,
  };
}

// ---------- Props ----------

function buildRack() {
  const g = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x18213d, roughness: 0.6 });
  const cupMat = glow(COLORS.ones, 0.5);
  const edgeMat = glow(COLORS.ones, 2.5);
  for (let f = 0; f < 2; f++) {
    const cx = RACK.x0 + f * RACK.frameStep + RACK.cell;
    const h = RACK.cell * 5 + 0.12;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(RACK.cell * 2 + 0.1, h, 0.06), panelMat);
    panel.position.set(cx, RACK.y0 - RACK.cell / 2 - 0.06 + h / 2, RACK.z - LAYOUT.marbleR - 0.05);
    panel.receiveShadow = true;
    g.add(panel);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(RACK.cell * 2 + 0.1, 0.03, 0.03), edgeMat);
    edge.position.set(cx, RACK.y0 - RACK.cell / 2 - 0.06, RACK.z + 0.05);
    g.add(edge);
    for (let j = 0; j < 10; j++) {
      const cup = new THREE.Mesh(new THREE.TorusGeometry(LAYOUT.marbleR + 0.01, 0.012, 6, 32), cupMat);
      cup.position.copy(rackSlot(f * 10 + j)).setZ(RACK.z - LAYOUT.marbleR - 0.01);
      g.add(cup);
    }
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.5), metal(0x2b3352, 0.5));
  stand.position.set(RACK.x0 + 0.75, 0.08, RACK.z - 0.1);
  stand.castShadow = stand.receiveShadow = true;
  g.add(stand);
  return g;
}

function buildRail() {
  const g = new THREE.Group();
  const y = LAYOUT.railY;
  const z = LAYOUT.railZ;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.1, 0.8), metal(0x3a4670, 0.4));
  beam.position.set(-1.45, y - 0.05, z);
  beam.castShadow = beam.receiveShadow = true;
  g.add(beam);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.03, 0.03), glow(TRUCK_COLORS[0], 1.5));
  strip.position.set(-1.45, y - 0.08, z + 0.41);
  g.add(strip);
  // Hanging cables up out of view
  for (const x of [-4.95, -1.25, 0.95]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 8, 8), metal(0x8aa0d0, 0.3));
    cable.position.set(x, y + 4, z);
    g.add(cable);
  }
  // Leftover tray: a glass-fronted case with a dark back so every marble inside is
  // easy to see, and dim slot rings so an empty tray clearly shows "nothing here".
  const { W, D, H, floor: F } = BIN;
  const x0 = LAYOUT.binX;
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.04), new THREE.MeshStandardMaterial({ color: 0x120c22, roughness: 0.6 }));
  back.position.set(x0, y + H / 2, z - D / 2);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, F, D + 0.06), metal(0x2b3352, 0.45));
  base.position.set(x0, y + F / 2, z);
  base.castShadow = base.receiveShadow = true;
  g.add(back, base);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffc2dc, transparent: true, opacity: 0.1, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H - F), glassMat);
  front.position.set(x0, y + F + (H - F) / 2, z + D / 2);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(D, H - F), glassMat);
    wall.rotation.y = Math.PI / 2;
    wall.position.set(x0 + (side * W) / 2, y + F + (H - F) / 2, z);
    g.add(wall);
  }
  front.renderOrder = 2;
  g.add(front);
  // Glowing pink frame around the glass front
  const edge = glow(COLORS.pink, 2.5);
  for (const [w, h, px, py] of [
    [W + 0.04, 0.03, 0, H], [W + 0.04, 0.03, 0, F],
    [0.03, H - F, -W / 2, F + (H - F) / 2], [0.03, H - F, W / 2, F + (H - F) / 2],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), edge);
    bar.position.set(x0 + px, y + py, z + D / 2 + 0.01);
    g.add(bar);
  }
  // Empty slots: a 3 × 3 grid of rings on the back panel, one per place a marble can sit
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x3a1f35, emissive: COLORS.pink, emissiveIntensity: 0.35 });
  for (let k = 0; k < 9; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(LAYOUT.marbleR * LAYOUT.smallMarble, 0.01, 6, 28), slotMat);
    ring.position.copy(binSlot(k)).setZ(z - D / 2 + 0.03);
    g.add(ring);
  }
  return { rail: g, binSlots: slotMat };
}

/**
 * Two gears that properly mesh on the left, one on the right.
 * Teeth share the same size (module), centre distance = sum of pitch radii,
 * and the driven gear turns at the right ratio with its teeth phased into the gaps.
 */
function buildGears(scene: THREE.Scene) {
  const MODULE = 0.2;
  const make = (teeth: number, color: number) => {
    const mesh = new THREE.Mesh(gearGeometry(teeth, MODULE), metal(color, 0.4));
    mesh.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 24), metal(0x8aa0d0, 0.25));
    hub.rotation.x = Math.PI / 2;
    mesh.add(hub);
    scene.add(mesh);
    return mesh;
  };
  const pitchR = (n: number) => (MODULE * n) / 2;

  const nA = 16, nB = 10, nC = 18;
  const A = make(nA, 0x3a4a78);
  const B = make(nB, 0x4a5a8a);
  const C = make(nC, 0x34446e);
  const z = -4.2;
  A.position.set(-6.2, 5.0, z);
  const phi = THREE.MathUtils.degToRad(32); // direction from A to B
  const dist = pitchR(nA) + pitchR(nB);
  B.position.set(A.position.x + dist * Math.cos(phi), A.position.y + dist * Math.sin(phi), z);
  C.position.set(6.6, 5.6, z);

  const ratio = nA / nB;
  const phase = phi + Math.PI + ratio * phi - Math.PI / nB;
  let angle = 0;
  return (dt: number) => {
    angle += dt * 0.25;
    A.rotation.z = angle;
    B.rotation.z = -ratio * angle + phase;
    C.rotation.z = -angle * 0.7;
  };
}

/** Flat gear outline (tooth 0 centred on +X) with lightening holes, extruded toward the camera. */
function gearGeometry(teeth: number, module: number) {
  const r = (module * teeth) / 2;
  const rOut = r + module;
  const rRoot = r - 1.25 * module;
  const p = (Math.PI * 2) / teeth;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const c = i * p;
    const pts: [number, number][] = [
      [rRoot, c - 0.32 * p],
      [rOut, c - 0.13 * p],
      [rOut, c + 0.13 * p],
      [rRoot, c + 0.32 * p],
      [rRoot, c + 0.5 * p],
    ];
    pts.forEach(([rad, a], k) => {
      const x = rad * Math.cos(a);
      const y = rad * Math.sin(a);
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const holes = Math.max(4, Math.min(6, Math.floor(teeth / 3)));
  for (let h = 0; h < holes; h++) {
    const a = (h / holes) * Math.PI * 2;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.18, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -0.11);
  return geo;
}

async function loadModel(file: string): Promise<THREE.Object3D> {
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${file}`);
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    return gltf.scene;
  } catch {
    // Fallback if a model is missing: a plain box.
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: COLORS.tens }));
    box.castShadow = true;
    return box;
  }
}
