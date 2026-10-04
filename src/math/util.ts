// Small helpers shared by all the maths modules.

export type Rng = () => number;
export type Level = 1 | 2;

export const tens = (n: number) => Math.floor(n / 10);
export const ones = (n: number) => n % 10;

export const randInt = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));
