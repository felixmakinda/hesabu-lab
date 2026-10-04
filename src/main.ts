// Startup, the mode menu and the round loop. Each mode lives in src/modes/.
import "./style.css";
import * as THREE from "three";
import { createWorld } from "./world";
import { Physics } from "./physics";
import { Particles, Shake, updateTweens, wait } from "./fx";
import { Factory } from "./factory";
import { hud, initHud } from "./hud";
import * as sfx from "./audio";
import type { Level } from "./math/util";
import { playAddition } from "./modes/addition";
import { playSubtraction } from "./modes/subtraction";
import { playMultiplication } from "./modes/multiplication";
import { playDivision } from "./modes/division";

type Play = (f: Factory, level: Level) => Promise<string>;

const MODES: Record<string, Play> = {
  add: playAddition,
  sub: playSubtraction,
  mul: playMultiplication,
  div: playDivision,
};

const LEVEL_UP_AFTER = 3;

async function main() {
  const world = await createWorld(document.getElementById("app")!);
  const physics = await Physics.create(world.scene);
  const particles = new Particles();
  world.scene.add(particles.points);
  const shake = new Shake();
  const factory = new Factory(world, physics, particles, shake);
  initHud();
  factory.updateCounts();

  // ---------- Loop ----------
  // `?test` lets big time steps through, so slow headless browsers can play-test quickly.
  const maxDt = new URLSearchParams(location.search).has("test") ? 0.25 : 0.05;
  const timer = new THREE.Timer();
  world.renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), maxDt);
    physics.update(dt);
    updateTweens(dt);
    particles.update(dt);
    shake.update(dt);
    world.update(dt);
    world.render(shake.offset);
  });
  // Phone layouts reserve parts of the screen for the HUD; the camera frames the scene around them.
  const fit = () => world.resize(hud.sceneInsets());
  fit();
  window.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("resize", fit);

  // ---------- Rounds ----------
  let stars = 0;
  async function run(play: Play) {
    let level: Level = 1;
    let solvedInLevel = 0;
    for (;;) {
      hud.reset();
      await factory.clearAll();
      const solved = await play(factory, level);

      hud.clearActions();
      hud.showKeypad(false);
      sfx.fanfare();
      hud.setStars(++stars);
      hud.say(`YES! ${solved}`, "good");
      factory.celebrate();
      await wait(2.8);

      if (level === 1 && ++solvedInLevel >= LEVEL_UP_AFTER) {
        level = 2;
        hud.say("LEVEL UP! Bigger numbers!", "good");
        sfx.fanfare();
        await wait(1.8);
      }
    }
  }

  // ---------- Start screen ----------
  document.getElementById("loading")!.textContent = "Pick a game!";
  const buttons = document.querySelectorAll<HTMLButtonElement>(".mode");
  buttons.forEach((btn) => {
    btn.disabled = false;
    btn.addEventListener("click", () => {
      sfx.unlockAudio();
      document.getElementById("start")!.classList.add("hide");
      document.getElementById("menu")!.hidden = false;
      void run(MODES[btn.dataset.mode!]);
    }, { once: true });
  });
  // Back to the menu: a fresh page is the simplest way to stop a round mid-way.
  document.getElementById("menu")!.addEventListener("click", () => location.reload());
}

document.querySelectorAll<HTMLButtonElement>(".mode").forEach((b) => (b.disabled = true));
void main();
