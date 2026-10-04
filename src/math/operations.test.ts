import { describe, expect, it } from "vitest";
import { diagnoseSubtraction, makeSubtraction, needsBorrow } from "./subtraction";
import { diagnoseMultiplication, makeMultiplication } from "./multiplication";
import { diagnoseDivision, makeDivision, solve } from "./division";

describe("subtraction", () => {
  it("always needs a borrow and stays positive", () => {
    for (const level of [1, 2] as const) {
      for (let i = 0; i < 2000; i++) {
        const p = makeSubtraction(level);
        expect(needsBorrow(p)).toBe(true);
        expect(p.a - p.b).toBeGreaterThan(0);
        expect(p.a).toBeLessThan(100);
        if (level === 1) expect(p.b).toBeLessThan(10);
        else expect(p.b).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it("spots the classic borrowing mistakes", () => {
    const p = { a: 43, b: 7 };
    expect(diagnoseSubtraction(p, 36)).toBe("correct");
    expect(diagnoseSubtraction(p, 44)).toBe("smaller-from-larger");
    expect(diagnoseSubtraction(p, 46)).toBe("forgot-reduce-ten");
    expect(diagnoseSubtraction(p, 35)).toBe("off-by-one");
    expect(diagnoseSubtraction({ a: 52, b: 27 }, 35)).toBe("smaller-from-larger");
    expect(diagnoseSubtraction({ a: 52, b: 27 }, 25)).toBe("correct");
  });
});

describe("multiplication", () => {
  it("makes at least one ten and stays below 100", () => {
    for (const level of [1, 2] as const) {
      for (let i = 0; i < 2000; i++) {
        const { groups, size } = makeMultiplication(level);
        expect(groups * size).toBeGreaterThanOrEqual(10);
        expect(groups * size).toBeLessThan(100);
        if (level === 1) expect(size).toBeLessThan(10);
      }
    }
  });

  it("spots adding instead of grouping, and a missing group", () => {
    const p = { groups: 4, size: 6 };
    expect(diagnoseMultiplication(p, 24)).toBe("correct");
    expect(diagnoseMultiplication(p, 10)).toBe("added");
    expect(diagnoseMultiplication(p, 18)).toBe("group-off");
    expect(diagnoseMultiplication(p, 30)).toBe("group-off");
    expect(diagnoseMultiplication(p, 25)).toBe("off-by-one");
  });
});

describe("division", () => {
  it("needs a crate opened and gives each truck a single digit", () => {
    for (const level of [1, 2] as const) {
      for (let i = 0; i < 2000; i++) {
        const p = makeDivision(level);
        expect(p.total).toBeGreaterThanOrEqual(10);
        expect(solve(p).each).toBeLessThanOrEqual(9);
        expect(solve(p).each).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("checks share and remainder", () => {
    const p = { total: 29, trucks: 4 };
    expect(solve(p)).toEqual({ each: 7, left: 1 });
    expect(diagnoseDivision(p, { each: 7, left: 1 })).toBe("correct");
    expect(diagnoseDivision(p, { each: 1, left: 7 })).toBe("swapped");
    expect(diagnoseDivision(p, { each: 6, left: 5 })).toBe("left-too-big");
    expect(diagnoseDivision(p, { each: 7, left: 2 })).toBe("doesnt-add-up");
  });
});
