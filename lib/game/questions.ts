// Question generators that use real (or training) company numbers.
import type { BankCompany } from "./bank";
import { fmtUnit, money } from "../format";

export interface Question {
  id: string;
  prompt: string;
  givens?: { label: string; value: string }[];
  choices: string[];
  answer: number;
  explain: string;
  tag?: string;
}

export type Rng = () => number;
export function rng(seed = Date.now()): Rng {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
export const pick = <T,>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
export function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Get = (item: string) => number | null;
interface Drill {
  id: string;
  name: string;
  unit: "pct" | "x" | "days" | "usd" | "money";
  formula: string;
  banks?: "only" | "any"; // default: non-banks only
  givens: string[]; // items shown; "prev:" prefix = prior year
  calc: (g: Get, p: Get) => number | null;
  mistakes?: (g: Get, p: Get) => (number | null)[];
  why: string;
}

const avg = (a: number | null, b: number | null) => (a === null ? null : b === null ? a : (a + b) / 2);
const d = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b);

export const DRILLS: Drill[] = [
  { id: "gross_margin", name: "gross margin", unit: "pct", formula: "Gross profit / Revenue",
    givens: ["revenue", "cost_of_revenue"], calc: (g) => d(g("revenue")! - g("cost_of_revenue")!, g("revenue")),
    mistakes: (g) => [d(g("cost_of_revenue"), g("revenue"))],
    why: "Gross profit is revenue minus cost of revenue. Dividing cost by revenue gives the cost ratio, not the margin." },
  { id: "operating_margin", name: "operating (EBIT) margin", unit: "pct", formula: "EBIT / Revenue",
    givens: ["revenue", "ebit", "net_income"], calc: (g) => d(g("ebit"), g("revenue")),
    mistakes: (g) => [d(g("net_income"), g("revenue"))],
    why: "Operating margin uses EBIT, before interest and taxes. Net income gives the net margin instead." },
  { id: "net_margin", name: "net profit margin", unit: "pct", formula: "Net income / Revenue",
    givens: ["revenue", "net_income"], banks: "any", calc: (g) => d(g("net_income"), g("revenue")),
    mistakes: (g) => [d(g("revenue"), g("net_income"))],
    why: "Net margin is the share of each revenue dollar left as profit for shareholders." },
  { id: "current_ratio", name: "current ratio", unit: "x", formula: "Current assets / Current liabilities",
    givens: ["current_assets", "current_liabilities", "inventory"], calc: (g) => d(g("current_assets"), g("current_liabilities")),
    mistakes: (g) => [d(g("current_liabilities"), g("current_assets")), d(g("current_assets")! - (g("inventory") ?? 0), g("current_liabilities"))],
    why: "The current ratio compares all current assets with current liabilities. Removing inventory is a step toward the quick ratio." },
  { id: "debt_to_equity", name: "debt-to-equity ratio", unit: "x", formula: "Total debt / Shareholders' equity",
    givens: ["total_debt", "equity", "total_liabilities"], calc: (g) => ((g("equity") ?? 0) > 0 ? d(g("total_debt"), g("equity")) : null),
    mistakes: (g) => [d(g("total_liabilities"), g("equity"))],
    why: "Debt-to-equity uses interest-bearing debt only. Using total liabilities overstates leverage (that is a different ratio)." },
  { id: "interest_coverage", name: "interest coverage", unit: "x", formula: "EBIT / Interest expense",
    givens: ["ebit", "interest_expense", "net_income"], calc: (g) => d(g("ebit"), g("interest_expense")),
    mistakes: (g) => [d(g("net_income"), g("interest_expense"))],
    why: "Coverage uses EBIT because interest is paid out of operating profit before taxes." },
  { id: "roa", name: "return on assets (average assets)", unit: "pct", formula: "Net income / Average total assets",
    givens: ["net_income", "total_assets", "prev:total_assets"], banks: "any",
    calc: (g, p) => d(g("net_income"), avg(g("total_assets"), p("total_assets"))),
    mistakes: (g) => [d(g("net_income"), g("total_assets"))],
    why: "The CFA curriculum averages opening and closing balances when a flow (net income) is divided by a stock (assets)." },
  { id: "roe", name: "return on equity (average equity)", unit: "pct", formula: "Net income / Average equity",
    givens: ["net_income", "equity", "prev:equity"], banks: "any",
    calc: (g, p) => {
      const a = avg(g("equity"), p("equity"));
      return a !== null && a > 0 ? d(g("net_income"), a) : null;
    },
    mistakes: (g) => [d(g("net_income"), g("equity"))],
    why: "ROE divides net income by average shareholders' equity. Using only the ending balance is a common shortcut that the exam penalizes." },
  { id: "asset_turnover", name: "total asset turnover", unit: "x", formula: "Revenue / Average total assets",
    givens: ["revenue", "total_assets", "prev:total_assets"],
    calc: (g, p) => d(g("revenue"), avg(g("total_assets"), p("total_assets"))),
    mistakes: (g, p) => [d(avg(g("total_assets"), p("total_assets")), g("revenue"))],
    why: "Asset turnover shows how much revenue each dollar of assets generates." },
  { id: "dso", name: "days sales outstanding", unit: "days", formula: "365 / (Revenue / Average receivables)",
    givens: ["revenue", "receivables", "prev:receivables"],
    calc: (g, p) => d(365, d(g("revenue"), avg(g("receivables"), p("receivables")))),
    mistakes: (g, p) => [d(g("revenue"), avg(g("receivables"), p("receivables")))],
    why: "First compute receivables turnover (revenue / average AR), then divide 365 by it to get days." },
  { id: "dio", name: "days inventory on hand", unit: "days", formula: "365 / (COGS / Average inventory)",
    givens: ["cost_of_revenue", "revenue", "inventory", "prev:inventory"],
    calc: (g, p) => d(365, d(g("cost_of_revenue"), avg(g("inventory"), p("inventory")))),
    mistakes: (g, p) => [d(365, d(g("revenue"), avg(g("inventory"), p("inventory"))))],
    why: "Inventory is carried at cost, so inventory turnover uses cost of revenue, not sales." },
  { id: "fcf", name: "free cash flow", unit: "money", formula: "CFO - Capital expenditure",
    givens: ["cfo", "capex", "net_income"], calc: (g) => (g("cfo") === null || g("capex") === null ? null : g("cfo")! - g("capex")!),
    mistakes: (g) => [g("net_income") === null || g("capex") === null ? null : g("net_income")! - g("capex")!, (g("cfo") ?? 0) + (g("capex") ?? 0)],
    why: "Free cash flow (to the firm, simple version) is operating cash flow minus capital spending." },
  { id: "cash_conversion", name: "cash conversion (CFO / net income)", unit: "x", formula: "CFO / Net income",
    givens: ["cfo", "net_income"], banks: "any", calc: (g) => d(g("cfo"), g("net_income")),
    mistakes: (g) => [d(g("net_income"), g("cfo"))],
    why: "Above 1 means profits are backed by cash. Persistently below 1 is an earnings-quality warning." },
  { id: "payout", name: "dividend payout ratio", unit: "pct", formula: "Dividends / Net income",
    givens: ["dividends_paid", "net_income", "buybacks"], banks: "any", calc: (g) => d(g("dividends_paid"), g("net_income")),
    mistakes: (g) => [d((g("dividends_paid") ?? 0) + (g("buybacks") ?? 0), g("net_income"))],
    why: "The dividend payout ratio excludes buybacks. Adding buybacks gives the total payout ratio." },
  { id: "efficiency_ratio", name: "bank efficiency ratio", unit: "pct", formula: "Non-interest expense / Total net revenue",
    givens: ["noninterest_expense", "revenue", "net_interest_income"], banks: "only",
    calc: (g) => d(g("noninterest_expense"), g("revenue")),
    mistakes: (g) => [d(g("noninterest_expense"), g("net_interest_income"))],
    why: "Efficiency ratio is cost per dollar of total revenue (net interest income plus fees). Lower is better." },
  { id: "loan_to_deposit", name: "loan-to-deposit ratio", unit: "pct", formula: "Net loans / Deposits",
    givens: ["loans", "deposits"], banks: "only", calc: (g) => d(g("loans"), g("deposits")),
    mistakes: (g) => [d(g("deposits"), g("loans"))],
    why: "It shows how much of the deposit base is lent out." },
];

