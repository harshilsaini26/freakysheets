// A long-term-owner quality screen, in the spirit of the "durable business"
// checklists value investors use. Each test is simple enough to verify by hand.
import type { CompanyRecord } from "./engine/types";
import { getItem } from "./engine/core";
import { fmtUnit, pct } from "./format";

export interface Check {
  name: string;
  pass: boolean | null;
  detail: string;
  why: string;
}

const vals = (rec: CompanyRecord, rid: string) =>
  rec.fiscal_years.map((y) => rec.ratios[rid]?.[String(y)]).filter((v): v is number => v !== undefined);

export function qualityChecks(rec: CompanyRecord): Check[] {
  const ys = rec.fiscal_years;
  const last = ys[ys.length - 1];
  const r = (rid: string) => rec.ratios[rid]?.[String(last)];
  if (rec.template === "bank") {
    const roe = r("roe");
    const eff = r("efficiency_ratio");
    const eta = r("equity_to_assets");
    const cc = vals(rec, "credit_cost");
    return [
      { name: "ROE of 10% or more", pass: roe === undefined ? null : roe >= 0.1, detail: pct(roe), why: "Banks should earn more than their cost of equity, roughly 10%." },
      { name: "Efficiency ratio at or below 60%", pass: eff === undefined ? null : eff <= 0.6, detail: pct(eff), why: "Lower cost per dollar of revenue means more resilient earnings." },
      { name: "Equity / assets of 8% or more", pass: eta === undefined ? null : eta >= 0.08, detail: pct(eta), why: "A simple capital cushion (not the regulatory CET1 ratio)." },
      { name: "Credit cost under 1% every year", pass: cc.length ? cc.every((v) => v < 0.01) : null, detail: cc.length ? `max ${pct(Math.max(...cc))}` : "–", why: "Low and stable provisions suggest careful lending." },
    ];
  }
  const roic = vals(rec, "roic");
  const gm = vals(rec, "gross_margin");
  const fcf = ys.map((y) => getItem(rec.statements, "fcf", y)).filter((v): v is number => v !== null);
  const conv = vals(rec, "cash_conversion");
  const nd = r("net_debt_to_ebitda");
  const s0 = getItem(rec.statements, "shares_diluted", ys[0]);
  const s1 = getItem(rec.statements, "shares_diluted", last);
  const avgConv = conv.length ? conv.reduce((a, b) => a + b, 0) / conv.length : null;
  return [
    { name: "ROIC of 12% or more every year", pass: roic.length ? roic.every((v) => v >= 0.12) : null, detail: roic.length ? `min ${pct(Math.min(...roic))}` : "–", why: "Consistently high returns on capital suggest a competitive advantage." },
    { name: "Stable gross margin (range within 5 pts)", pass: gm.length >= 3 ? Math.max(...gm) - Math.min(...gm) <= 0.05 : null, detail: gm.length ? `${pct(Math.min(...gm))} to ${pct(Math.max(...gm))}` : "–", why: "Pricing power shows up as margins that hold through cycles." },
    { name: "Positive free cash flow every year", pass: fcf.length ? fcf.every((v) => v > 0) : null, detail: fcf.length ? `${fcf.filter((v) => v > 0).length} of ${fcf.length} years` : "–", why: "Owners can only be paid from cash the business actually generates." },
    { name: "Average cash conversion of 1.0x or more", pass: avgConv === null ? null : avgConv >= 1, detail: fmtUnit(avgConv, "x"), why: "Profit backed by operating cash flow is higher-quality profit." },
    { name: "Net debt / EBITDA under 2x (or net cash)", pass: nd === undefined ? null : nd < 2, detail: nd === undefined ? "–" : nd < 0 ? "net cash" : fmtUnit(nd, "x"), why: "Modest debt keeps the business safe in a downturn." },
    { name: "Share count not rising", pass: s0 && s1 ? s1 <= s0 * 1.01 : null, detail: s0 && s1 ? `${((s1 / s0 - 1) * 100).toFixed(1)}% over ${last - ys[0]} yrs` : "–", why: "Dilution transfers value away from existing owners." },
  ];
}
