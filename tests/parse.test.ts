import { describe, expect, it } from "vitest";
import { parseRows, toNumber, toStatements, yearOf } from "../lib/engine/parse";

describe("cell parsing", () => {
  it("reads accounting number formats", () => {
    expect(toNumber("(1,234)")).toBe(-1234);
    expect(toNumber("$ 2,000.5")).toBe(2000.5);
    expect(toNumber("—")).toBeNull();
    expect(toNumber("-12")).toBe(-12);
  });
  it("finds fiscal years in headers", () => {
    expect(yearOf("FY2024")).toBe(2024);
    expect(yearOf("Dec. 31, 2023")).toBe(2023);
    expect(yearOf(2022)).toBe(2022);
    expect(yearOf("Revenue")).toBeNull();
  });
});

describe("10-K style statement", () => {
  const rows = [
    ["Consolidated statements", "", ""],
    ["(in millions)", "Dec. 31, 2024", "Dec. 31, 2023"],
    ["Net sales", "1,200", "1,000"],
    ["Cost of sales", "(700)", "(600)"],
    ["Total current assets", "500", "450"],
    ["Total assets", "2,000", "1,800"],
    ["Total stockholders' equity", "900", "850"],
    ["Purchases of property and equipment", "(80)", "(70)"],
    ["Some unknown line", "5", "4"],
  ];
  const parsed = parseRows(rows, "standard", 1e6);
  it("matches labels and sorts years", () => {
    expect(parsed.years).toEqual([2023, 2024]);
    const keys = Object.fromEntries(parsed.rows.map((r) => [r.label, r.key]));
    expect(keys["Net sales"]).toBe("revenue");
    expect(keys["Total stockholders' equity"]).toBe("equity");
    expect(keys["Purchases of property and equipment"]).toBe("capex");
    expect(keys["Some unknown line"]).toBeNull();
  });
  it("scales values and flips outflows to positive", () => {
    const st = toStatements(parsed, "standard");
    expect(st.income.revenue["2024"]).toBe(1.2e9);
    expect(st.cashflow.capex["2023"]).toBe(7e7);
  });
});

describe("units detection", () => {
  it("reads the units note in a 10-K export header", async () => {
    const { detectScale } = await import("../lib/engine/parse");
    expect(detectScale([["CONSOLIDATED STATEMENTS (USD $ in Millions)", "2024"]])).toBe(1e6);
    expect(detectScale([["item", "2024"]])).toBe(1);
  });
});
