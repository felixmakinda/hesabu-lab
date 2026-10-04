// Pure maths logic for carrying problems. No graphics here, so this file
// can be unit-tested and later ported to Rust/WASM unchanged in behaviour.
import { ones, randInt, tens, type Level, type Rng } from "./util";
export { ones, tens };

export interface AdditionProblem {
  a: number;
  b: number;
}

export type Diagnosis =
  | "correct"
  | "forgot-carry" // e.g. 17 + 5 = 12: wrote the ones digit, dropped the new ten
  | "off-by-one" // counting slip
  | "other";

/** True when adding the ones digits makes a new ten. */
export const needsCarry = ({ a, b }: AdditionProblem) => ones(a) + ones(b) >= 10;

/**
 * Level 1: two-digit + one-digit, always with a carry (e.g. 17 + 5).
 * Level 2: two-digit + two-digit, always with a carry (e.g. 27 + 15).
 * Sums stay below 100 until pallets (hundreds) exist.
 */
export function makeProblem(level: Level, rng: Rng = Math.random): AdditionProblem {
  for (;;) {
    const a = randInt(rng, 11, level === 1 ? 49 : 39);
    const b = level === 1 ? randInt(rng, 2, 9) : randInt(rng, 11, 39);
    const p = { a, b };
    if (needsCarry(p) && ones(a) !== 0 && a + b < 100) return p;
  }
}

export function diagnose({ a, b }: AdditionProblem, answer: number): Diagnosis {
  const sum = a + b;
  if (answer === sum) return "correct";
  const noCarry = (tens(a) + tens(b)) * 10 + ones(ones(a) + ones(b));
  if (needsCarry({ a, b }) && answer === noCarry) return "forgot-carry";
  if (Math.abs(answer - sum) === 1) return "off-by-one";
  return "other";
}
