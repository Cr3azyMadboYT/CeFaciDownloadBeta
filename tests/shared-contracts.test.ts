import { it, expect } from "vitest";
import { RequestScope, canFinance, canOperate } from "../shared/contracts";
import { bucharestTime, localTime } from "../shared/time";
import { parseDiscount } from "../supabase/functions/citeste-bon/bon";
it("rejects previous account/local generations and accepts only active scopes", () => {
  const s = new RequestScope(),
    old = s.capture();
  s.invalidate();
  expect(old()).toBe(false);
  expect(s.capture()()).toBe(true);
});
it("separates operating and financial capabilities", () => {
  for (const role of [
    "proprietar",
    "manager",
    "receptie",
    "scanare",
  ] as const) {
    expect(canFinance(role)).toBe(["proprietar", "manager"].includes(role));
    expect(canOperate(role)).toBe(role !== "scanare");
  }
});
it("uses Bucharest inputs and rejects nonexistent spring DST time", () => {
  expect(bucharestTime("2026-10-08 20:30")).toBe("2026-10-08T17:30:00.000Z");
  expect(() => bucharestTime("2027-03-28 03:30")).toThrow(/nu există/);
  expect(localTime(new Date("2026-10-25T02:30:00Z"))).toBe("2026-10-25T04:30");
});
it("reads explicit aggregate discounts and avoids item percentages", () => {
  expect(parseDiscount("TOTAL REDUCERI -40,00 LEI")).toBe(40);
  expect(parseDiscount("Reducere 20%\nTOTAL LEI 200,00")).toBeNull();
});
