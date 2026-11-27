// TypeScript port of pipeline/finlab (extract.derive, ratios, models).
// It runs in the browser for uploaded statements, so no server is needed.
// tests/parity.test.ts checks it against the Python output for the
// training companies, so keep the two in step when you change a formula.

import conceptsJson from "../../pipeline/data/concepts.json";
import type {
  AltmanResult,
  BeneishResult,
  ConceptDef,
  Forecast,
  Models,
  PiotroskiResult,
  RedFlag,
  Section,
  Series,
  Statements,
  Template,
} from "./types";

export const CONCEPTS = conceptsJson.templates as Record<Template, ConceptDef[]>;
export const DERIVED_LABELS = conceptsJson.derived as Record<string, string>;
const SECTIONS: Section[] = ["income", "balance", "cashflow"];

type N = number | null;

export function emptyStatements(): Statements {
  return { income: {}, balance: {}, cashflow: {} };
}

export function getItem(st: Statements, item: string, y: number | null): N {
  if (y === null) return null;
  for (const s of SECTIONS) {
    const sect = st[s];
    if (sect && item in sect) {
      const v = sect[item][String(y)];
      return v === undefined || v === null ? null : v;
    }
  }
  return null;
}

export function div(a: N, b: N): N {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

/** Python's `x or d` for numbers: null and 0 both fall back. */
const or = (v: N, d: number): number => (v === null || v === 0 ? d : v);
const round = (v: number, d: number) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

// ------------------------------------------------------------------ derive
function setItem(st: Statements, sect: Section, item: string, y: number, v: N) {
  if (v === null || Number.isNaN(v)) return;
  st[sect][item] ??= {};
  const k = String(y);
  if (st[sect][item][k] === undefined) st[sect][item][k] = v; // never overwrite a reported number
}

function sum(...vals: N[]): N {
  const xs = vals.filter((v): v is number => v !== null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}

export function derive(st: Statements, years: number[], template: Template) {
  for (const y of years) {
    const g = (k: string) => getItem(st, k, y);
    let rev = g("revenue");
    if (template === "bank" && rev === null) {
      rev = sum(g("net_interest_income"), g("noninterest_income"));
      setItem(st, "income", "revenue", y, rev);
    }
    if (template === "bank" && g("net_interest_income") === null && g("interest_income") !== null) {
      setItem(st, "income", "net_interest_income", y, g("interest_income")! - (g("interest_expense") ?? 0));
    }
    if (rev !== null) {
      if (g("gross_profit") === null && g("cost_of_revenue") !== null)
        setItem(st, "income", "gross_profit", y, rev - g("cost_of_revenue")!);
      if (g("cost_of_revenue") === null && g("gross_profit") !== null)
        setItem(st, "income", "cost_of_revenue", y, rev - g("gross_profit")!);
    }
    const eqTotal = g("equity_incl_nci") !== null ? g("equity_incl_nci") : g("equity");
    if (g("total_liabilities") === null && g("total_assets") !== null && eqTotal !== null)
      setItem(st, "balance", "total_liabilities", y, g("total_assets")! - eqTotal);

    let ebit = g("operating_income");
    if (ebit === null && g("pretax_income") !== null && template !== "bank")
      ebit = g("pretax_income")! + (g("interest_expense") ?? 0);
    setItem(st, "income", "ebit", y, ebit);
    if (ebit !== null && g("d_and_a") !== null) setItem(st, "income", "ebitda", y, ebit + g("d_and_a")!);
    if (g("pretax_income") && g("income_tax") !== null)
      setItem(st, "income", "effective_tax_rate", y, g("income_tax")! / g("pretax_income")!);

    const debt = sum(g("short_term_debt"), g("long_term_debt"));
    setItem(st, "balance", "total_debt", y, debt);
    if (debt !== null)
      setItem(st, "balance", "net_debt", y, debt - (g("cash") ?? 0) - (g("short_term_investments") ?? 0));
    if (debt !== null && g("equity") !== null) setItem(st, "balance", "invested_capital", y, debt + g("equity")!);
    if (g("current_assets") !== null && g("current_liabilities") !== null)
      setItem(st, "balance", "working_capital", y, g("current_assets")! - g("current_liabilities")!);
    if (g("equity") !== null)
      setItem(st, "balance", "tangible_equity", y, g("equity")! - (g("goodwill") ?? 0) - (g("intangibles") ?? 0));
    if (g("cfo") !== null && g("capex") !== null) setItem(st, "cashflow", "fcf", y, g("cfo")! - g("capex")!);
  }
}

export function labelsFor(template: Template): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of CONCEPTS[template]) out[c.key] = c.label;
  return { ...out, ...DERIVED_LABELS };
}

