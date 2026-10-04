// Multiplication as "groups of": 4 × 6 means 4 groups of 6.
import { randInt, type Level, type Rng } from "./util";

export interface MultiplicationProblem {
  groups: number;
  size: number;
}

export type MultiplicationDiagnosis =
  | "correct"
  | "added" // 4 × 6 = 10: added instead of making groups
  | "group-off" // 4 × 6 = 18 or 30: one group too few / too many
  | "off-by-one"
  | "other";

/**
 * Level 1: up to 5 groups of a single-digit number, always making at least one ten (e.g. 4 × 6).
 * Level 2: a few groups of a two-digit number, product below 100 (e.g. 3 × 14).
 */
export function makeMultiplication(level: Level, rng: Rng = Math.random): MultiplicationProblem {
  for (;;) {
    const groups = randInt(rng, 2, level === 1 ? 5 : 4);
    const size = level === 1 ? randInt(rng, 3, 9) : randInt(rng, 11, 24);
    const product = groups * size;
    if (product >= 10 && product < 100) return { groups, size };
  }
}

export function diagnoseMultiplication(
  { groups, size }: MultiplicationProblem,
  answer: number,
): MultiplicationDiagnosis {
  const product = groups * size;
  if (answer === product) return "correct";
  if (answer === groups + size) return "added";
  if (answer === product - size || answer === product + size) return "group-off";
  if (Math.abs(answer - product) === 1) return "off-by-one";
  return "other";
}
