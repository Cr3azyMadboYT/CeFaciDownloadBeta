import { it, expect } from "vitest";
import { amount } from "../business/src/amount";
it("accepts Romanian and dot decimal money without changing the amount", () => {
  expect(amount(" 47,50 ")).toBe(47.5);
  expect(amount("47.50")).toBe(47.5);
  expect(amount("0")).toBe(0);
});
it("distinguishes missing amounts from invalid text before JSON serialization", () => {
  expect(amount(" ")).toBeNull();
  for (const value of ["abc", "NaN", "Infinity", "-1", "12,345", "1.000,50"])
    expect(() => amount(value)).toThrow();
});
it("bounds manually declared amounts", () => {
  expect(amount("1000000")).toBe(1000000);
  expect(() => amount("1000000,01")).toThrow();
});
