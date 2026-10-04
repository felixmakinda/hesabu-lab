// ➗ Division: share marbles fairly between trucks. Open crates when the ones run out;
// whatever can't be shared fairly goes in the bin — that's the remainder.
import type { Factory } from "../factory";
import { hud } from "../hud";
import { wait } from "../fx";
import * as sfx from "../audio";
import { diagnoseDivision, makeDivision, solve } from "../math/division";
import type { Level } from "../math/util";

export async function playDivision(f: Factory, level: Level): Promise<string> {
  const p = makeDivision(level);
  const { total, trucks } = p;
  f.binName = "left over";
  f.world.showProps({ rack: true, rail: true });
  hud.renderDivision(total, trucks);

  hud.say(`Let's build ${total}!`);
  await f.build(total);
  hud.say(`Here come ${trucks} trucks!`);
  await f.addTrucks(trucks);

  hud.say("Share fairly: every truck gets the same!");
  for (;;) {
    if (f.loose >= trucks) {
      await hud.ask([{ id: "share", label: "GIVE 1 TO EACH TRUCK" }]);
      await f.shareRound();
      continue;
    }
    if (f.crates.length > 0) {
      hud.say(`${f.loose === 0 ? "No ones left" : `Only ${f.loose} left`}: not enough for ${trucks} trucks. Open a crate!`, "hint");
      await hud.ask([{ id: "open", label: "OPEN A CRATE", style: "tens", pulse: true }]);
      await f.openCrate();
      hud.say(`1 ten = 10 ones. Keep sharing!`, "good");
      continue;
    }
    if (f.loose > 0) {
      hud.say(`${f.loose} left: not enough for every truck. That's the remainder!`, "hint");
      await hud.ask([{ id: "leftovers", label: "PUT IN LEFTOVER TRAY", style: "pink" }]);
      await f.allToBin();
    } else {
      hud.say("Shared perfectly. The leftover tray is empty: 0 left over!", "good");
      await f.highlightBin();
    }
    break;
  }
  hud.clearActions();
  await wait(0.4);

  hud.say("How many in each truck? How many left?");
  for (;;) {
    const answer = await hud.askShare();
    const result = diagnoseDivision(p, answer);
    const { each, left } = solve(p);
    if (result === "correct") return left ? `${total} ÷ ${trucks} = ${each} r ${left}` : `${total} ÷ ${trucks} = ${each}`;
    sfx.bloop();
    if (result === "swapped") {
      hud.say("Swap them! First count ONE truck, then the leftover tray.", "hint");
      f.hopTrucks();
      void f.highlightBin();
    } else if (result === "left-too-big") {
      hud.say(`If ${answer.left} were left over, every truck could get one more!`, "hint");
    } else {
      hud.say("Count the marbles in one truck, then the leftover tray.", "hint");
      f.hopTrucks();
      void f.highlightBin();
    }
    await wait(0.9);
    hud.clearAnswer();
  }
}