export function coverage(st: Statements, years: number[], template: Template) {
  const names = CONCEPTS[template].map((c) => c.key);
  let filled = 0;
  for (const n of names) for (const y of years) if (getItem(st, n, y) !== null) filled++;
  const total = names.length * Math.max(years.length, 1);
  const missing = names.filter((n) => years.every((y) => getItem(st, n, y) === null));
  return { filled_share: round(filled / total, 3), missing_items: missing };
}

// ------------------------------------------------------------------ context
export interface Data {
  years: number[];
  statements: Statements;
}

export class Ctx {
  st: Statements;
  y: number;
  prev: number | null;
  usedEndingBalance = false;
  constructor(data: Data, year: number) {
    this.st = data.statements;
    this.y = year;
    const idx = data.years.indexOf(year);
    this.prev = idx > 0 ? data.years[idx - 1] : null;
  }
  get = (item: string, y: number | null = this.y): N => getItem(this.st, item, y);
  p = (item: string): N => (this.prev !== null ? this.get(item, this.prev) : null);
  avg = (item: string): N => {
    const cur = this.get(item);
    const prev = this.p(item);
    if (cur === null) return null;
    if (prev === null) {
      this.usedEndingBalance = true;
      return cur;
    }
    return (cur + prev) / 2;
  };
  posAvg = (item: string): N => {
    const v = this.avg(item);
    return v !== null && v > 0 ? v : null;
  };
}

// ------------------------------------------------------------------ ratios
const ALL: Template[] = ["standard", "bank", "insurer"];
const NONBANK: Template[] = ["standard", "insurer"];
const STD: Template[] = ["standard"];

