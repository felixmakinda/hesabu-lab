import { describe, expect, it } from "vitest";
import { diagnose, makeProblem, needsCarry } from "./addition";

describe("needsCarry", () => {
  it("is true when the ones make a new ten", () => {
    expect(needsCarry({ a: 17, b: 5 })).toBe(true);
    expect(needsCarry({ a: 15, b: 5 })).toBe(true);
    expect(needsCarry({ a: 27, b: 15 })).toBe(true);
  });
  it("is false otherwise", () => {
    expect(needsCarry({ a: 12, b: 5 })).toBe(false);
    expect(needsCarry({ a: 21, b: 14 })).toBe(false);
  });
});

describe("makeProblem", () => {
  it("always produces a carry with a sum below 100", () => {
    for (const level of [1, 2] as const) {
      for (let i = 0; i < 2000; i++) {
        const p = makeProblem(level);
        expect(needsCarry(p)).toBe(true);
        expect(p.a + p.b).toBeLessThan(100);
        expect(p.a).toBeGreaterThanOrEqual(11);
        if (level === 1) expect(p.b).toBeLessThan(10);
        else expect(p.b).toBeGreaterThanOrEqual(11);
      }
    }
  });
});

describe("diagnose", () => {
  it("spots the classic forgotten carry", () => {
    expect(diagnose({ a: 17, b: 5 }, 22)).toBe("correct");
    expect(diagnose({ a: 17, b: 5 }, 12)).toBe("forgot-carry");
    expect(diagnose({ a: 27, b: 15 }, 32)).toBe("forgot-carry");
    expect(diagnose({ a: 17, b: 5 }, 21)).toBe("off-by-one");
    expect(diagnose({ a: 17, b: 5 }, 75)).toBe("other");
  });
});
