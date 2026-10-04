// ➕ Addition: drop marbles; every ten seals into a crate (the carry).
import type { Factory } from "../factory";
import { hud } from "../hud";
import { wait } from "../fx";
import * as sfx from "../audio";
import { diagnose, makeProblem, ones, tens } from "../math/addition";
import type { Level } from "../math/util";

export async function playAddition(f: Factory, level: Level): Promise<string> {
  const p = makeProblem(level);
  const { a, b } = p;
  f.world.showProps({ rack: false, rail: false });
  hud.renderColumn("+", a, b);

  hud.say(`Let's build ${a}!`);
  await f.build(a);

  if (tens(b) > 0) {
    const n = tens(b);
    hud.say(`Add ${b}: here ${n === 1 ? "comes 1 crate" : `come ${n} crates`}…`);
    await wait(0.6);
    for (let i = 0; i < n; i++) await f.placeCrate();
    await wait(0.3);
  }

  let toDrop = ones(b);
  hud.say(tens(b) > 0 ? `…then drop ${toDrop} marbles!` : `Add ${b}: drop ${b} marbles!`);
  while (toDrop > 0) {
    hud.setHopper(toDrop);
    await hud.ask([{ id: "drop", label: "DROP", count: toDrop }]);
    toDrop--;
    f.dropMarble();
    if (f.tube.length === 10) {
      hud.setHopper(toDrop);
      await f.seal(() => hud.showCarry(1));
      if (toDrop > 0) hud.say(`Keep going: ${toDrop} more!`);
    }
  }
  hud.setHopper(0);
  hud.clearActions();
  await f.waitSettled();
  await wait(0.4);

  hud.say(`So… ${a} + ${b} = ?`);
  for (;;) {
    const answer = await hud.askNumber();
    const result = diagnose(p, answer);
    if (result === "correct") return `${a} + ${b} = ${a + b}`;
    sfx.bloop();
    if (result === "forgot-carry") {
      hud.say("Oops! Don't forget the crate we made. Count the tens again!", "hint");
      hud.pulseCarry();
      f.hopCrates();
    } else if (result === "off-by-one") {
      hud.say("So close! Count one more time.", "hint");
    } else {
      hud.say("Crates are tens, marbles are ones. Count them!", "hint");
      f.hopCrates();
    }
    await wait(0.9);
    hud.clearAnswer();
  }
}