const yoy = (c: Ctx, item: string): N => {
  const cur = c.get(item);
  const prev = c.p(item);
  if (cur === null || prev === null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
};
const ccc = (c: Ctx): N => {
  const dso = div(365, div(c.get("revenue"), c.avg("receivables")));
  const dio = or(div(365, div(c.get("cost_of_revenue"), c.avg("inventory"))), 0);
  const dpo = div(365, div(c.get("cost_of_revenue"), c.avg("accounts_payable")));
  if (dso === null || dpo === null) return null;
  return dso + dio - dpo;
};
const sgr = (c: Ctx): N => {
  const roe = div(c.get("net_income"), c.posAvg("equity"));
  const payout = div(c.get("dividends_paid"), c.get("net_income"));
  if (roe === null || payout === null) return null;
  return roe * (1 - payout);
};
const nn = (...xs: N[]) => xs.every((x) => x !== null);

type RatioFn = (c: Ctx) => N;
/** id -> [templates, formula]. Display metadata comes from pipeline/data/ratio_catalog.json. */
export const RATIO_FNS: Record<string, [Template[], RatioFn]> = {
  gross_margin: [NONBANK, (c) => div(c.get("gross_profit"), c.get("revenue"))],
  operating_margin: [NONBANK, (c) => div(c.get("ebit"), c.get("revenue"))],
  ebitda_margin: [NONBANK, (c) => div(c.get("ebitda"), c.get("revenue"))],
  pretax_margin: [ALL, (c) => div(c.get("pretax_income"), c.get("revenue"))],
  net_margin: [ALL, (c) => div(c.get("net_income"), c.get("revenue"))],
  rnd_intensity: [NONBANK, (c) => div(c.get("rnd"), c.get("revenue"))],
  sga_ratio: [NONBANK, (c) => div(c.get("sga"), c.get("revenue"))],
  effective_tax_rate: [ALL, (c) => c.get("effective_tax_rate")],

  roa: [ALL, (c) => div(c.get("net_income"), c.avg("total_assets"))],
  roe: [ALL, (c) => div(c.get("net_income"), c.posAvg("equity"))],
  rote: [ALL, (c) => div(c.get("net_income"), c.posAvg("tangible_equity"))],
  roic: [
    NONBANK,
    (c) => {
      const ebit = c.get("ebit");
      const t = Math.min(Math.max(or(c.get("effective_tax_rate"), 0.21), 0), 0.5);
      return div(ebit === null ? null : ebit * (1 - t), c.posAvg("invested_capital"));
    },
  ],
  roce: [
    STD,
    (c) => {
      const ta = c.avg("total_assets");
      const cl = c.avg("current_liabilities");
      return div(c.get("ebit"), ta === null || cl === null ? null : ta - cl);
    },
  ],

  debt_to_equity: [ALL, (c) => div(c.get("total_debt"), or(c.get("equity"), 0) > 0 ? c.get("equity") : null)],
  debt_to_assets: [ALL, (c) => div(c.get("total_debt"), c.get("total_assets"))],
  debt_to_capital: [ALL, (c) => div(c.get("total_debt"), c.get("invested_capital"))],
  liabilities_to_assets: [ALL, (c) => div(c.get("total_liabilities"), c.get("total_assets"))],
  equity_multiplier: [ALL, (c) => div(c.avg("total_assets"), c.posAvg("equity"))],
  net_debt_to_ebitda: [STD, (c) => div(c.get("net_debt"), c.get("ebitda"))],

  interest_coverage: [STD, (c) => div(c.get("ebit"), c.get("interest_expense"))],
  cfo_to_debt: [STD, (c) => div(c.get("cfo"), c.get("total_debt"))],

  current_ratio: [STD, (c) => div(c.get("current_assets"), c.get("current_liabilities"))],
  quick_ratio: [
    STD,
    (c) => {
      const cash = c.get("cash");
      return div(
        cash === null ? null : cash + (c.get("short_term_investments") ?? 0) + (c.get("receivables") ?? 0),
        c.get("current_liabilities"),
      );
    },
  ],
  cash_ratio: [
    STD,
    (c) => {
      const cash = c.get("cash");
      return div(cash === null ? null : cash + (c.get("short_term_investments") ?? 0), c.get("current_liabilities"));
    },
  ],
  cfo_ratio: [STD, (c) => div(c.get("cfo"), c.get("current_liabilities"))],

  asset_turnover: [ALL, (c) => div(c.get("revenue"), c.avg("total_assets"))],
  fixed_asset_turnover: [STD, (c) => div(c.get("revenue"), c.avg("ppe"))],
  receivables_turnover: [STD, (c) => div(c.get("revenue"), c.avg("receivables"))],
  dso: [STD, (c) => div(365, div(c.get("revenue"), c.avg("receivables")))],
  inventory_turnover: [STD, (c) => div(c.get("cost_of_revenue"), c.avg("inventory"))],
  dio: [STD, (c) => div(365, div(c.get("cost_of_revenue"), c.avg("inventory")))],
  payables_turnover: [STD, (c) => div(c.get("cost_of_revenue"), c.avg("accounts_payable"))],
  dpo: [STD, (c) => div(365, div(c.get("cost_of_revenue"), c.avg("accounts_payable")))],
  cash_conversion_cycle: [STD, ccc],
  working_capital_turnover: [STD, (c) => div(c.get("revenue"), c.posAvg("working_capital"))],

  fcf_margin: [STD, (c) => div(c.get("fcf"), c.get("revenue"))],
  cash_conversion: [ALL, (c) => div(c.get("cfo"), c.get("net_income"))],
  capex_to_revenue: [STD, (c) => div(c.get("capex"), c.get("revenue"))],
  capex_to_da: [STD, (c) => div(c.get("capex"), c.get("d_and_a"))],
  sbc_to_revenue: [ALL, (c) => div(c.get("sbc"), c.get("revenue"))],
  accruals_ratio: [
    NONBANK,
    (c) => {
      const ni = c.get("net_income");
      const cfo = c.get("cfo");
      const cfi = c.get("cfi");
      return div(ni === null || cfo === null || cfi === null ? null : ni - cfo - cfi, c.avg("total_assets"));
    },
  ],

  revenue_growth: [ALL, (c) => yoy(c, "revenue")],
  net_income_growth: [ALL, (c) => yoy(c, "net_income")],
  eps_growth: [ALL, (c) => yoy(c, "eps_diluted")],
  cfo_growth: [ALL, (c) => yoy(c, "cfo")],
  asset_growth: [ALL, (c) => yoy(c, "total_assets")],

  payout_ratio: [ALL, (c) => div(c.get("dividends_paid"), c.get("net_income"))],
  total_payout_ratio: [
    ALL,
    (c) => {
      const d = c.get("dividends_paid");
      const b = c.get("buybacks");
      return div(d === null && b === null ? null : (d ?? 0) + (b ?? 0), c.get("net_income"));
    },
  ],
  retention_ratio: [
    ALL,
    (c) => {
      const p = div(c.get("dividends_paid"), c.get("net_income"));
      return p === null ? null : 1 - p;
    },
  ],
  sustainable_growth: [ALL, sgr],
  book_value_per_share: [ALL, (c) => div(c.get("equity"), c.get("shares_outstanding"))],
  share_count_change: [ALL, (c) => yoy(c, "shares_diluted")],

  dupont_net_margin: [ALL, (c) => div(c.get("net_income"), c.get("revenue"))],
  dupont_asset_turnover: [ALL, (c) => div(c.get("revenue"), c.avg("total_assets"))],
  dupont_equity_multiplier: [ALL, (c) => div(c.avg("total_assets"), c.posAvg("equity"))],
  dupont_tax_burden: [ALL, (c) => div(c.get("net_income"), c.get("pretax_income"))],
  dupont_interest_burden: [NONBANK, (c) => div(c.get("pretax_income"), c.get("ebit"))],
  dupont_ebit_margin: [NONBANK, (c) => div(c.get("ebit"), c.get("revenue"))],

  nii_to_assets: [["bank"], (c) => div(c.get("net_interest_income"), c.avg("total_assets"))],
  efficiency_ratio: [["bank"], (c) => div(c.get("noninterest_expense"), c.get("revenue"))],
  fee_income_share: [["bank"], (c) => div(c.get("noninterest_income"), c.get("revenue"))],
  loan_to_deposit: [["bank"], (c) => div(c.get("loans"), c.get("deposits"))],
  credit_cost: [["bank"], (c) => div(c.get("provision"), c.avg("loans"))],
  reserve_coverage: [["bank"], (c) => div(c.get("loan_allowance"), c.get("loans"))],
  equity_to_assets: [["bank", "insurer"], (c) => div(c.get("equity"), c.get("total_assets"))],

  loss_ratio: [["insurer"], (c) => div(c.get("claims_incurred"), c.get("premiums_earned"))],
  premium_share: [["insurer"], (c) => div(c.get("premiums_earned"), c.get("revenue"))],
};

export function computeRatios(data: Data, template: Template, years: number[]) {
  const out: Record<string, Series> = {};
  const fallback = new Set<number>();
  for (const [rid, [templates, fn]] of Object.entries(RATIO_FNS)) {
    if (!templates.includes(template)) continue;
    const series: Series = {};
    for (const y of years) {
      const c = new Ctx(data, y);
      const v = fn(c);
      if (v !== null && Number.isFinite(v)) series[String(y)] = round(v, 6);
      if (c.usedEndingBalance) fallback.add(y);
    }
    out[rid] = series;
  }
  out.dupont_roe_check = {};
  for (const y of years) {
    const k = String(y);
    const legs = ["dupont_net_margin", "dupont_asset_turnover", "dupont_equity_multiplier"].map(
      (r) => out[r]?.[k] ?? null,
    );
    if (nn(...legs)) out.dupont_roe_check[k] = round(legs[0]! * legs[1]! * legs[2]!, 6);
  }
  return { ratios: out, fallback: [...fallback].sort((a, b) => a - b) };
}

// ------------------------------------------------------------------ models
export function commonSize(data: Data, years: number[]): Statements {
  const out = emptyStatements();
  const bases: [Section, string][] = [
    ["income", "revenue"],
    ["cashflow", "revenue"],
    ["balance", "total_assets"],
  ];
  for (const [sect, base] of bases) {
    for (const [item, series] of Object.entries(data.statements[sect])) {
      if (item === "effective_tax_rate") continue;
      const vals: Series = {};
      for (const y of years) {
        const b = getItem(data.statements, base, y);
        const v = series[String(y)];
        if (v !== undefined && v !== null && b) vals[String(y)] = round(v / b, 6);
      }
      if (Object.keys(vals).length) out[sect][item] = vals;
    }
  }
  return out;
}

const TREND_ITEMS = ["revenue", "gross_profit", "ebit", "net_income", "cfo", "total_assets", "equity", "total_debt"];
export function trendIndex(data: Data, years: number[]) {
  const out: Record<string, Series> = {};
  if (!years.length) return out;
  for (const it of TREND_ITEMS) {
    const c0 = getItem(data.statements, it, years[0]);
    if (!c0) continue;
    const s: Series = {};
    for (const y of years) {
      const v = getItem(data.statements, it, y);
      if (v !== null) s[String(y)] = round((100 * v) / c0, 2);
    }
    out[it] = s;
  }
  return out;
}

export function cagr(first: N, last: N, years: number): N {
  if (first === null || last === null || years <= 0 || first <= 0 || last <= 0) return null;
  return (last / first) ** (1 / years) - 1;
}

function growthSummary(data: Data, years: number[]) {
  const out: Record<string, number> = {};
  if (years.length < 2) return out;
  const y0 = years[0];
  const y1 = years[years.length - 1];
  for (const it of ["revenue", "net_income", "eps_diluted", "cfo", "fcf", "total_assets", "equity", "dividends_paid"]) {
    const v = cagr(getItem(data.statements, it, y0), getItem(data.statements, it, y1), y1 - y0);
    if (v !== null) out[it] = round(v, 6);
  }
  return out;
}

const BENEISH_W: Record<string, number> = {
  DSRI: 0.92, GMI: 0.528, AQI: 0.404, SGI: 0.892, DEPI: 0.115, SGAI: -0.172, TATA: 4.679, LVGI: -0.327,
};

export function beneish(data: Data, y: number): BeneishResult | null {
  const c = new Ctx(data, y);
  if (c.prev === null) return null;
  const g = c.get;
  const p = c.p;
  if (!nn(g("revenue"), p("revenue"), g("total_assets"), p("total_assets"))) return null;
  const ratio = (a: N, b: N): N => (a === null || b === null || b === 0 ? null : a / b);
  const gm = (rev: N, cogs: N): N => (rev === null || rev === 0 || cogs === null ? null : (rev - cogs) / rev);
  const aq = (ca: N, ppe: N, ta: N): N => (!nn(ca, ppe, ta) || ta === 0 ? null : 1 - (ca! + ppe!) / ta!);
  const dep = (d: N, ppe: N): N => (!nn(d, ppe) || d! + ppe! === 0 ? null : d! / (d! + ppe!));
  const lev = (cl: N, ltd: N, ta: N): N => (cl === null || ta === null || ta === 0 ? null : (cl + (ltd ?? 0)) / ta);
  const idx: Record<string, N> = {
    DSRI: ratio(ratio(g("receivables"), g("revenue")), ratio(p("receivables"), p("revenue"))),
    GMI: ratio(gm(p("revenue"), p("cost_of_revenue")), gm(g("revenue"), g("cost_of_revenue"))),
    AQI: ratio(aq(g("current_assets"), g("ppe"), g("total_assets")), aq(p("current_assets"), p("ppe"), p("total_assets"))),
    SGI: ratio(g("revenue"), p("revenue")),
    DEPI: ratio(dep(p("d_and_a"), p("ppe")), dep(g("d_and_a"), g("ppe"))),
    SGAI: ratio(ratio(g("sga"), g("revenue")), ratio(p("sga"), p("revenue"))),
    LVGI: ratio(
      lev(g("current_liabilities"), g("long_term_debt"), g("total_assets")),
      lev(p("current_liabilities"), p("long_term_debt"), p("total_assets")),
    ),
    TATA: ratio(g("net_income") === null || g("cfo") === null ? null : g("net_income")! - g("cfo")!, g("total_assets")),
  };
  const imputed = Object.keys(idx).filter((k) => idx[k] === null);
  if (imputed.length > 3) return null;
  for (const k of imputed) idx[k] = k === "TATA" ? 0 : 1;
  const m = -4.84 + Object.keys(idx).reduce((s, k) => s + BENEISH_W[k] * idx[k]!, 0);
  return {
    m_score: round(m, 3),
    components: Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, round(v!, 4)])),
    imputed,
    threshold: -1.78,
    zone: m > -1.78 ? "likely manipulator" : "unlikely manipulator",
  };
}

