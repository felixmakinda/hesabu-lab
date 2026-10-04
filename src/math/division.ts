// Division as fair sharing between trucks, with a remainder.
import { randInt, type Level, type Rng } from "./util";

export interface DivisionProblem {
  total: number;
  trucks: number;
}

export interface DivisionAnswer {
  each: number;
  left: number;
}

export type DivisionDiagnosis =
  | "correct"
  | "left-too-big" // leftover ≥ trucks: could still share another round
  | "swapped" // typed the leftover and the share the wrong way round
  | "doesnt-add-up" // each × trucks + left ≠ total
  | "other";

export const solve = ({ total, trucks }: DivisionProblem): DivisionAnswer => ({
  each: Math.floor(total / trucks),
  left: total % trucks,
});

/**
 * Totals always include at least one crate (≥ 10), so a ten must be opened to share.
 * Totals stay below 10 × trucks, so each truck gets at most 9 (one digit).
 * Level 1: 2–4 trucks, totals up to 29. Level 2: 3–5 trucks, totals up to 49.
 */
export function makeDivision(level: Level, rng: Rng = Math.random): DivisionProblem {
  const trucks = level === 1 ? randInt(rng, 2, 4) : randInt(rng, 3, 5);
  const max = Math.min(level === 1 ? 29 : 49, trucks * 10 - 1);
  const min = Math.max(10, trucks * 2);
  return { total: randInt(rng, min, max), trucks };
}

export function diagnoseDivision(p: DivisionProblem, { each, left }: DivisionAnswer): DivisionDiagnosis {
  const right = solve(p);
  if (each === right.each && left === right.left) return "correct";
  if (each === right.left && left === right.each) return "swapped";
  if (left >= p.trucks) return "left-too-big";
  if (each * p.trucks + left !== p.total) return "doesnt-add-up";
  return "other";
}
