// Subtraction with borrowing ("open a crate" = trade 1 ten for 10 ones).
import { ones, randInt, tens, type Level, type Rng } from "./util";

export interface SubtractionProblem {
  a: number;
  b: number;
}

export type SubtractionDiagnosis =
  | "correct"
  | "smaller-from-larger" // 43 − 7 = 44: did 7 − 3 instead of borrowing
  | "forgot-reduce-ten" // 43 − 7 = 46: borrowed, but didn't take the ten away
  | "off-by-one"
  | "other";

/** True when there aren't enough ones, so a ten must be opened. */
export const needsBorrow = ({ a, b }: SubtractionProblem) => ones(a) < ones(b);

/**
 * Level 1: two-digit − one-digit, always with a borrow (e.g. 43 − 7).
 * Level 2: two-digit − two-digit, always with a borrow (e.g. 52 − 27).
 */
export function makeSubtraction(level: Level, rng: Rng = Math.random): SubtractionProblem {
  for (;;) {
    const a = randInt(rng, level === 1 ? 11 : 31, level === 1 ? 59 : 89);
    const b = level === 1 ? randInt(rng, 2, 9) : randInt(rng, 11, a - 10);
    const p = { a, b };
    if (needsBorrow(p) && a - b > 0) return p;
  }
}

export function diagnoseSubtraction({ a, b }: SubtractionProblem, answer: number): SubtractionDiagnosis {
  const diff = a - b;
  if (answer === diff) return "correct";
  if (needsBorrow({ a, b })) {
    const smallerFromLarger = (tens(a) - tens(b)) * 10 + Math.abs(ones(a) - ones(b));
    if (answer === smallerFromLarger) return "smaller-from-larger";
    const forgotReduce = (tens(a) - tens(b)) * 10 + (ones(a) + 10 - ones(b));
    if (answer === forgotReduce) return "forgot-reduce-ten";
  }
  if (Math.abs(answer - diff) === 1) return "off-by-one";
  return "other";
}