export function piotroski(data: Data, y: number): PiotroskiResult | null {
  const c = new Ctx(data, y);
  if (c.prev === null) return null;
  const g = c.get;
  const p = c.p;
  const i = data.years.indexOf(y);
  const prev2 = i >= 2 ? data.years[i - 2] : null;
  const at = (yy: number | null) => (yy === null ? null : getItem(data.statements, "total_assets", yy));
  const roa = (cur: number, prv: number | null) => {
    const ni = getItem(data.statements, "net_income", cur);
    const ta = at(prv) || at(cur);
    return div(ni, ta);
  };
  const roaT = roa(y, c.prev);
  const roaP = roa(c.prev, prev2);
  const cfoTa = div(g("cfo"), p("total_assets") || g("total_assets"));
  const levT = div(g("long_term_debt") || 0, g("total_assets"));
  const levP = div(p("long_term_debt") || 0, p("total_assets"));
  const crT = div(g("current_assets"), g("current_liabilities"));
  const crP = div(p("current_assets"), p("current_liabilities"));
  const gmT = div(g("gross_profit"), g("revenue"));
  const gmP = div(p("gross_profit"), p("revenue"));
  const atT = div(g("revenue"), p("total_assets"));
  const atP = div(p("revenue"), prev2 !== null ? at(prev2) : p("total_assets"));
  const cmp = (a: N, b: N, f: (a: number, b: number) => boolean) => (a === null || b === null ? null : f(a, b));
  const tests: Record<string, boolean | null> = {
    positive_roa: roaT === null ? null : roaT > 0,
    positive_cfo: g("cfo") === null ? null : g("cfo")! > 0,
    improving_roa: cmp(roaT, roaP, (a, b) => a > b),
    cfo_exceeds_net_income: cmp(cfoTa, roaT, (a, b) => a > b),
    lower_leverage: cmp(levT, levP, (a, b) => a <= b),
    higher_current_ratio: cmp(crT, crP, (a, b) => a > b),
    no_dilution: cmp(g("shares_diluted"), p("shares_diluted"), (a, b) => a <= b),
    higher_gross_margin: cmp(gmT, gmP, (a, b) => a > b),
    higher_asset_turnover: cmp(atT, atP, (a, b) => a > b),
  };
  const avail = Object.values(tests).filter((v): v is boolean => v !== null);
  if (avail.length < 6) return null;
  const score = avail.filter(Boolean).length;
  return {
    f_score: score,
    max_possible: avail.length,
    tests,
    zone: score >= 7 ? "strong" : score <= 3 ? "weak" : "neutral",
  };
}

