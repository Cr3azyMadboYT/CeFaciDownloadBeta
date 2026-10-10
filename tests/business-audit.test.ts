import { describe, expect, it } from "vitest";
import { financePeriod, whole } from "../business/src/validation";

describe("Business operator inputs", () => {
  it("never converts absent, fractional or non-numeric counts into zero or JSON null", () => {
    for (const value of ["", " ", "abc", "NaN", "Infinity", "2.5", "2,5", "-1", "1e2", "0x10"])
      expect(() => whole(value, "Persoane", 0, 500)).toThrow();
    expect(whole(" 0 ", "Copii", 0, 500)).toBe(0);
    expect(whole("500", "Persoane", 1, 500)).toBe(500);
    expect(() => whole("501", "Persoane", 1, 500)).toThrow();
  });
  it("rejects impossible and reversed finance dates while preserving a leap day", () => {
    for (const [from, to] of [["2026-02-29", "2026-03-01"], ["2026-10-09", "2026-10-08"], ["", "2026-10-08"], ["2026-13-01", "2026-13-02"]])
      expect(() => financePeriod(from, to)).toThrow();
    expect(financePeriod("2028-02-29", "2028-03-01")).toEqual({ from: "2028-02-29", to: "2028-03-01" });
  });
});