export const ITEM_LABELS: Record<string, string> = {
  revenue: "Revenue", cost_of_revenue: "Cost of revenue", gross_profit: "Gross profit", ebit: "EBIT (operating income)",
  net_income: "Net income", interest_expense: "Interest expense", current_assets: "Current assets",
  current_liabilities: "Current liabilities", inventory: "Inventory", total_debt: "Total debt", equity: "Shareholders' equity",
  total_liabilities: "Total liabilities", total_assets: "Total assets", receivables: "Accounts receivable", cfo: "Cash from operations",
  capex: "Capital expenditure", dividends_paid: "Dividends paid", buybacks: "Share buybacks",
  noninterest_expense: "Non-interest expense", net_interest_income: "Net interest income", loans: "Net loans", deposits: "Deposits",
};

function fmt(v: number, unit: Drill["unit"]) {
  return unit === "money" ? money(v) : fmtUnit(v, unit);
}

function choicesFor(r: Rng, answer: number, unit: Drill["unit"], mistakes: (number | null)[]) {
  const ans = fmt(answer, unit);
  const out = new Set<string>([ans]);
  for (const m of mistakes) if (m !== null && Number.isFinite(m)) out.add(fmt(m, unit));
  const factors = shuffle(r, [0.55, 0.7, 0.8, 1.25, 1.45, 1.8]);
  for (const f of factors) {
    if (out.size >= 4) break;
    out.add(fmt(answer * f, unit));
  }
  const list = shuffle(r, [...out].slice(0, 4));
  return { choices: list, answer: list.indexOf(ans) };
}

