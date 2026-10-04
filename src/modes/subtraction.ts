// ➖ Subtraction: take marbles away; when there aren't enough ones, open a crate (the borrow).
import type { Factory } from "../factory";
import { hud } from "../hud";
import { wait } from "../fx";
import * as sfx from "../audio";
import { diagnoseSubtraction, makeSubtraction } from "../math/subtraction";
import { ones, tens, type Level } from "../math/util";

export async function playSubtraction(f: Factory, level: Level): Promise<string> {
  const p = makeSubtraction(level);
  const { a, b } = p;
  f.binName = "taken away";
  f.world.showProps({ rack: true, rail: true });
  hud.renderColumn("−", a, b);

  hud.say(`Let's build ${a}!`);
  await f.build(a);

  // Ones first, like the written method. Not enough? Trade a ten for ten ones.
  const need = ones(b);
  if (f.loose < need) {
    hud.say(`We need ${need} ones but have only ${f.loose}. Open a crate!`, "hint");
    await hud.ask([{ id: "open", label: "OPEN A CRATE", style: "tens", pulse: true }]);
    await f.openCrate();
    hud.showBorrow(a);
    hud.say(`1 ten = 10 ones. Now we have ${f.loose} ones!`, "good");
    await wait(1.4);
  }

  hud.say(`Take away ${need} marbles!`);
  for (let left = need; left > 0; left--) {
    hud.setHopper(left, "pink");
    await hud.ask([{ id: "take", label: "TAKE", count: left, style: "pink" }]);
    await f.takeAway();
  }
  hud.setHopper(0);

  if (tens(b) > 0) {
    const n = tens(b);
    hud.say(`Now take away ${n} ${n === 1 ? "crate" : "crates"}!`);
    for (let left = n; left > 0; left--) {
      await hud.ask([{ id: "take-crate", label: "TAKE A CRATE", count: left, style: "tens" }]);
      await f.takeCrate();
    }
  }
  hud.clearActions();
  await f.waitSettled();
  await wait(0.4);

  hud.say(`So… ${a} − ${b} = ?`);
  for (;;) {
    const answer = await hud.askNumber();
    const result = diagnoseSubtraction(p, answer);
    if (result === "correct") return `${a} − ${b} = ${a - b}`;
    sfx.bloop();
    if (result === "smaller-from-larger") {
      hud.say(`We couldn't take ${ones(b)} from ${ones(a)}, so we opened a crate. Count what's left!`, "hint");
      hud.pulseBorrow();
    } else if (result === "forgot-reduce-ten") {
      hud.say("We opened a crate, so there's one less ten. Count the crates!", "hint");
      hud.pulseBorrow();
      f.hopCrates();
    } else if (result === "off-by-one") {
      hud.say("So close! Count one more time.", "hint");
    } else {
      hud.say("Count what's left: crates are tens, marbles are ones.", "hint");
      f.hopCrates();
    }
    await wait(0.9);
    hud.clearAnswer();
  }
}
