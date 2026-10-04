// The factory floor's moving parts, shared by every game mode:
// building a number, sealing ten ones into a crate, opening a crate back into
// ten ones, taking marbles away, and sharing marbles between trucks.
import * as THREE from "three";
import type { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import {
  binSlot, COLORS, crateSlot, LAYOUT, rackSlot, TRUCK_COLORS, truckSlot, truckX, TUBE_TOP, type World,
} from "./world";
import type { Marble, Physics } from "./physics";
import { ease, type Particles, type Shake, tween, wait } from "./fx";
import { disposeMarble, flashMarble, makeMarbleMesh } from "./marbles";
import { hud } from "./hud";
import * as sfx from "./audio";

interface Truck {
  obj: THREE.Object3D;
  label: HTMLElement;
  labelObj: CSS2DObject;
  marbles: THREE.Mesh[];
}

const SMALL = LAYOUT.smallMarble;

export class Factory {
  readonly tube: Marble[] = []; // ones in the tube (physics)
  readonly crates: THREE.Object3D[] = []; // tens on the shelf
  readonly rack: THREE.Mesh[] = []; // ones from opened crates
  readonly bin: THREE.Mesh[] = []; // taken away / left over
  readonly trucks: Truck[] = [];
  binName = "left over";
  private colorIndex = 0;
  private ringNums: HTMLElement[];

  constructor(
    readonly world: World,
    private physics: Physics,
    private particles: Particles,
    private shake: Shake,
  ) {
    this.ringNums = [...document.querySelectorAll<HTMLElement>(".ring-num")];
  }

  /** All loose ones: in the tube plus in the rack. */
  get loose() {
    return this.tube.length + this.rack.length;
  }

  // ---------- Labels ----------

  updateCounts() {
    const t = this.crates.length;
    const o = this.loose;
    const n = this.tube.length;
    this.world.tensLabel.textContent = `${t} ${t === 1 ? "ten" : "tens"}`;
    this.world.onesLabel.textContent = `${o} ${o === 1 ? "one" : "ones"}`;
    this.world.binLabel.textContent = `${this.binName}: ${this.bin.length}`;
    this.world.rings.forEach((ring, i) => {
      (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = i < n ? (n === 10 ? 1.6 : 0.7) : 0;
      this.ringNums[i]?.classList.toggle("lit", i < n);
    });
    this.trucks.forEach((tr) => (tr.label.textContent = String(tr.marbles.length)));
  }

  private bump(el: HTMLElement) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  async waitSettled(maxSeconds = 3) {
    for (let t = 0; t < maxSeconds && !this.physics.settled(); t += 0.1) await wait(0.1);
  }

  // ---------- Building numbers ----------

  dropMarble() {
    const m = this.physics.dropMarble(this.colorIndex++);
    m.mesh.scale.setScalar(0.01);
    void tween(0.15, (k) => m.mesh.scale.setScalar(Math.max(k, 0.01)), ease.outBack);
    this.tube.push(m);
    sfx.tink(this.tube.length);
    this.updateCounts();
    this.bump(this.world.onesLabel);
  }

  /** Drop a crate onto the next free shelf slot from above. */
  async placeCrate() {
    const crate = this.world.makeCrate();
    const slot = crateSlot(this.crates.length);
    crate.position.copy(slot).add(new THREE.Vector3(0, 5, 0));
    this.world.scene.add(crate);
    this.crates.push(crate);
    await tween(0.55, (k) => crate.position.setY(slot.y + 5 * (1 - k)), ease.outBounce);
    sfx.thud();
    this.shake.kick(0.12);
    this.particles.burst(slot.clone().setY(LAYOUT.shelfTop), 20, { colors: [COLORS.tens, 0xffd166], speed: 2, up: 1 });
    this.updateCounts();
    this.bump(this.world.tensLabel);
  }

  /** Lay out a number: its tens as crates, its ones as marbles in the tube. */
  async build(n: number) {
    for (let i = 0; i < Math.floor(n / 10); i++) await this.placeCrate();
    for (let i = 0; i < n % 10; i++) {
      this.dropMarble();
      await wait(0.16);
    }
    await this.waitSettled();
    await wait(0.3);
  }

  // ---------- Ten ones → one ten ----------

  /** Seal a full tube into a crate and fly it to the shelf. `onFormed` fires as the crate appears. */
  async seal(onFormed?: () => void) {
    hud.say("TEN marbles! Seal it!", "good");
    await this.waitSettled(1.5);
    await wait(0.15);

    // Lid slams down from the pipe
    const lid = this.world.lid;
    const lidUp = lid.position.y;
    const lidDown = TUBE_TOP + 0.07;
    await tween(0.25, (k) => lid.position.setY(lidUp + (lidDown - lidUp) * k), (t) => t * t * t);
    sfx.clunk();
    this.shake.kick(0.65);
    this.particles.burst(new THREE.Vector3(LAYOUT.tubeX, TUBE_TOP, 0.3), 90, { speed: 5 });

    // Marbles flash and squeeze together...
    const marbles = this.tube.splice(0);
    marbles.forEach((m) => this.physics.freeze(m));
    marbles.forEach((m) => flashMarble(m.mesh));
    const centre = new THREE.Vector3(LAYOUT.tubeX, LAYOUT.tubeBottom + LAYOUT.tubeH / 2 - 0.4, 0);
    const starts = marbles.map((m) => m.mesh.position.clone());
    await tween(0.4, (k) => marbles.forEach((m, i) => {
      m.mesh.position.lerpVectors(starts[i], centre, k);
      m.mesh.scale.setScalar(1 - 0.75 * k);
    }), ease.inOutCubic);
    marbles.forEach((m) => disposeMarble(m.mesh));

    // ...and a crate bursts out
    const crate = this.world.makeCrate();
    crate.position.copy(centre).setZ(0.9);
    crate.scale.setScalar(0.001);
    this.world.scene.add(crate);
    this.particles.burst(crate.position, 140, { colors: [COLORS.ones, COLORS.tens, 0xffd166, 0xffffff], speed: 6 });
    this.shake.kick(0.4);
    this.updateCounts();
    onFormed?.();
    hud.say("10 ones make 1 ten!", "good");
    void tween(0.5, (k) => lid.position.setY(lidDown + (lidUp - lidDown) * k), ease.inOutCubic);
    await tween(0.65, (k) => crate.scale.setScalar(LAYOUT.crateSize * Math.max(k, 0.001)), ease.outElastic);
    await wait(0.25);

    // Fly in an arc to the tens shelf
    sfx.whoosh();
    const slot = crateSlot(this.crates.length);
    await this.arc(crate, slot, { lift: 3, spin: true, duration: 0.85 });
    sfx.thud();
    this.shake.kick(0.25);
    this.particles.burst(slot.clone().setY(LAYOUT.shelfTop), 40, { colors: [COLORS.tens, 0xffd166], speed: 3, up: 1 });
    this.crates.push(crate);
    this.updateCounts();
    this.bump(this.world.tensLabel);
    // Squash on landing
    const s = LAYOUT.crateSize;
    await tween(0.35, (k) => {
      const q = Math.sin(k * Math.PI) * 0.18;
      crate.scale.set(s * (1 + q), s * (1 - q), s * (1 + q));
    });
  }

  // ---------- One ten → ten ones (borrowing) ----------

  /** Break the last crate open; its ten marbles pour into the ten-frame rack. */
  async openCrate() {
    const crate = this.crates.pop();
    if (!crate) return;
    this.updateCounts();
    const burstAt = new THREE.Vector3(0.95, 2.4, 0.9);
    sfx.whoosh();
    await this.arc(crate, burstAt, { lift: 1.5, spin: true, duration: 0.6 });
    // Wobble before bursting
    await tween(0.35, (k) => (crate.rotation.z = Math.sin(k * Math.PI * 6) * 0.15 * (1 - k)));
    sfx.pop();
    this.shake.kick(0.5);
    this.particles.burst(burstAt, 120, { colors: [COLORS.tens, COLORS.ones, 0xffd166], speed: 5 });
    crate.removeFromParent();

    const landings: Promise<void>[] = [];
    for (let j = 0; j < 10; j++) {
      const mesh = makeMarbleMesh(this.colorIndex++);
      mesh.position.copy(burstAt);
      this.world.scene.add(mesh);
      const slot = rackSlot(this.rack.length);
      this.rack.push(mesh);
      landings.push(
        wait(j * 0.07).then(async () => {
          await this.arc(mesh, slot, { lift: 0.8, duration: 0.45 });
          sfx.tink(j + 1);
          this.updateCounts();
        }),
      );
    }
    await Promise.all(landings);
    this.bump(this.world.onesLabel);
  }

  // ---------- Taking away ----------

  /** Lift one loose marble out (tube first, then rack) so it can be moved somewhere. */
  private takeLoose(): THREE.Mesh | undefined {
    if (this.tube.length > 0) {
      const top = this.tube.reduce((hi, m) => (m.mesh.position.y > hi.mesh.position.y ? m : hi));
      this.tube.splice(this.tube.indexOf(top), 1);
      this.physics.freeze(top);
      return top.mesh;
    }
    return this.rack.pop();
  }

  /** Move one loose marble into the bin. */
  async takeAway() {
    const mesh = this.takeLoose();
    if (!mesh) return;
    sfx.untink(this.loose + 1);
    this.updateCounts();
    const slot = binSlot(this.bin.length);
    this.bin.push(mesh);
    await this.arc(mesh, slot, { lift: 1.2, scale: SMALL, duration: 0.5 });
    this.updateCounts();
    this.bump(this.world.binLabel);
  }

  /** Draw the eye to the leftover tray: its empty slots pulse and the label bounces. */
  async highlightBin() {
    const mat = this.world.binSlots;
    this.bump(this.world.binLabel);
    await tween(1.4, (k) => (mat.emissiveIntensity = 0.35 + 2.2 * Math.abs(Math.sin(k * Math.PI * 3))));
    mat.emissiveIntensity = 0.35;
  }

  /** All remaining loose marbles go to the bin (the remainder). */
  async allToBin() {
    const n = this.loose;
    const moves: Promise<void>[] = [];
    for (let i = 0; i < n; i++) moves.push(wait(i * 0.15).then(() => this.takeAway()));
    await Promise.all(moves);
  }

  /** A whole crate is taken away: it flies off the top of the screen. */
  async takeCrate() {
    const crate = this.crates.pop();
    if (!crate) return;
    this.updateCounts();
    this.bump(this.world.tensLabel);
    sfx.whoosh();
    await this.arc(crate, new THREE.Vector3(-7, 9, -1), { lift: 2, spin: true, duration: 0.7, scale: 0.3 });
    crate.removeFromParent();
  }

  // ---------- Sharing (division) ----------

  async addTrucks(n: number) {
    sfx.vroom();
    const arrivals: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const color = TRUCK_COLORS[i % TRUCK_COLORS.length];
      const obj = this.world.makeTruck(color);
      obj.position.set(-9 - i * 1.2, LAYOUT.railY, LAYOUT.railZ);
      this.world.scene.add(obj);
      const { el, obj: labelObj } = this.world.makeLabel("truck", new THREE.Vector3(-0.14, 1.3, 0));
      el.style.color = `#${color.toString(16).padStart(6, "0")}`;
      obj.add(labelObj);
      const truck = { obj, label: el, labelObj, marbles: [] };
      this.trucks.push(truck);
      const from = obj.position.x;
      const to = truckX(i);
      arrivals.push(tween(1.1 + i * 0.12, (k) => (obj.position.x = from + (to - from) * k), ease.outBack));
    }
    await Promise.all(arrivals);
    this.updateCounts();
  }

  /** Give one marble to every truck, in turn. */
  async shareRound() {
    const gives: Promise<void>[] = [];
    this.trucks.forEach((truck, i) => {
      gives.push(
        wait(i * 0.14).then(async () => {
          const mesh = this.takeLoose();
          if (!mesh) return;
          this.updateCounts();
          const slot = truckSlot(i, truck.marbles.length);
          truck.marbles.push(mesh);
          await this.arc(mesh, slot, { lift: 1.4, scale: SMALL, duration: 0.5 });
          sfx.tink(truck.marbles.length);
          this.updateCounts();
          this.bump(truck.label);
        }),
      );
    });
    await Promise.all(gives);
  }

  // ---------- Reactions ----------

  /** Make each crate jump in turn, like counting them. */
  hopCrates() {
    this.crates.forEach((c, i) => {
      const y = crateSlot(i).y; // not c.position.y, which may be mid-hop
      setTimeout(() => {
        void tween(0.4, (k) => c.position.setY(y + Math.sin(k * Math.PI) * 0.5));
        sfx.tink(i + 1);
      }, i * 180);
    });
  }

  /** Bounce the trucks one by one (used for division hints). */
  hopTrucks() {
    this.trucks.forEach((t, i) => {
      setTimeout(() => {
        void tween(0.4, (k) => t.obj.position.setY(LAYOUT.railY + Math.sin(k * Math.PI) * 0.3));
        this.bump(t.label);
      }, i * 180);
    });
  }

  celebrate() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const at = new THREE.Vector3(-4 + Math.random() * 7, 4 + Math.random() * 1.5, Math.random());
        this.particles.burst(at, 90, {
          colors: [COLORS.ones, COLORS.tens, 0xffd166, 0xff5fa2, 0x7cff8a],
          speed: 5, gravity: 4, life: 1.8, up: 1,
        });
      }, i * 160);
    }
    this.hopCrates();
    this.hopTrucks();
  }

  // ---------- Reset ----------

  async clearAll() {
    const crates = this.crates.splice(0);
    const tube = this.tube.splice(0);
    tube.forEach((m) => this.physics.freeze(m));
    const meshes = [...tube.map((m) => m.mesh), ...this.rack.splice(0), ...this.bin.splice(0)];
    const trucks = this.trucks.splice(0);
    trucks.forEach((t) => meshes.push(...t.marbles));
    this.updateCounts();
    if (trucks.length) sfx.vroom();
    const truckStart = trucks.map((t) => t.obj.position.x);
    const scales = meshes.map((m) => m.scale.x);
    await tween(0.45, (k) => {
      crates.forEach((c) => c.scale.setScalar(LAYOUT.crateSize * (1 - k) + 0.001));
      meshes.forEach((m, i) => m.scale.setScalar(scales[i] * (1 - k) + 0.001));
      trucks.forEach((t, i) => (t.obj.position.x = truckStart[i] + k * 10));
    }, ease.inOutCubic);
    crates.forEach((c) => c.removeFromParent());
    meshes.forEach((m) => disposeMarble(m));
    trucks.forEach((t) => {
      t.labelObj.removeFromParent(); // removes its HTML element; removing the truck alone wouldn't
      t.obj.removeFromParent();
    });
  }

  // ---------- Motion helper ----------

  /** Move an object along a curved path, optionally spinning and rescaling. */
  private arc(
    obj: THREE.Object3D,
    to: THREE.Vector3,
    { lift = 1, spin = false, duration = 0.6, scale }: { lift?: number; spin?: boolean; duration?: number; scale?: number },
  ) {
    const from = obj.position.clone();
    const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, lift, 0.4));
    const s0 = obj.scale.x;
    const s1 = scale === undefined ? s0 : obj instanceof THREE.Mesh ? scale : LAYOUT.crateSize * scale;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    return tween(duration, (k) => {
      a.lerpVectors(from, ctrl, k);
      b.lerpVectors(ctrl, to, k);
      obj.position.lerpVectors(a, b, k);
      obj.scale.setScalar(s0 + (s1 - s0) * k);
      if (spin) obj.rotation.y = k * Math.PI * 2;
    }, ease.inOutCubic);
  }
}