export function drillQuestion(r: Rng, c: BankCompany, drill: Drill, year?: number): Question | null {
  const isBank = c.template === "bank";
  if (drill.banks === "only" && !isBank) return null;
  if (drill.banks === undefined && isBank) return null;
  const y = year ?? c.years[c.years.length - 1];
  const idx = [c.prior, ...c.years].indexOf(y);
  const py = idx > 0 ? [c.prior, ...c.years][idx - 1] : null;
  const g: Get = (it) => c.v[it]?.[String(y)] ?? null;
  const p: Get = (it) => (py === null ? null : (c.v[it]?.[String(py)] ?? null));
  for (const it of drill.givens) {
    const [prev, key] = it.startsWith("prev:") ? [true, it.slice(5)] : [false, it];
    if ((prev ? p(key) : g(key)) === null) return null;
  }
  let ans: number | null;
  try {
    ans = drill.calc(g, p);
  } catch {
    ans = null;
  }
  if (ans === null || !Number.isFinite(ans) || ans === 0) return null;
  const { choices, answer } = choicesFor(r, ans, drill.unit, drill.mistakes?.(g, p) ?? []);
  if (choices.length < 3) return null;
  return {
    id: `${c.t}:${drill.id}:${y}`,
    prompt: `${c.name}, FY${y}: what is the ${drill.name}?`,
    givens: drill.givens.map((it) => {
      const prev = it.startsWith("prev:");
      const key = prev ? it.slice(5) : it;
      return { label: `${ITEM_LABELS[key] ?? key}${prev ? ` (FY${py})` : ""}`, value: money(prev ? p(key) : g(key)) };
    }),
    choices,
    answer,
    explain: `${drill.formula} = ${fmt(ans, drill.unit)}. ${drill.why}`,
    tag: drill.id,
  };
}

/** A random computable question from any company in the bank. */
export function randomDrill(r: Rng, bank: BankCompany[], ids?: string[]): Question | null {
  const drills = ids ? DRILLS.filter((d) => ids.includes(d.id)) : DRILLS;
  for (let i = 0; i < 40; i++) {
    const q = drillQuestion(r, pick(r, bank), pick(r, drills));
    if (q) return q;
  }
  return null;
}
