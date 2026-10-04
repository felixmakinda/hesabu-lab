// "Juice": tweens, particle bursts and camera shake.
import * as THREE from "three";

// ---------- Tweens ----------

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: (t: number) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (t: number) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

interface Tween {
  elapsed: number;
  duration: number;
  update: (k: number) => void;
  easing: (t: number) => number;
  resolve: () => void;
}

const tweens: Tween[] = [];

/** Animate k from 0→1 over `duration` seconds. Resolves when finished. */
export function tween(
  duration: number,
  update: (k: number) => void,
  easing: (t: number) => number = ease.outCubic,
): Promise<void> {
  return new Promise((resolve) => tweens.push({ elapsed: 0, duration, update, easing, resolve }));
}

export const wait = (seconds: number) => tween(seconds, () => {});

export function updateTweens(dt: number) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.elapsed += dt;
    const t = Math.min(tw.elapsed / tw.duration, 1);
    tw.update(tw.easing(t));
    if (t >= 1) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
}

// ---------- Particles ----------

const MAX_PARTICLES = 1500;

export class Particles {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX_PARTICLES * 3);
  private col = new Float32Array(MAX_PARTICLES * 3);
  private vel = new Float32Array(MAX_PARTICLES * 3);
  private life = new Float32Array(MAX_PARTICLES);
  private maxLife = new Float32Array(MAX_PARTICLES);
  private gravity = new Float32Array(MAX_PARTICLES);
  private next = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: makeDotTexture(),
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.pos.fill(9999);
  }

  burst(
    at: THREE.Vector3,
    count: number,
    { speed = 4, colors = [0xffd166, 0xff8c42, 0x4ee6ff], life = 0.9, gravity = 9, up = 2 } = {},
  ) {
    const c = new THREE.Color();
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      dir.y += up;
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([dir.x, dir.y, dir.z], i * 3);
      c.set(colors[Math.floor(Math.random() * colors.length)]);
      this.col.set([c.r, c.g, c.b], i * 3);
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.4);
      this.gravity[i] = gravity;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= this.gravity[i] * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const fade = Math.max(this.life[i] / this.maxLife[i], 0);
      this.col[j] *= 0.985 + 0.015 * fade;
      this.col[j + 1] *= 0.985 + 0.015 * fade;
      this.col[j + 2] *= 0.985 + 0.015 * fade;
      if (this.life[i] <= 0) this.pos[j + 1] = 9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

function makeDotTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ---------- Camera shake ----------

export class Shake {
  private strength = 0;
  readonly offset = new THREE.Vector3();

  kick(amount: number) {
    this.strength = Math.max(this.strength, amount);
  }

  update(dt: number) {
    this.strength = Math.max(0, this.strength - dt * 2.5);
    const s = this.strength * this.strength;
    this.offset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
  }
}