export function altmanZ2(data: Data, y: number): AltmanResult | null {
  const c = new Ctx(data, y);
  const ta = c.get("total_assets");
  const tl = c.get("total_liabilities");
  const eq = c.get("equity_incl_nci") !== null ? c.get("equity_incl_nci") : c.get("equity");
  const wc = c.get("working_capital");
  const re = c.get("retained_earnings");
  const ebit = c.get("ebit");
  if (!nn(ta, tl, eq, wc, re, ebit) || !ta || !tl) return null;
  const x = {
    X1_working_capital_to_assets: wc! / ta,
    X2_retained_earnings_to_assets: re! / ta,
    X3_ebit_to_assets: ebit! / ta,
    X4_book_equity_to_liabilities: eq! / tl,
  };
  const w = [6.56, 3.26, 6.72, 1.05];
  const z = Object.values(x).reduce((s, v, i) => s + w[i] * v, 0);
  return {
    z_score: round(z, 3),
    components: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v, 4)])),
    zone: z > 2.6 ? "safe" : z >= 1.1 ? "grey" : "distress",
  };
}

// Python-style number formatting used in red-flag evidence strings.
const pct1 = (v: number, sign = false) => `${sign && v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const bn = (v: number) =>
  (v / 1e9).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function redFlags(data: Data, ratios: Record<string, Series>, years: number[]): RedFlag[] {
  const flags: RedFlag[] = [];
  const r = (rid: string, y: number | null): N => (y === null ? null : (ratios[rid]?.[String(y)] ?? null));
  for (const y of years.slice(1)) {
    const c = new Ctx(data, y);
    const g = c.get;
    const p = c.p;
    const add = (type: string, title: string, evidence: string) => flags.push({ year: y, type, title, evidence });
    const niG = r("net_income_growth", y);
    const cfoG = r("cfo_growth", y);
    const revG = r("revenue_growth", y);
    if (niG !== null && cfoG !== null && niG > 0.05 && cfoG < -0.05)
      add("earnings_quality", "Net income rose while operating cash flow fell", `NI ${pct1(niG, true)} vs CFO ${pct1(cfoG, true)}`);
    const recG = div(g("receivables"), p("receivables"));
    if (recG && revG !== null && recG - 1 - revG > 0.1)
      add("revenue_recognition", "Receivables grew much faster than revenue", `AR ${pct1(recG - 1, true)} vs revenue ${pct1(revG, true)}`);
    const invG = div(g("inventory"), p("inventory"));
    if (invG && revG !== null && invG - 1 - revG > 0.15)
      add("inventory", "Inventory built up faster than sales", `Inventory ${pct1(invG - 1, true)} vs revenue ${pct1(revG, true)}`);
    const cc = r("cash_conversion", y);
    const ni = g("net_income");
    if (cc !== null && ni && ni > 0 && cc < 0.8)
      add("earnings_quality", "Less than 80% of profit converted to operating cash", `CFO/NI = ${cc.toFixed(2)}`);
    const ic = r("interest_coverage", y);
    if (ic !== null && ic > 0 && ic < 3) add("solvency", "Thin interest coverage", `EBIT/interest = ${ic.toFixed(1)}x`);
    const de = r("debt_to_equity", y);
    const deP = r("debt_to_equity", c.prev);
    if (de !== null && deP !== null && de - deP > 0.5)
      add("solvency", "Debt-to-equity jumped", `${deP.toFixed(2)} -> ${de.toFixed(2)}`);
    const eq = g("equity");
    if (eq !== null && eq < 0)
      add("solvency", "Negative shareholders' equity (often from buybacks, check why)", `Equity = ${bn(eq)}bn`);
    const cr = r("current_ratio", y);
    if (cr !== null && cr < 1 && or(r("current_ratio", c.prev), 1) >= 1)
      add("liquidity", "Current ratio fell below 1", cr.toFixed(2));
    const gm = r("gross_margin", y);
    const gmP = r("gross_margin", c.prev);
    if (gm !== null && gmP !== null && gmP - gm > 0.03)
      add("profitability", "Gross margin compressed by more than 3 pts", `${pct1(gmP)} -> ${pct1(gm)}`);
    const sh = r("share_count_change", y);
    if (sh !== null && sh > 0.03) add("dilution", "Diluted share count rose more than 3%", pct1(sh, true));
    const fcf = g("fcf");
    if (fcf !== null && fcf < 0 && ni && ni > 0)
      add("cash_flow", "Profitable but free cash flow negative", `FCF = ${bn(fcf)}bn`);
    const ar = r("accruals_ratio", y);
    if (ar !== null && ar > 0.1) add("earnings_quality", "High accruals (>10% of assets)", pct1(ar));
  }
  return flags;
}

function linfit(xs: number[], ys: number[]): [number, number, number] | null {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const b = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx;
  const a = my - b * mx;
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (a + b * xs[i])) ** 2, 0);
  return [a, b, ssTot ? 1 - ssRes / ssTot : 1];
}

export function forecast(data: Data, ratios: Record<string, Series>, years: number[]): Forecast | null {
  const pts = years
    .map((y) => [y, getItem(data.statements, "revenue", y)] as const)
    .filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 3) return null;
  const [lastY, lastRev] = pts[pts.length - 1];
  const g = cagr(pts[0][1], lastRev, lastY - pts[0][0]);
  const fit = linfit(pts.map((p) => p[0]), pts.map((p) => p[1]));
  const margins = years
    .slice(-3)
    .map((y) => ratios.net_margin?.[String(y)])
    .filter((m): m is number => m !== undefined && m !== null);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
  const revCagr = g !== null ? lastRev * (1 + g) : null;
  const revLin = fit ? fit[0] + fit[1] * (lastY + 1) : null;
  const base = revCagr ?? revLin;
  const ni = base !== null && avgMargin !== null ? base * avgMargin : null;
  const shares = getItem(data.statements, "shares_diluted", lastY);
  const growths = years.map((y) => ratios.revenue_growth?.[String(y)]).filter((x): x is number => x != null);
  let vol: N = null;
  if (growths.length >= 2) {
    const mean = growths.reduce((a, b) => a + b, 0) / growths.length;
    vol = Math.sqrt(growths.reduce((s, x) => s + (x - mean) ** 2, 0) / (growths.length - 1));
  }
  return {
    target_year: lastY + 1,
    revenue_cagr: g === null ? null : round(g, 6),
    revenue_growth_volatility: vol === null ? null : round(vol, 6),
    revenue_next_cagr_method: revCagr === null ? null : Math.round(revCagr),
    revenue_next_linear_method: revLin === null ? null : Math.round(revLin),
    linear_trend_r2: fit ? round(fit[2], 4) : null,
    avg_net_margin_3y: avgMargin === null ? null : round(avgMargin, 6),
    net_income_next: ni === null ? null : Math.round(ni),
    eps_next: ni === null || !shares ? null : round(ni / shares, 4),
    sustainable_growth: ratios.sustainable_growth?.[String(lastY)] ?? null,
    disclaimer: "Mechanical extrapolation for learning only; not a forecast or advice.",
  };
}

export function runModels(data: Data, ratios: Record<string, Series>, template: Template, years: number[]): Models {
  const out: Models = {
    common_size: commonSize(data, years),
    trend_index: trendIndex(data, years),
    cagr: growthSummary(data, years),
    red_flags: redFlags(data, ratios, years),
    forecast: forecast(data, ratios, years),
  };
  const collect = <T>(fn: (d: Data, y: number) => T | null) => {
    const o: Record<string, T> = {};
    for (const y of years) {
      const v = fn(data, y);
      if (v) o[String(y)] = v;
    }
    return o;
  };
  if (template !== "bank") {
    out.altman_z2 = collect(altmanZ2);
    out.beneish = collect(beneish);
  }
  if (template === "standard") out.piotroski = collect(piotroski);
  return out;
}
