// A compact per-company summary used by games and lesson drills. Built on the
// server at build time from the full records so the client gets ~3 KB per firm.
import type { CompanyRecord, RedFlag, Template } from "../engine/types";
import { getItem } from "../engine/core";

export const BANK_ITEMS = [
  "revenue", "cost_of_revenue", "gross_profit", "rnd", "sga", "ebit", "ebitda", "interest_expense",
  "pretax_income", "income_tax", "net_income", "eps_diluted", "shares_diluted",
  "cash", "short_term_investments", "receivables", "inventory", "current_assets", "ppe", "goodwill",
  "intangibles", "total_assets", "accounts_payable", "current_liabilities", "total_debt", "total_liabilities",
  "equity", "retained_earnings", "working_capital",
  "cfo", "cfi", "cff", "capex", "fcf", "dividends_paid", "buybacks", "sbc", "d_and_a",
  "net_interest_income", "noninterest_income", "noninterest_expense", "provision", "loans", "deposits",
] as const;

export const BANK_RATIOS = [
  "gross_margin", "operating_margin", "net_margin", "rnd_intensity", "sga_ratio", "roa", "roe", "roic",
  "debt_to_equity", "debt_to_assets", "liabilities_to_assets", "equity_multiplier", "net_debt_to_ebitda",
  "interest_coverage", "current_ratio", "quick_ratio", "asset_turnover", "fixed_asset_turnover", "dso", "dio",
  "dpo", "cash_conversion_cycle", "fcf_margin", "cash_conversion", "capex_to_revenue", "sbc_to_revenue",
  "accruals_ratio", "revenue_growth", "net_income_growth", "cfo_growth", "payout_ratio", "sustainable_growth",
  "share_count_change", "dupont_tax_burden", "dupont_interest_burden", "nii_to_assets", "efficiency_ratio",
  "loan_to_deposit", "credit_cost", "equity_to_assets",
] as const;

export const SIZE_ITEMS = [
  "cost_of_revenue", "gross_profit", "rnd", "sga", "ebit", "net_income", "cfo", "capex",
  "cash", "receivables", "inventory", "ppe", "goodwill", "current_liabilities", "total_debt", "equity",
] as const;

export interface BankCompany {
  t: string;
  name: string;
  sector: string;
  template: Template;
  practice: boolean;
  years: number[]; // analysis years, oldest first
  prior: number | null; // year before the first analysis year (for averages)
  v: Record<string, Record<string, number>>; // item -> year -> value
  r: Record<string, Record<string, number>>; // ratio -> year -> value
  cs: Record<string, number>; // latest-year common size
  flags: RedFlag[];
  altman: string | null;
  piotroski: number | null;
}

const sig = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(5)));

export function toBank(rec: CompanyRecord): BankCompany {
  const years = rec.fiscal_years;
  const latest = years[years.length - 1];
  const allYears = rec.prior_year ? [rec.prior_year, ...years] : years;
  const v: BankCompany["v"] = {};
  for (const it of BANK_ITEMS) {
    const s: Record<string, number> = {};
    for (const y of allYears) {
      const x = getItem(rec.statements, it, y);
      if (x !== null) s[y] = sig(x);
    }
    if (Object.keys(s).length) v[it] = s;
  }
  const r: BankCompany["r"] = {};
  for (const id of BANK_RATIOS) {
    const s = rec.ratios[id];
    if (s && Object.keys(s).length) r[id] = Object.fromEntries(Object.entries(s).map(([y, x]) => [y, sig(x)]));
  }
  const cs: Record<string, number> = {};
  for (const it of SIZE_ITEMS) {
    for (const sect of ["income", "balance", "cashflow"] as const) {
      const x = rec.models.common_size[sect]?.[it]?.[String(latest)];
      if (x !== undefined) {
        cs[it] = sig(x);
        break;
      }
    }
  }
  const z = rec.models.altman_z2?.[String(latest)];
  const f = rec.models.piotroski?.[String(latest)];
  return {
    t: rec.ticker,
    name: rec.name,
    sector: rec.sector,
    template: rec.template,
    practice: !!rec.practice,
    years,
    prior: rec.prior_year,
    v,
    r,
    cs,
    flags: rec.models.red_flags,
    altman: z?.zone ?? null,
    piotroski: f?.f_score ?? null,
  };
}
