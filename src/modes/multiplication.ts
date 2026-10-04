// ✖️ Multiplication: add equal groups; tens still seal into crates as the total grows.
import type { Factory } from "../factory";
import { hud } from "../hud";
import { wait } from "../fx";
import * as sfx from "../audio";
import { diagnoseMultiplication, makeMultiplication } from "../math/multiplication";
import { ones, tens, type Level } from "../math/util";

export async function playMultiplication(f: Factory, level: Level): Promise<string> {
  const p = makeMultiplication(level);
  const { groups, size } = p;
  f.world.showProps({ rack: false, rail: false });
  hud.renderGroups(groups, size);

  hud.say(`Make ${groups} groups of ${size}!`);
  for (let g = 0; g < groups; g++) {
    const left = groups - g;
    await hud.ask([{ id: "group", label: `ADD A GROUP OF ${size}`, count: left }]);
    hud.lightGroup(g);
    for (let i = 0; i < tens(size); i++) await f.placeCrate();
    for (let i = 0; i < ones(size); i++) {
      f.dropMarble();
      await wait(0.14);
      if (f.tube.length === 10) await f.seal();
    }
    hud.say(g + 1 === groups ? `${groups} groups of ${size}!` : `${g + 1} ${g === 0 ? "group" : "groups"} of ${size}…`, "good");
  }
  hud.clearActions();
  await f.waitSettled();
  await wait(0.4);

  hud.say(`So… ${groups} × ${size} = ?`);
  for (;;) {
    const answer = await hud.askNumber();
    const result = diagnoseMultiplication(p, answer);
    if (result === "correct") return `${groups} × ${size} = ${groups * size}`;
    sfx.bloop();
    if (result === "added") {
      hud.say("That's adding! × means groups. Count all the crates and marbles.", "hint");
      f.hopCrates();
    } else if (result === "group-off") {
      hud.say(`Count the groups again: there are ${groups} groups of ${size}.`, "hint");
      hud.pulseGroups();
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
