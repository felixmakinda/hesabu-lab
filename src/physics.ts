// Marble physics using Rapier (a Rust engine compiled to WebAssembly).
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { LAYOUT, TUBE_TOP } from "./world";
import { makeMarbleMesh } from "./marbles";

const STEP = 1 / 60;

export interface Marble {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
}

export class Physics {
  private world: RAPIER.World;
  private accumulator = 0;
  readonly marbles: Marble[] = [];

  private constructor(private scene: THREE.Scene) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.buildTube();
  }

  static async create(scene: THREE.Scene) {
    await RAPIER.init();
    return new Physics(scene);
  }

  /** Four invisible walls and a floor: a square tube just wider than a marble. */
  private buildTube() {
    const { tubeX, tubeBottom, tubeHalfWidth: w, tubeH } = LAYOUT;
    const t = 0.05;
    const hh = (tubeH + 1) / 2; // walls rise a little above the glass to catch bounces
    const cy = tubeBottom + hh;
    const fixed = (hx: number, hy: number, hz: number, x: number, y: number, z: number) =>
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
    fixed(t, hh, w + t, tubeX - w - t, cy, 0);
    fixed(t, hh, w + t, tubeX + w + t, cy, 0);
    fixed(w + t, hh, t, tubeX, cy, -w - t);
    fixed(w + t, hh, t, tubeX, cy, w + t);
    fixed(w + t, t, w + t, tubeX, tubeBottom - t, 0);
  }

  /** Drop a marble from the feeder pipe into the tube. */
  dropMarble(index: number): Marble {
    const jitter = () => (Math.random() - 0.5) * 0.04;
    const y = Math.max(TUBE_TOP + 0.5, LAYOUT.pipeBottom - 0.25);
    return this.addMarble(makeMarbleMesh(index), new THREE.Vector3(LAYOUT.tubeX + jitter(), y, jitter()));
  }

  /** Put an existing display marble back under physics, e.g. poured into the tube. */
  addMarble(mesh: THREE.Mesh, at: THREE.Vector3): Marble {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(at.x, at.y, at.z)
        .setLinvel(0, -1.5, 0)
        .setAngvel({ x: Math.random() * 6, y: 0, z: Math.random() * 6 }),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(LAYOUT.marbleR).setRestitution(0.35).setFriction(0.4).setDensity(2.5),
      body,
    );
    this.scene.add(mesh);
    const marble = { body, mesh };
    this.marbles.push(marble);
    this.sync(marble);
    return marble;
  }

  /** Stop simulating a marble; its mesh stays where it is so it can be animated. */
  freeze(marble: Marble) {
    this.world.removeRigidBody(marble.body);
    const i = this.marbles.indexOf(marble);
    if (i >= 0) this.marbles.splice(i, 1);
  }

  /** True once every marble has (nearly) stopped moving. */
  settled() {
    return this.marbles.every((m) => {
      const v = m.body.linvel();
      return Math.hypot(v.x, v.y, v.z) < 0.08;
    });
  }

  update(dt: number) {
    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    while (this.accumulator >= STEP) {
      this.world.step();
      this.accumulator -= STEP;
    }
    this.marbles.forEach((m) => this.sync(m));
  }

  private sync({ body, mesh }: Marble) {
    const p = body.translation();
    const r = body.rotation();
    mesh.position.set(p.x, p.y, p.z);
    mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
